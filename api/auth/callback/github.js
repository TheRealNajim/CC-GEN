/**
 * CC-GEN OAuth — GitHub Callback
 * Route: GET /api/auth/callback/github
 * Verifies the OAuth state, exchanges the authorization code for an
 * access token, fetches the GitHub profile (plus a verified primary
 * email), then issues a signed session cookie and redirects to the
 * success page.
 */

const lib = require('../../_lib');

async function exchangeCodeForTokens(code, redirectUri, state) {
    const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json'
        },
        body: new URLSearchParams({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri,
            state
        })
    });

    if (!response.ok) {
        throw new Error(`GitHub token exchange failed (${response.status})`);
    }

    const data = await response.json();
    if (data.error || !data.access_token) {
        throw new Error(data.error_description || data.error || 'No access token returned by GitHub');
    }
    return data;
}

async function fetchGitHubProfile(accessToken) {
    const response = await fetch('https://api.github.com/user', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'cc-gen-oauth'
        }
    });

    if (!response.ok) {
        throw new Error(`GitHub profile request failed (${response.status})`);
    }
    return response.json();
}

async function fetchGitHubEmail(accessToken) {
    try {
        const response = await fetch('https://api.github.com/user/emails', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': 'cc-gen-oauth'
            }
        });

        if (!response.ok) return null;

        const emails = await response.json();
        if (!Array.isArray(emails)) return null;

        const primary = emails.find((e) => e.primary && e.verified);
        const verified = emails.find((e) => e.verified);
        return (primary && primary.email) || (verified && verified.email) || null;
    } catch (e) {
        return null;
    }
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
            'GitHub Sign-In Was Cancelled',
            'You closed the GitHub authorization screen or denied access, so no account was created. Nothing has been saved.',
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
        const redirectUri = `${lib.getBaseUrl(req)}/api/auth/callback/github`;
        const tokens = await exchangeCodeForTokens(code, redirectUri, state);

        const profile = await fetchGitHubProfile(tokens.access_token);
        const email = await fetchGitHubEmail(tokens.access_token);

        const user = {
            provider: 'github',
            id: profile.id,
            name: profile.name || profile.login || 'CC-GEN User',
            email: email || profile.email || null,
            avatar: profile.avatar_url || null
        };

        const session = lib.signSession(user);

        lib.redirect(res, '/loginsuccessful.html', [
            lib.cookieString(lib.SESSION_COOKIE, session, lib.SESSION_TTL_SECONDS),
            clearState
        ]);
    } catch (err) {
        console.error('[oauth:github:callback]', err && err.message);
        return lib.errorPage(
            res,
            502,
            'GitHub Sign-In Failed',
            'We could not complete the handshake with GitHub. Please try again in a moment.',
            []
        );
    }
};
