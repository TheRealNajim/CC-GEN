/**
 * CC-GEN Email Auth — Register / Login / Password Reset
 * Route: POST /api/auth/email/{register|login|reset}
 *
 * Dynamic route: a single function serves all three email auth
 * endpoints (keeps the deployment under the Hobby plan's
 * 12-function limit). Credentials are verified against Firebase
 * Auth's REST API; on success the standard CC-GEN session cookie
 * is issued so email accounts behave exactly like OAuth ones.
 */

const lib = require('../../_lib');
const fb = require('../../_firebase');

function actionFromRequest(req) {
    const path = String(req.url || '').split('?')[0].replace(/\/+$/, '');
    const segments = path.split('/');
    return segments[4] || '';
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

function cleanName(value) {
    return String(value || '')
        .replace(/[\u0000-\u001f<>]/g, '')
        .trim()
        .slice(0, 50);
}

function localPartOf(email) {
    return String(email).split('@')[0];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------------------------------------------ */
/* POST /api/auth/email/register                                       */
/* ------------------------------------------------------------------ */

async function handleRegister(req, res, body) {
    const firstName = cleanName(body.firstName);
    const lastName = cleanName(body.lastName);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
    const password = String(body.password || '');

    if (!firstName) {
        return json(res, 400, { error: 'validation', message: 'Please enter your first name.' });
    }

    if (!EMAIL_PATTERN.test(email)) {
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
}

/* ------------------------------------------------------------------ */
/* POST /api/auth/email/login                                          */
/* ------------------------------------------------------------------ */

async function handleLogin(req, res, body) {
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
}

/* ------------------------------------------------------------------ */
/* POST /api/auth/email/reset                                          */
/* ------------------------------------------------------------------ */

const RESET_GENERIC_OK = {
    success: true,
    message: 'If an account exists for that email, a password reset link is on its way.'
};

async function handleReset(req, res, body) {
    const email = String(body.email || '').trim().toLowerCase().slice(0, 254);

    if (!EMAIL_PATTERN.test(email)) {
        return json(res, 400, { error: 'validation', message: 'Please enter a valid email address.' });
    }

    try {
        await fb.sendPasswordReset(email);
        return json(res, 200, RESET_GENERIC_OK);
    } catch (err) {
        // Unknown email / not found: answer generically (no enumeration).
        if (err.firebaseCode === 'EMAIL_NOT_FOUND') {
            return json(res, 200, RESET_GENERIC_OK);
        }
        console.error('[email:reset]', err && err.message);
        return json(res, 502, { error: 'upstream', message: 'We could not send the reset email right now. Please try again shortly.' });
    }
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

module.exports = async (req, res) => {
    const action = actionFromRequest(req);

    if (action !== 'register' && action !== 'login' && action !== 'reset') {
        return json(res, 404, { error: 'not_found', message: 'Unknown email auth action.' });
    }

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
        return json(res, 400, { error: 'invalid_body', message: 'Could not read the request details.' });
    }

    if (action === 'register') return handleRegister(req, res, body);
    if (action === 'login') return handleLogin(req, res, body);
    return handleReset(req, res, body);
};
