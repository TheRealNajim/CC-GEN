/**
 * CC-GEN Pro — Bulk Test Card Generator
 * Route: GET /api/bulk-generate?count=N&brand=mixed|visa|mastercard|amex|discover&persona=PREFIX
 *
 * PRO-GATED ENDPOINT. Quantities above the free client-side limit
 * (10) are generated here, and only for visitors whose Pro cookie is
 * signed AND whose Stripe subscription is verified live as active.
 * Fail-closed: if Stripe cannot be reached, generation is refused.
 *
 * Output mirrors the site's client-side fixture format exactly.
 */

const lib = require('./_lib');
const stripe = require('./_stripe');

const FREE_LIMIT = 10;
const MAX_COUNT = 500;

const BRAND_PREFIXES = {
    visa: ['4242', '4532', '4916'],
    mastercard: ['5105', '5425', '5555'],
    amex: ['3782', '3714'],
    discover: ['6011']
};
const BRAND_KEYS = ['visa', 'mastercard', 'amex', 'discover'];

function luhnComplete(prefix, length) {
    let body = prefix;
    while (body.length < length - 1) {
        body += String(Math.floor(Math.random() * 10));
    }

    let sum = 0;
    const reversed = body.split('').reverse();
    for (let i = 0; i < reversed.length; i++) {
        let digit = parseInt(reversed[i], 10);
        if (i % 2 === 0) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    return body + checkDigit;
}

function generateCard(id, brand, persona, now) {
    const prefixList = BRAND_PREFIXES[brand] || BRAND_PREFIXES.visa;
    const prefix = prefixList[Math.floor(Math.random() * prefixList.length)];
    const length = brand === 'amex' ? 15 : 16;

    const expYear = String(now.getFullYear() + 1 + Math.floor(Math.random() * 4));

    return {
        id,
        cardholder: `${persona}_${id}`,
        network: brand.toUpperCase(),
        cardNumber: luhnComplete(prefix, length),
        expMonth: String(1 + Math.floor(Math.random() * 12)).padStart(2, '0'),
        expYear,
        cvv: brand === 'amex' ? '1005' : String(100 + Math.floor(Math.random() * 900)),
        luhnValid: true
    };
}

function json(res, status, data, cookies) {
    if (cookies && cookies.length) {
        res.setHeader('Set-Cookie', cookies);
    }
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(data));
}

module.exports = async (req, res) => {
    const url = new URL(req.url, lib.getBaseUrl(req));

    // ---- Validate input -------------------------------------------------
    const count = parseInt(url.searchParams.get('count'), 10);
    const brandRaw = (url.searchParams.get('brand') || 'mixed').toLowerCase();
    const brand = BRAND_PREFIXES[brandRaw] ? brandRaw : 'mixed';
    const personaRaw = (url.searchParams.get('persona') || 'TEST_USER')
        .replace(/[^A-Za-z0-9_]/g, '')
        .slice(0, 30) || 'USER';

    if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
        return json(res, 400, {
            error: 'invalid_count',
            message: `count must be an integer between 1 and ${MAX_COUNT}`
        });
    }

    if (count <= FREE_LIMIT) {
        return json(res, 400, {
            error: 'use_client_generation',
            message: `Quantities up to ${FREE_LIMIT} are generated client-side.`
        });
    }

    // ---- Pro gate -------------------------------------------------------
    const pro = lib.getProFromRequest(req);
    if (!pro) {
        return json(res, 402, {
            error: 'pro_required',
            message: 'Bulk exports above 10 cards require a CC-GEN Pro subscription.',
            upgradeUrl: '/pricing.html'
        });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
        return json(res, 503, {
            error: 'billing_unavailable',
            message: 'Billing verification is temporarily unavailable. Please try again shortly.'
        });
    }

    try {
        const subscription = await stripe.retrieveSubscription(pro.subscriptionId);
        if (!stripe.subscriptionIsActive(subscription)) {
            // Revoke the stale cookie along with the refusal.
            return json(res, 402, {
                error: 'subscription_inactive',
                message: 'Your CC-GEN Pro subscription is no longer active.',
                upgradeUrl: '/pricing.html'
            }, [lib.expiredCookie(lib.PRO_COOKIE)]);
        }

        // ---- Generate ----------------------------------------------------
        const now = new Date();
        const cards = [];
        for (let i = 1; i <= count; i++) {
            let chosenBrand = brand;
            if (brand === 'mixed') {
                chosenBrand = BRAND_KEYS[Math.floor(Math.random() * BRAND_KEYS.length)];
            }
            cards.push(generateCard(i, chosenBrand, personaRaw, now));
        }

        return json(res, 200, {
            count,
            brand,
            persona: personaRaw,
            generatedAt: now.toISOString(),
            cards
        });
    } catch (err) {
        if (err && err.status === 404) {
            return json(res, 402, {
                error: 'subscription_inactive',
                message: 'Your CC-GEN Pro subscription is no longer active.',
                upgradeUrl: '/pricing.html'
            }, [lib.expiredCookie(lib.PRO_COOKIE)]);
        }
        console.error('[bulk:generate]', err && err.message);
        return json(res, 503, {
            error: 'billing_unavailable',
            message: 'Billing verification is temporarily unavailable. Please try again shortly.'
        });
    }
};
