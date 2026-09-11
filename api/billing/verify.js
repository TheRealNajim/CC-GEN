/**
 * CC-GEN Billing — Verify Checkout & Grant Pro
 * Route: GET /api/billing/verify?session_id={CHECKOUT_SESSION_ID}
 * Stripe redirects here after a successful payment. Retrieves the
 * checkout session server-side, confirms it was paid, and issues a
 * signed Pro cookie bound to the Stripe customer + subscription.
 */

const lib = require('../_lib');
const stripe = require('../_stripe');

module.exports = async (req, res) => {
    const url = new URL(req.url, lib.getBaseUrl(req));
    const sessionId = url.searchParams.get('session_id');

    if (!sessionId) {
        return lib.redirect(res, '/pricing.html');
    }

    if (!process.env.STRIPE_SECRET_KEY) {
        return lib.errorPage(
            res,
            500,
            'Billing Is Not Configured Yet',
            'The <code>STRIPE_SECRET_KEY</code> environment variable is missing on the server.',
            [
                'In your Vercel project &rarr; Settings &rarr; Environment Variables, add <code>STRIPE_SECRET_KEY</code>, then redeploy.'
            ]
        );
    }

    if (!process.env.AUTH_SECRET) {
        return lib.errorPage(
            res,
            500,
            'Session Secret Is Not Configured',
            'The <code>AUTH_SECRET</code> environment variable is missing, so we could not activate your Pro plan.',
            [
                'In your Vercel project &rarr; Settings &rarr; Environment Variables, add <code>AUTH_SECRET</code> set to a long random string, then redeploy.'
            ]
        );
    }

    let checkout;
    try {
        checkout = await stripe.retrieveCheckoutSession(sessionId);
    } catch (err) {
        console.error('[billing:verify]', err && err.message);
        return lib.errorPage(
            res,
            502,
            'Could Not Verify Your Payment',
            'We could not retrieve the checkout session from Stripe. If you were charged, please contact support — your payment is safe.',
            []
        );
    }

    const paid = checkout && checkout.status === 'complete' && checkout.payment_status === 'paid';

    if (!paid || !checkout.subscription) {
        return lib.errorPage(
            res,
            402,
            'Payment Not Completed',
            'This checkout session has not been paid yet. No charge was made.',
            [
                'Go back to the <strong>Pricing</strong> page and start the checkout again.',
                'If you believe this is a mistake, contact support and quote session <code>' + lib.escapeHtml(String(checkout && checkout.id || sessionId).slice(0, 60)) + '</code>.'
            ]
        );
    }

    // Bind the upgrade to the account that started it.
    const session = lib.getSessionFromRequest(req);
    if (session && checkout.client_reference_id && checkout.client_reference_id !== `${session.provider}:${session.id}`) {
        return lib.errorPage(
            res,
            403,
            'This Checkout Belongs To A Different Account',
            'The payment succeeded, but it was started from a different CC-GEN account than the one you are signed in with.',
            [
                'Sign in with the account you used at checkout, then visit the <strong>Pricing</strong> page to restore your Pro plan.',
                'If you need to move the subscription to another account, contact support.'
            ]
        );
    }

    let subscription = null;
    try {
        subscription = await stripe.retrieveSubscription(checkout.subscription);
    } catch (err) {
        console.error('[billing:verify:subscription]', err && err.message);
    }

    const plan = stripe.resolvePlanFromSubscription(subscription);
    const email =
        (checkout.customer_details && checkout.customer_details.email) ||
        (subscription && subscription.customer_email) ||
        (session && session.email) ||
        null;

    const proToken = lib.signProToken({
        customerId: checkout.customer || (subscription && subscription.customer) || null,
        subscriptionId: checkout.subscription,
        plan,
        email
    });

    lib.redirect(res, `/billing-success.html?plan=${plan}`, [
        lib.cookieString(lib.PRO_COOKIE, proToken, lib.PRO_TTL_SECONDS)
    ]);
};
