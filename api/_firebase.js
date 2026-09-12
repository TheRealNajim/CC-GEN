/**
 * CC-GEN Firebase Auth REST Client
 * Email/password accounts via Google's Identity Toolkit REST API —
 * passwords are stored and hashed by Firebase, never touched by our
 * code. Fetch-based, so the project stays dependency-free.
 *
 * This file is prefixed with an underscore so Vercel does not expose
 * it as an endpoint.
 */

const IDENTITY_BASE = 'https://identitytoolkit.googleapis.com/v1';

class FirebaseError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'FirebaseError';
        this.firebaseCode = code || 'UNKNOWN';
    }
}

function isEmailAuthConfigured() {
    return Boolean(process.env.FIREBASE_API_KEY);
}

async function identityRequest(endpoint, payload) {
    const key = process.env.FIREBASE_API_KEY;
    if (!key) {
        throw new FirebaseError('FIREBASE_API_KEY is not configured', 'not_configured');
    }

    let response;
    try {
        response = await fetch(`${IDENTITY_BASE}/${endpoint}?key=${encodeURIComponent(key)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        throw new FirebaseError('Could not reach the Firebase Auth API', 'network_error');
    }

    let data = null;
    try {
        data = await response.json();
    } catch (e) {
        data = null;
    }

    if (!response.ok) {
        const err = (data && data.error) || {};
        const detail =
            (Array.isArray(err.errors) && err.errors[0] && err.errors[0].message) ||
            err.message ||
            `firebase_http_${response.status}`;
        throw new FirebaseError(detail, detail);
    }

    return data;
}

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */

function signUp(email, password) {
    return identityRequest('accounts:signUp', {
        email,
        password,
        returnSecureToken: true
    });
}

function signInWithPassword(email, password) {
    return identityRequest('accounts:signInWithPassword', {
        email,
        password,
        returnSecureToken: true
    });
}

function updateProfile(idToken, displayName) {
    return identityRequest('accounts:update', {
        idToken,
        displayName
    });
}

function lookupAccount(idToken) {
    return identityRequest('accounts:lookup', {
        idToken
    });
}

function sendPasswordReset(email) {
    return identityRequest('accounts:sendOobCode', {
        requestType: 'PASSWORD_RESET',
        email
    });
}

module.exports = {
    FirebaseError,
    isEmailAuthConfigured,
    signUp,
    signInWithPassword,
    updateProfile,
    lookupAccount,
    sendPasswordReset
};
