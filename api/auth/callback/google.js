/**
 * CC-GEN OAuth — Google Callback
 * Route: GET /api/auth/callback/google
 * Verifies the OAuth state, exchanges the authorization code for an
 * access token, fetches the Google profile, then issues a signed
 * session cookie and redirects to the success page.
 */

const lib = require('../../_lib');

async function exchangeCodeForTokens(code, redirectUri) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        })
    });

    if (!response.ok) {
        throw new Error(`Google token exchange failed (${response.status})`);
    }
    return response.json();
}

async function fetchGoogleProfile(accessToken) {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
        throw new Error(`Google profile request failed (${response.status})`);
    }
    return response.json();
}

module.exports = async (req, res) => {
    const url = new URL(req.url, lib.getBaseUrl(req));
    const providerError = url.searchParams.get('error');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    const cookies = lib.parseCookies(req);
    const expectedState = cookies[lib.STATE_COOKIE];
    const clearState = lib.expiredCookie(lib.STATE_COOKIE);

    if (providerError) {
        return lib.errorPage(
            res,
            401,
            'Google Sign-In Was Cancelled',
            'You closed the Google consent screen or denied access, so no account was created. Nothing has been saved.',
            []
        );
    }

    if (!code || !state || !expectedState || state !== expectedState) {
        return lib.errorPage(
            res,
            400,
            'Invalid Or Expired Login State',
            'We could not verify this sign-in request (the one-time state token did not match). This is a security protection against forged login links.',
            [
                'Go back to the <strong>Sign In</strong> or <strong>Sign Up</strong> page and start again.',
                'If it keeps happening, make sure your browser allows cookies for this site.'
            ]
        );
    }

    if (!process.env.AUTH_SECRET) {
        return lib.errorPage(
            res,
            500,
            'Session Secret Is Not Configured',
            'The <code>AUTH_SECRET</code> environment variable is missing, so we could not create your login session.',
            [
                'In your Vercel project &rarr; Settings &rarr; Environment Variables, add <code>AUTH_SECRET</code> set to a long random string (e.g. 32+ hex characters).',
                'Redeploy the project after adding it.'
            ]
        );
    }

    try {
        const redirectUri = `${lib.getBaseUrl(req)}/api/auth/callback/google`;
        const tokens = await exchangeCodeForTokens(code, redirectUri);

        if (!tokens.access_token) {
            throw new Error('No access token returned by Google');
        }

        const profile = await fetchGoogleProfile(tokens.access_token);

        const user = {
            provider: 'google',
            id: profile.sub,
            name: profile.name || profile.given_name || 'CC-GEN User',
            email: profile.email || null,
            avatar: profile.picture || null
        };

        const session = lib.signSession(user);

        lib.redirect(res, '/loginsuccessful.html', [
            lib.cookieString(lib.SESSION_COOKIE, session, lib.SESSION_TTL_SECONDS),
            clearState
        ]);
    } catch (err) {
        console.error('[oauth:google:callback]', err && err.message);
        return lib.errorPage(
            res,
            502,
            'Google Sign-In Failed',
            'We could not complete the handshake with Google. Please try again in a moment.',
            []
        );
    }
};
