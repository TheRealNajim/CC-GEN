/**
 * CC-GEN Email Auth — Sign In
 * Route: POST /api/auth/email/login
 * Body: { email, password }
 * Verifies the credentials against Firebase Auth, loads the stored
 * display name, and issues the standard CC-GEN session cookie.
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
            message: 'Email sign-in is not configured on the server yet. You can still continue with Google or GitHub.'
        });
    }

    let body;
    try {
        body = await lib.readJsonBody(req);
    } catch (e) {
        return json(res, 400, { error: 'invalid_body', message: 'Could not read the sign-in details.' });
    }

    const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
    const password = String(body.password || '');

    if (!email || !password) {
        return json(res, 400, { error: 'validation', message: 'Please enter your email and password.' });
    }

    let login;
    try {
        login = await fb.signInWithPassword(email, password);
    } catch (err) {
        if (
            err.firebaseCode === 'INVALID_LOGIN_CREDENTIALS' ||
            err.firebaseCode === 'INVALID_PASSWORD' ||
            err.firebaseCode === 'EMAIL_NOT_FOUND' ||
            err.firebaseCode === 'INVALID_EMAIL'
        ) {
            // Generic message: never reveal whether the email exists.
            return json(res, 401, { error: 'invalid_credentials', message: 'Incorrect email or password. Please try again.' });
        }
        if (err.firebaseCode === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
            return json(res, 429, { error: 'rate_limited', message: 'Too many sign-in attempts. Please wait a moment and try again.' });
        }
        if (err.firebaseCode === 'USER_DISABLED') {
            return json(res, 403, { error: 'account_disabled', message: 'This account has been disabled. Contact support for help.' });
        }
        console.error('[email:login]', err && err.message);
        return json(res, 502, { error: 'upstream', message: 'We could not sign you in right now. Please try again shortly.' });
    }

    if (!login || !login.localId) {
        return json(res, 502, { error: 'upstream', message: 'We could not sign you in right now. Please try again shortly.' });
    }

    // Load the display name saved at registration (best-effort).
    let name = '';
    try {
        const profile = await fb.lookupAccount(login.idToken);
        if (profile && Array.isArray(profile.users) && profile.users[0]) {
            name = profile.users[0].displayName || '';
        }
    } catch (e) {
        console.error('[email:login:profile]', e && e.message);
    }

    const session = lib.signSession({
        provider: 'email',
        id: login.localId,
        name: name || localPartOf(email),
        email,
        avatar: null
    });

    return json(res, 200, { success: true, redirect: '/loginsuccessful.html' }, [
        lib.cookieString(lib.SESSION_COOKIE, session, lib.SESSION_TTL_SECONDS)
    ]);
};
