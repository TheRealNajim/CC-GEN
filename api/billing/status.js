/**
 * CC-GEN Billing — Pro Status
 * Route: GET /api/billing/status
 * Returns whether the visitor has an active CC-GEN Pro subscription.
 * The signed Pro cookie is re-validated live against Stripe (and
 * refreshed); if the subscription ended, the cookie is revoked.
 * As a recovery path, a signed-in user whose Pro cookie was lost is
 * matched back to their subscription by billing email.
 */

const lib = require('../_lib');
const stripe = require('../_stripe');

function json(res, status, data, cookies) {
    if (cookies && cookies.length) {
        res.setHeader('Set-Cookie', cookies);
    }
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(data));
}

async function findSubscriptionByEmail(email) {
    if (!email) return null;
    const customers = await stripe.listCustomersByEmail(email);
    if (!customers || !Array.isArray(customers.data) || !customers.data.length) return null;

    for (const customer of customers.data) {
        const subs = await stripe.listActiveSubscriptions(customer.id);
        if (subs && Array.isArray(subs.data) && subs.data.length) {
            return { subscription: subs.data[0], customerId: customer.id };
        }
    }
    return null;
}

module.exports = async (req, res) => {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.AUTH_SECRET) {
        return json(res, 200, { pro: false, billingEnabled: false });
    }

    const pro = lib.getProFromRequest(req);
    const cookies = [];

    try {
        if (pro) {
            let subscription = null;
            try {
                subscription = await stripe.retrieveSubscription(pro.subscriptionId);
            } catch (err) {
                if (err && err.status === 404) {
                    // Subscription deleted on Stripe's side.
                    return json(res, 200, { pro: false, canceled: true }, [
                        lib.expiredCookie(lib.PRO_COOKIE)
                    ]);
                }
                throw err;
            }

            if (stripe.subscriptionIsActive(subscription)) {
                // Still active — refresh the cookie window.
                const plan = stripe.resolvePlanFromSubscription(subscription);
                const renewed = lib.signProToken({
                    customerId: pro.customerId,
                    subscriptionId: pro.subscriptionId,
                    plan,
                    email: pro.email
                });
                cookies.push(lib.cookieString(lib.PRO_COOKIE, renewed, lib.PRO_TTL_SECONDS));

                return json(res, 200, {
                    pro: true,
                    plan,
                    renewalDate: stripe.subscriptionPeriodEnd(subscription),
                    status: subscription.status
                }, cookies);
            }

            // Subscription ended — revoke Pro.
            return json(res, 200, { pro: false, canceled: true }, [
                lib.expiredCookie(lib.PRO_COOKIE)
            ]);
        }

        // No Pro cookie. If signed in, try to recover Pro by billing email.
        const session = lib.getSessionFromRequest(req);
        if (session && session.email) {
            const found = await findSubscriptionByEmail(session.email);
            if (found) {
                const plan = stripe.resolvePlanFromSubscription(found.subscription);
                const token = lib.signProToken({
                    customerId: found.customerId,
                    subscriptionId: found.subscription.id,
                    plan,
                    email: session.email
                });
                cookies.push(lib.cookieString(lib.PRO_COOKIE, token, lib.PRO_TTL_SECONDS));

                return json(res, 200, {
                    pro: true,
                    plan,
                    renewalDate: stripe.subscriptionPeriodEnd(found.subscription),
                    status: found.subscription.status,
                    recovered: true
                }, cookies);
            }
        }

        return json(res, 200, { pro: false });
    } catch (err) {
        console.error('[billing:status]', err && err.message);
        // Stripe unreachable: report the cookie's offline validity, flagged stale.
        if (pro) {
            return json(res, 200, { pro: true, plan: pro.plan, stale: true });
        }
        return json(res, 200, { pro: false, error: 'billing_check_failed' });
    }
};
