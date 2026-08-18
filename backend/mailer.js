// mailer.js — sends OTP emails via Brevo (transactional email API), the
// same provider CTK Ignition uses. Falls back to console logging only
// when BREVO_API_KEY is not configured, so the app stays fully usable in
// local/dev environments without a real Brevo account — identical
// fallback behaviour to CTK's auth.js.
const { BrevoClient } = require('@getbrevo/brevo');

const apiKey = (process.env.BREVO_API_KEY || '').trim();

const brevo = new BrevoClient({ apiKey });

async function sendOtpEmail(to, otp, purpose) {
    const subject = purpose === 'reset'
        ? 'Connectomic Medical Academy — Password reset code'
        : 'Connectomic Medical Academy — Verify your account';
    const text = `Your one-time code is ${otp}. It expires in 10 minutes. Do not share this code with anyone.`;
    const html = `<p>Your one-time verification code is:</p>
                  <h2 style="letter-spacing:4px;">${otp}</h2>
                  <p>This code is valid for 10 minutes. Do not share it with anyone.</p>`;

    if (!apiKey) {
        // Dev fallback: no Brevo account configured, so print it instead of failing.
        console.log(`\n📧  [DEV MODE — no BREVO_API_KEY set] OTP for ${to} (${purpose}): ${otp}\n`);
        return { delivered: false };
    }

    try {
        await brevo.transactionalEmails.sendTransacEmail({
            sender: {
                name: process.env.BREVO_SENDER_NAME || 'Connectomic Medical Academy',
                email: process.env.BREVO_SENDER_EMAIL
            },
            to: [{ email: to }],
            subject,
            htmlContent: html,
            textContent: text
        });
        return { delivered: true };
    } catch (err) {
        console.error('Brevo email error:', err?.message || err);
        // Don't fail the calling flow (registration/OTP/reset) just because
        // the email provider had a hiccup — behave like the dev fallback so
        // the user still gets a usable OTP path.
        console.log(`\n📧  [BREVO SEND FAILED — falling back] OTP for ${to} (${purpose}): ${otp}\n`);
        return { delivered: false };
    }
}

module.exports = { sendOtpEmail, hasBrevo: !!apiKey };
