/**
 * CC-GEN OAuth — Start GitHub Sign-In / Sign-Up
 * Route: GET /api/auth/github
 * Redirects the user to GitHub's OAuth authorization screen.
 */

const lib = require('../_lib');

module.exports = async (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;

    if (!clientId || !process.env.GITHUB_CLIENT_SECRET) {
        return lib.errorPage(
            res,
            500,
            'GitHub Sign-In Is Not Configured Yet',
            'The <code>GITHUB_CLIENT_ID</code> and <code>GITHUB_CLIENT_SECRET</code> environment variables are missing on the server.',
            [
                'Open <strong>GitHub &rarr; Settings &rarr; Developer settings &rarr; OAuth Apps</strong> and create a new OAuth App.',
                `Set the <strong>Authorization callback URL</strong> to <code>${lib.getBaseUrl(req)}/api/auth/callback/github</code>.`,
                'In your Vercel project &rarr; Settings &rarr; Environment Variables, add <code>GITHUB_CLIENT_ID</code> and <code>GITHUB_CLIENT_SECRET</code>, then redeploy.'
            ]
        );
    }

    const state = lib.newState();
    const redirectUri = `${lib.getBaseUrl(req)}/api/auth/callback/github`;

    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'read:user user:email');
    authUrl.searchParams.set('state', state);

    lib.redirect(res, authUrl.toString(), [
        lib.cookieString(lib.STATE_COOKIE, state, lib.STATE_TTL_SECONDS)
    ]);
};
