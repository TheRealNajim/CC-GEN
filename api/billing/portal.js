/**
 * CC-GEN Billing — Customer Portal
 * Route: GET /api/billing/portal
 * Sends the visitor to the Stripe customer portal to update their
 * card, download invoices, or cancel the subscription.
 * Uses the Pro cookie's customer ID, or falls back to looking up the
 * customer by the signed-in account's email.
 */

const lib = require('../_lib');
const stripe = require('../_stripe');

module.exports = async (req, res) => {
    const base = lib.getBaseUrl(req);

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

    const pro = lib.getProFromRequest(req);
    let customerId = pro && pro.customerId;

    if (!customerId) {
        // Recovery path: find the Stripe customer by the signed-in email.
        const session = lib.getSessionFromRequest(req);
        if (session && session.email) {
            try {
                const customers = await stripe.listCustomersByEmail(session.email);
                if (customers && Array.isArray(customers.data) && customers.data.length) {
                    customerId = customers.data[0].id;
                }
            } catch (err) {
                console.error('[billing:portal:lookup]', err && err.message);
            }
        }
    }

    if (!customerId) {
        return lib.errorPage(
            res,
            401,
            'No Billing Account Found',
            'We could not find a CC-GEN Pro subscription for this browser or account.',
            [
                'If you recently subscribed, go back to the site and reload this page once.',
                'Otherwise, visit the <strong>Pricing</strong> page to choose a plan.'
            ]
        );
    }

    try {
        const portal = await stripe.createPortalSession(customerId, `${base}/billing-success.html`);
        if (!portal || !portal.url) {
            throw new stripe.StripeError('Stripe did not return a portal URL', 502, 'no_portal_url');
        }
        lib.redirect(res, portal.url);
    } catch (err) {
        console.error('[billing:portal]', err && err.message);
        const notConfigured = err && err.code === 'portal_configuration_not_found';
        return lib.errorPage(
            res,
            notConfigured ? 500 : 502,
            notConfigured ? 'Customer Portal Not Enabled' : 'Could Not Open Billing Portal',
            notConfigured
                ? 'The Stripe customer portal has not been enabled for your account yet, so subscription management links cannot be created.'
                : 'We could not create a billing portal session. Please try again in a moment.',
            notConfigured
                ? [
                    'In Stripe &rarr; Settings &rarr; Billing &rarr; <strong>Customer portal</strong>, enable the portal and save the default configuration.',
                    'Then reload this page.'
                ]
                : []
        );
    }
};
