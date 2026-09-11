/**
 * CC-GEN OAuth — Current Session
 * Route: GET /api/auth/session
 * Returns the signed-in user (from the session cookie) as JSON,
 * including the offline Pro state from the signed Pro cookie.
 * (Live subscription verification lives in /api/billing/status.)
 */

const lib = require('../_lib');

module.exports = (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    const session = lib.getSessionFromRequest(req);

    if (!session) {
        res.statusCode = 200;
        return res.end(JSON.stringify({ authenticated: false, user: null }));
    }

    const pro = lib.getProFromRequest(req);

    res.statusCode = 200;
    res.end(
        JSON.stringify({
            authenticated: true,
            user: {
                provider: session.provider,
                name: session.name,
                email: session.email,
                avatar: session.avatar
            },
            pro: pro ? { plan: pro.plan } : false
        })
    );
};
