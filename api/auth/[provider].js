/**
 * CC-GEN OAuth — Start Google / GitHub Sign-In
 * Route: GET /api/auth/{google|github}
 *
 * Dynamic route: a single function serves both provider start
 * endpoints, keeping this Hobby-plan deployment under the
 * 12-serverless-function limit. Static siblings (session.js,
 * logout.js) keep their own routes.
 */

const lib = require('../_lib');

function providerFromRequest(req) {
    const path = String(req.url || '').split('?')[0].replace(/\/+$/, '');
    const segments = path.split('/');
    return segments[3] || '';
}

module.exports = async (req, res) => {
    const provider = providerFromRequest(req);
    const baseUrl = lib.getBaseUrl(req);

    if (provider === 'google') {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            return lib.errorPage(
                res,
                500,
                'Google Sign-In Is Not Configured Yet',
                'The <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> environment variables are missing on the server.',
                [
                    'Open the <strong>Google Cloud Console</strong> &rarr; APIs &amp; Services &rarr; Credentials and create an <strong>OAuth 2.0 Client ID</strong> (Web application).',
                    `Add <code>${baseUrl}/api/auth/callback/google</code> as an <strong>Authorized redirect URI</strong>.`,
                    'In your Vercel project &rarr; Settings &rarr; Environment Variables, add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code>, then redeploy.'
                ]
            );
        }

        const state = lib.newState();
        const redirectUri = `${baseUrl}/api/auth/callback/google`;

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'openid email profile');
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('access_type', 'online');
        authUrl.searchParams.set('prompt', 'select_account');

        return lib.redirect(res, authUrl.toString(), [
            lib.cookieString(lib.STATE_COOKIE, state, lib.STATE_TTL_SECONDS)
        ]);
    }

    if (provider === 'github') {
        if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
            return lib.errorPage(
                res,
                500,
                'GitHub Sign-In Is Not Configured Yet',
                'The <code>GITHUB_CLIENT_ID</code> and <code>GITHUB_CLIENT_SECRET</code> environment variables are missing on the server.',
                [
                    'Open <strong>GitHub &rarr; Settings &rarr; Developer settings &rarr; OAuth Apps</strong> and create a new OAuth App.',
                    `Set the <strong>Authorization callback URL</strong> to <code>${baseUrl}/api/auth/callback/github</code>.`,
                    'In your Vercel project &rarr; Settings &rarr; Environment Variables, add <code>GITHUB_CLIENT_ID</code> and <code>GITHUB_CLIENT_SECRET</code>, then redeploy.'
                ]
            );
        }

        const state = lib.newState();
        const redirectUri = `${baseUrl}/api/auth/callback/github`;

        const authUrl = new URL('https://github.com/login/oauth/authorize');
        authUrl.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', 'read:user user:email');
        authUrl.searchParams.set('state', state);

        return lib.redirect(res, authUrl.toString(), [
            lib.cookieString(lib.STATE_COOKIE, state, lib.STATE_TTL_SECONDS)
        ]);
    }

    return lib.errorPage(
        res,
        404,
        'Unknown Sign-In Provider',
        `We don't recognise <code>${lib.escapeHtml(provider || '(none)')}</code> as a sign-in provider.`,
        []
    );
};
