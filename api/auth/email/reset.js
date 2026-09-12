/**
 * CC-GEN Email Auth — Forgot Password
 * Route: POST /api/auth/email/reset
 * Body: { email }
 * Asks Firebase to email a password-reset link. Always answers with
 * the same generic success so the endpoint can't be used to probe
 * which emails have accounts.
 */

const lib = require('../../_lib');
const fb = require('../../_firebase');

function json(res, status, data) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(data));
}

const GENERIC_OK = {
    success: true,
    message: 'If an account exists for that email, a password reset link is on its way.'
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return json(res, 405, { error: 'method_not_allowed' });
    }

    if (!lib.isSameOrigin(req)) {
        return json(res, 403, { error: 'cross_origin', message: 'Cross-origin requests are not allowed.' });
    }

    if (!fb.isEmailAuthConfigured()) {
        return json(res, 500, {
            error: 'not_configured',
            message: 'Email sign-in is not configured on the server yet.'
        });
    }

    let body;
    try {
        body = await lib.readJsonBody(req);
    } catch (e) {
        return json(res, 400, { error: 'invalid_body', message: 'Could not read the email address.' });
    }

    const email = String(body.email || '').trim().toLowerCase().slice(0, 254);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(res, 400, { error: 'validation', message: 'Please enter a valid email address.' });
    }

    try {
        await fb.sendPasswordReset(email);
        return json(res, 200, GENERIC_OK);
    } catch (err) {
        // Unknown email / not found: answer generically (no enumeration).
        if (err.firebaseCode === 'EMAIL_NOT_FOUND') {
            return json(res, 200, GENERIC_OK);
        }
        console.error('[email:reset]', err && err.message);
        return json(res, 502, { error: 'upstream', message: 'We could not send the reset email right now. Please try again shortly.' });
    }
};
