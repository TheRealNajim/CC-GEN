/**
 * CC-GEN OAuth — Sign Out
 * Route: GET /api/auth/logout
 * Clears the session cookie and redirects back to the sign-in page.
 */

const lib = require('../_lib');

module.exports = (req, res) => {
    lib.redirect(res, '/sign%20in.html', [lib.expiredCookie(lib.SESSION_COOKIE)]);
};
