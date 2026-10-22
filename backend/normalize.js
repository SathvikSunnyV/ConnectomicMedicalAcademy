// normalize.js — pure identifier-normalisation helpers, used by server.js's
// auth flow (register/login/OTP). Pulled out into their own module so they
// can be unit-tested (see test/normalize.test.js) without importing
// server.js itself, which starts listening on require.
function normalizePhone(phone) {
    if (!phone) return null;
    let cleaned = phone.trim().replace(/[\s\-().]/g, '');
    if (!cleaned) return null;
    if (cleaned.startsWith('+')) return cleaned; // already E.164, e.g. +919876543210
    cleaned = cleaned.replace(/^0+/, ''); // drop a leading trunk 0 (local dialing format)
    if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`; // bare 10-digit -> assume Indian mobile
    if (/^\d{11,15}$/.test(cleaned)) return `+${cleaned}`; // country code already present, just missing '+'
    return cleaned; // unrecognized shape -- let Twilio's own validation surface a clear error
}

function normalizeEmail(email) {
    return email ? email.toLowerCase().trim() : null;
}

module.exports = { normalizePhone, normalizeEmail };
