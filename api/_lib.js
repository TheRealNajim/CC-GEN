/**
 * CC-GEN OAuth Shared Helpers
 * Used by the serverless functions under api/auth/.
 * This file is prefixed with an underscore so Vercel does not
 * expose it as an endpoint — it is bundled into the functions instead.
 */

const crypto = require('crypto');

const SESSION_COOKIE = 'ccgen_session';
const STATE_COOKIE = 'ccgen_oauth_state';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const STATE_TTL_SECONDS = 600; // 10 minutes

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */

function getAuthSecret() {
    return process.env.AUTH_SECRET || '';
}

/* ------------------------------------------------------------------ */
/* Cookies                                                             */
/* ------------------------------------------------------------------ */

function parseCookies(req) {
    const header = req.headers.cookie || '';
    const jar = {};
    header.split(';').forEach((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (key) {
            try {
                jar[key] = decodeURIComponent(value);
            } catch (e) {
                jar[key] = value;
            }
        }
    });
    return jar;
}

function cookieString(name, value, maxAgeSeconds) {
    const parts = [
        `${name}=${encodeURIComponent(value)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${maxAgeSeconds}`
    ];
    // Vercel always serves over HTTPS (and `vercel dev` proxies localhost,
    // which modern browsers treat as a secure context).
    if (process.env.VERCEL) {
        parts.push('Secure');
    }
    return parts.join('; ');
}

function expiredCookie(name) {
    return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/* ------------------------------------------------------------------ */
/* Request origin                                                      */
/* ------------------------------------------------------------------ */

function getBaseUrl(req) {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const proto = getBaseUrlProto(req);
    return `${proto}://${host}`;
}

function getBaseUrlProto(req) {
    if (req && req.headers && req.headers['x-forwarded-proto']) {
        return String(req.headers['x-forwarded-proto']).split(',')[0].trim();
    }
    if (process.env.VERCEL) return 'https';
    return 'http';
}

/* ------------------------------------------------------------------ */
/* OAuth state (CSRF protection)                                       */
/* ------------------------------------------------------------------ */

function newState() {
    return crypto.randomBytes(16).toString('hex');
}

/* ------------------------------------------------------------------ */
/* Signed session tokens (HMAC-SHA256)                                 */
/* ------------------------------------------------------------------ */

function signSession(user) {
    const secret = getAuthSecret();
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        provider: user.provider,
        id: String(user.id || ''),
        name: user.name || 'CC-GEN User',
        email: user.email || null,
        avatar: user.avatar || null,
        iat: now,
        exp: now + SESSION_TTL_SECONDS
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
}

function verifySessionToken(token) {
    if (!token || typeof token !== 'string' || token.indexOf('.') === -1) return null;
    const secret = getAuthSecret();
    if (!secret) return null;

    const [body, sig] = token.split('.');
    if (!body || !sig) return null;

    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (!payload || typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        return payload;
    } catch (e) {
        return null;
    }
}

function getSessionFromRequest(req) {
    const jar = parseCookies(req);
    return verifySessionToken(jar[SESSION_COOKIE]);
}

/* ------------------------------------------------------------------ */
/* Responses                                                           */
/* ------------------------------------------------------------------ */

function redirect(res, location, cookies) {
    if (cookies && cookies.length) {
        res.setHeader('Set-Cookie', cookies);
    }
    res.statusCode = 302;
    res.setHeader('Location', location);
    res.end();
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function errorPage(res, status, title, message, steps) {
    const stepList = (steps || [])
        .map((step) => `<li>${escapeHtml(step)}</li>`)
        .join('');
    const stepsHtml = stepList
        ? `<div class="steps"><h3>How to fix this</h3><ol>${stepList}</ol></div>`
        : '';
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} | CC-GEN</title>
<link rel="icon" type="image/jpeg" href="/Logo%20(1).JPG">
<style>
:root {
    --primary-gradient: linear-gradient(135deg, #EB001B 0%, #F79E1B 100%);
    --bg-page: #F8FAFC; --bg-surface: #FFFFFF;
    --text-heading: #0F172A; --text-body: #334155; --text-muted: #64748B;
    --border-color: #E2E8F0;
}
[data-theme="dark"] {
    --bg-page: #0F172A; --bg-surface: #1E293B;
    --text-heading: #F8FAFC; --text-body: #CBD5E1; --text-muted: #94A3B8;
    --border-color: #334155;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg-page); color: var(--text-body);
    min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
}
.card {
    background: var(--bg-surface); border: 1px solid var(--border-color);
    border-radius: 18px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
    max-width: 520px; width: 100%; padding: 40px; text-align: center;
}
.icon {
    width: 64px; height: 64px; border-radius: 9999px; margin: 0 auto 20px;
    background: var(--primary-gradient); display: flex; align-items: center; justify-content: center;
    font-size: 28px; color: #fff; font-weight: 700;
}
h1 { color: var(--text-heading); font-size: 24px; margin-bottom: 12px; }
p { font-size: 15px; line-height: 1.65; margin-bottom: 8px; }
code {
    font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 13px;
    background: rgba(148,163,184,0.15); padding: 3px 8px; border-radius: 6px; word-break: break-all;
}
.steps { text-align: left; margin-top: 24px; padding: 18px; background: rgba(148,163,184,0.08); border-radius: 12px; }
.steps h3 { font-size: 14px; margin-bottom: 10px; color: var(--text-heading); }
.steps ol { padding-left: 22px; }
.steps li { font-size: 13.5px; line-height: 1.7; margin-bottom: 6px; }
.actions { margin-top: 28px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.actions a {
    text-decoration: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; font-size: 14px;
    border: 1px solid var(--border-color); color: var(--text-body);
}
.actions a.primary {
    background: var(--primary-gradient); border: none; color: #fff;
    box-shadow: 0 10px 30px -5px rgba(235, 0, 27, 0.25);
}
</style>
</head>
<body>
<main class="card">
    <div class="icon">!</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${message}</p>
    ${stepsHtml}
    <div class="actions">
        <a class="primary" href="/sign%20in.html">Back to Sign In</a>
        <a href="/">Go Home</a>
    </div>
</main>
</body>
</html>`;
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(html);
}

module.exports = {
    SESSION_COOKIE,
    STATE_COOKIE,
    SESSION_TTL_SECONDS,
    STATE_TTL_SECONDS,
    parseCookies,
    cookieString,
    expiredCookie,
    getBaseUrl,
    newState,
    signSession,
    verifySessionToken,
    getSessionFromRequest,
    redirect,
    escapeHtml,
    errorPage
};
