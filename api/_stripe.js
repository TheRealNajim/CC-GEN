/**
 * CC-GEN Stripe REST Client
 * Minimal fetch-based client for the billing serverless functions.
 * Uses the Stripe REST API directly (form-encoded) so the project
 * stays dependency-free — no npm install needed at deploy time.
 *
 * This file is prefixed with an underscore so Vercel does not expose
 * it as an endpoint.
 */

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

/* ------------------------------------------------------------------ */
/* Form encoding (Stripe's nested bracket syntax)                      */
/* ------------------------------------------------------------------ */

function encodeForm(value, key, out) {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
        value.forEach((item, i) => encodeForm(item, `${key}[${i}]`, out));
        return;
    }

    if (typeof value === 'object') {
        Object.keys(value).forEach((k) => {
            encodeForm(value[k], key ? `${key}[${k}]` : k, out);
        });
        return;
    }

    out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
}

function toQueryString(params) {
    const parts = [];
    encodeForm(params, '', parts);
    return parts.join('&');
}

/* ------------------------------------------------------------------ */
/* Core request                                                        */
/* ------------------------------------------------------------------ */

class StripeError extends Error {
    constructor(message, status, code) {
        super(message);
        this.name = 'StripeError';
        this.status = status;
        this.code = code;
    }
}

function isBillingConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
}

async function stripeRequest(method, path, params) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        throw new StripeError('STRIPE_SECRET_KEY is not configured', 500, 'missing_secret_key');
    }

    let url = `${STRIPE_API_BASE}${path}`;
    const options = {
        method,
        headers: {
            Authorization: `Bearer ${key}`,
            'User-Agent': 'cc-gen-billing'
        }
    };

    if (method === 'GET') {
        if (params && Object.keys(params).length) {
            url += `?${toQueryString(params)}`;
        }
    } else {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.body = toQueryString(params || {});
    }

    let response;
    try {
        response = await fetch(url, options);
    } catch (e) {
        throw new StripeError('Could not reach the Stripe API', 502, 'network_error');
    }

    let data = null;
    try {
        data = await response.json();
    } catch (e) {
        data = null;
    }

    if (!response.ok) {
        const err = (data && data.error) || {};
        throw new StripeError(
            err.message || `Stripe request failed (${response.status})`,
            response.status,
            err.code || 'stripe_error'
        );
    }

    return data;
}

/* ------------------------------------------------------------------ */
/* Resources used by CC-GEN billing                                    */
/* ------------------------------------------------------------------ */

function createCheckoutSession(params) {
    return stripeRequest('POST', '/checkout/sessions', params);
}

function retrieveCheckoutSession(sessionId) {
    return stripeRequest('GET', `/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

function retrieveSubscription(subscriptionId) {
    return stripeRequest('GET', `/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

function listActiveSubscriptions(customerId) {
    return stripeRequest('GET', '/subscriptions', {
        customer: customerId,
        status: 'active',
        limit: 5
    });
}

function listCustomersByEmail(email) {
    return stripeRequest('GET', '/customers', {
        email,
        limit: 5
    });
}

function createPortalSession(customerId, returnUrl) {
    return stripeRequest('POST', '/billing_portal/sessions', {
        customer: customerId,
        return_url: returnUrl
    });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function subscriptionPeriodEnd(sub) {
    if (!sub) return null;
    const fromItem =
        sub.items &&
        Array.isArray(sub.items.data) &&
        sub.items.data[0] &&
        sub.items.data[0].current_period_end;
    return sub.current_period_end || fromItem || null;
}

function subscriptionIsActive(sub) {
    if (!sub) return false;
    return ['active', 'trialing', 'past_due'].indexOf(sub.status) !== -1;
}

function subscriptionPriceId(sub) {
    if (!sub || !sub.items || !Array.isArray(sub.items.data) || !sub.items.data[0]) return null;
    return sub.items.data[0].price ? sub.items.data[0].price.id : null;
}

function resolvePlanFromSubscription(sub) {
    if (sub && sub.metadata && (sub.metadata.plan === 'monthly' || sub.metadata.plan === 'yearly')) {
        return sub.metadata.plan;
    }
    const priceId = subscriptionPriceId(sub);
    if (priceId && priceId === process.env.STRIPE_PRICE_YEARLY) return 'yearly';
    if (priceId && priceId === process.env.STRIPE_PRICE_MONTHLY) return 'monthly';
    return 'monthly';
}

module.exports = {
    StripeError,
    isBillingConfigured,
    stripeRequest,
    createCheckoutSession,
    retrieveCheckoutSession,
    retrieveSubscription,
    listActiveSubscriptions,
    listCustomersByEmail,
    createPortalSession,
    subscriptionPeriodEnd,
    subscriptionIsActive,
    subscriptionPriceId,
    resolvePlanFromSubscription
};
