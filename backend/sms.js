// sms.js — sends OTP via SMS using Twilio if configured, otherwise logs to
// the console (free, zero setup) so the app is fully usable in development
// without a paid SMS account.
//
// Why Twilio: it's the most reliably documented, works with phone numbers
// worldwide (not India-only), and gives ~$15 in free trial credit on
// signup (enough for a few hundred test OTPs) before you need to pay
// anything. Free trial accounts can only text numbers you've manually
// verified in the Twilio console — that restriction lifts once you add
// billing, which is when you'd be going to real production anyway.
//
// If you'd rather use a free-tier India-specific provider instead (e.g.
// Fast2SMS or MSG91, both offer free signup credits for Indian numbers),
// swap the implementation inside sendOtpSms() below for their HTTP API —
// nothing else in the auth flow needs to change.
const twilio = require('twilio');

const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);

const client = hasTwilio
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

async function sendOtpSms(toPhone, otp) {
    const body = `Your Connectomic Medical Academy verification code is ${otp}. It expires in 10 minutes.`;

    if (client) {
        try {
            await client.messages.create({
                body,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: toPhone
            });
            return { delivered: true };
        } catch (err) {
            console.error('Twilio SMS error:', err?.message || err);
            // Don't fail the calling flow (registration/OTP/reset) just
            // because the SMS provider had a hiccup (unapproved compliance
            // profile, unverified trial number, etc.) -- fall back to the
            // dev-mode console OTP so the user still gets a usable path.
            console.log(`\n📱  [TWILIO SEND FAILED — falling back] OTP for ${toPhone}: ${otp}\n`);
            return { delivered: false };
        }
    }

    // Dev fallback: no Twilio configured, so print it instead of failing.
    console.log(`\n📱  [DEV MODE — no SMS provider configured] OTP for ${toPhone}: ${otp}\n`);
    return { delivered: false };
}

module.exports = { sendOtpSms, hasTwilio };
