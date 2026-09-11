/**
 * CC-GEN OAuth — Start Google Sign-In / Sign-Up
 * Route: GET /api/auth/google
 * Redirects the user to Google's OAuth 2.0 consent screen.
 */

const lib = require('../_lib');

module.exports = async (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
        return lib.errorPage(
            res,
            500,
            'Google Sign-In Is Not Configured Yet',
            'The <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> environment variables are missing on the server.',
            [
                'Open the <strong>Google Cloud Console</strong> &rarr; APIs &amp; Services &rarr; Credentials and create an <strong>OAuth 2.0 Client ID</strong> (Web application).',
                `Add <code>${lib.getBaseUrl(req)}/api/auth/callback/google</code> as an <strong>Authorized redirect URI</strong>.`,
                'In your Vercel project &rarr; Settings &rarr; Environment Variables, add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code>, then redeploy.'
            ]
        );
    }

    const state = lib.newState();
    const redirectUri = `${lib.getBaseUrl(req)}/api/auth/callback/google`;

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'online');
    authUrl.searchParams.set('prompt', 'select_account');

    lib.redirect(res, authUrl.toString(), [
        lib.cookieString(lib.STATE_COOKIE, state, lib.STATE_TTL_SECONDS)
    ]);
};
