/**
 * CC-GEN Billing — Start Stripe Checkout
 * Route: GET /api/billing/checkout?plan=monthly|yearly
 * Requires a signed-in session, then redirects to the Stripe-hosted
 * checkout page for a CC-GEN Pro subscription.
 */

const lib = require('../_lib');
const stripe = require('../_stripe');

function userRef(session) {
    return `${session.provider}:${session.id}`;
}

module.exports = async (req, res) => {
    const url = new URL(req.url, lib.getBaseUrl(req));
    const plan = url.searchParams.get('plan') === 'yearly' ? 'yearly' : 'monthly';
    const base = lib.getBaseUrl(req);

    const priceId = plan === 'yearly' ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY;

    if (!process.env.STRIPE_SECRET_KEY || !priceId) {
        return lib.errorPage(
            res,
            500,
            'Billing Is Not Configured Yet',
            `The Stripe environment variables are missing, so <strong>CC-GEN Pro (${plan})</strong> checkout cannot start.`,
            [
                'In your Stripe dashboard, create a product (e.g. <strong>CC-GEN Pro</strong>) with two recurring prices: <strong>$3.00 / month</strong> and <strong>$30.00 / year</strong>.',
                'In your Vercel project &rarr; Settings &rarr; Environment Variables, add <code>STRIPE_SECRET_KEY</code>, <code>STRIPE_PRICE_MONTHLY</code>, and <code>STRIPE_PRICE_YEARLY</code>, then redeploy.',
                'Also enable the <strong>Customer Portal</strong> in Stripe &rarr; Settings &rarr; Billing &rarr; Customer portal so subscribers can manage or cancel their plan.'
            ]
        );
    }

    const session = lib.getSessionFromRequest(req);
    if (!session) {
        // Subscriptions are tied to an account — sign in first.
        return lib.redirect(res, '/sign%20in.html');
    }

    // Already Pro? Send them to the portal to manage instead of double-charging.
    const pro = lib.getProFromRequest(req);
    if (pro) {
        return lib.redirect(res, '/api/billing/portal');
    }

    try {
        const checkout = await stripe.createCheckoutSession({
            mode: 'subscription',
            'line_items[0][price]': priceId,
            'line_items[0][quantity]': 1,
            success_url: `${base}/api/billing/verify?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${base}/pricing.html?cancelled=1`,
            client_reference_id: userRef(session),
            customer_email: session.email || undefined,
            allow_promotion_codes: true,
            'subscription_data[metadata][user_ref]': userRef(session),
            'subscription_data[metadata][plan]': plan
        });

        if (!checkout || !checkout.url) {
            throw new stripe.StripeError('Stripe did not return a checkout URL', 502, 'no_checkout_url');
        }

        lib.redirect(res, checkout.url);
    } catch (err) {
        console.error('[billing:checkout]', err && err.message);
        return lib.errorPage(
            res,
            err && err.status === 500 ? 500 : 502,
            'Could Not Start Checkout',
            'We could not create a Stripe checkout session. Please try again in a moment.',
            []
        );
    }
};
