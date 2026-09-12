/**
 * CC-GEN Email Auth — Register Account
 * Route: POST /api/auth/email/register
 * Body: { firstName, lastName, email, password }
 * Creates the account in Firebase Auth (passwords stored & hashed by
 * Google), persists the display name, then issues the standard CC-GEN
 * session cookie so email accounts behave exactly like OAuth ones.
 */

const lib = require('../../_lib');
const fb = require('../../_firebase');

function json(res, status, data, cookies) {
    if (cookies && cookies.length) {
        res.setHeader('Set-Cookie', cookies);
    }
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(data));
}

function cleanName(value) {
    return String(value || '')
        .replace(/[\u0000-\u001f<>]/g, '')
        .trim()
        .slice(0, 50);
}

function localPartOf(email) {
    return String(email).split('@')[0];
}

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
            message: 'Email sign-up is not configured on the server yet. You can still continue with Google or GitHub.'
        });
    }

    let body;
    try {
        body = await lib.readJsonBody(req);
    } catch (e) {
        return json(res, 400, { error: 'invalid_body', message: 'Could not read the registration details.' });
    }

    const firstName = cleanName(body.firstName);
    const lastName = cleanName(body.lastName);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
    const password = String(body.password || '');

    if (!firstName) {
        return json(res, 400, { error: 'validation', message: 'Please enter your first name.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(res, 400, { error: 'validation', message: 'Please enter a valid email address.' });
    }

    if (password.length < 8) {
        return json(res, 400, { error: 'validation', message: 'Password must be at least 8 characters long.' });
    }

    if (password.length > 128) {
        return json(res, 400, { error: 'validation', message: 'Password is too long (max 128 characters).' });
    }

    let signup;
    try {
        signup = await fb.signUp(email, password);
    } catch (err) {
        if (err.firebaseCode === 'EMAIL_EXISTS') {
            return json(res, 409, {
                error: 'email_exists',
                message: 'An account with this email already exists. Try signing in instead.'
            });
        }
        if (err.firebaseCode === 'WEAK_PASSWORD') {
            return json(res, 400, { error: 'validation', message: 'That password is too weak. Please choose a stronger one.' });
        }
        if (err.firebaseCode === 'INVALID_EMAIL') {
            return json(res, 400, { error: 'validation', message: 'Please enter a valid email address.' });
        }
        if (err.firebaseCode === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
            return json(res, 429, { error: 'rate_limited', message: 'Too many attempts. Please wait a moment and try again.' });
        }
        console.error('[email:register]', err && err.message);
        return json(res, 502, { error: 'upstream', message: 'We could not create your account right now. Please try again shortly.' });
    }

    if (!signup || !signup.localId) {
        return json(res, 502, { error: 'upstream', message: 'We could not create your account right now. Please try again shortly.' });
    }

    // Persist the display name on the Firebase profile (best-effort —
    // login falls back to the email local part if this ever fails).
    const displayName = [firstName, lastName].filter(Boolean).join(' ');
    try {
        await fb.updateProfile(signup.idToken, displayName);
    } catch (e) {
        console.error('[email:register:profile]', e && e.message);
    }

    const session = lib.signSession({
        provider: 'email',
        id: signup.localId,
        name: displayName || localPartOf(email),
        email,
        avatar: null
    });

    return json(res, 200, { success: true, redirect: '/loginsuccessful.html' }, [
        lib.cookieString(lib.SESSION_COOKIE, session, lib.SESSION_TTL_SECONDS)
    ]);
};
