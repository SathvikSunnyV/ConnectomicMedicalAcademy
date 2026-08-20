// server.js — Connectomic Medical Academy API
require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { pool, initSchema } = require('./db');
const { sendOtpEmail } = require('./mailer');
const { sendOtpSms } = require('./sms');
const storage = require('./storage');
const qbank = require('./qbank');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// Multer parses multipart/form-data only -- for a plain JSON request it
// just calls next() without touching req.body, so these routes can accept
// EITHER a JSON body (link-based material) OR a multipart upload (file),
// same endpoint either way. Memory storage since files are streamed
// straight through to R2, never written to local disk.
const uploadDoc = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB — PPT/PDF
const uploadVideo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 1024 } }); // 1GB — lecture video

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// AUTH MIDDLEWARE
// ---------------------------------------------------------------------------
function authenticate(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated.' });
    try {
        req.user = jwt.verify(token, JWT_SECRET); // { id, role, name, impersonatedBy? }
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired session.' });
    }
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Not authorized for this action.' });
        next();
    };
}
function signToken(user) {
    return jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function generateOtp() {
    return String(crypto.randomInt(100000, 999999));
}
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
async function deliverOtp(user, otp) {
    // Phone wins if both are on the account -- that's the channel this app
    // is built around; email is the fallback for phone-less accounts.
    if (user.phone) {
        const { delivered } = await sendOtpSms(user.phone, otp);
        return { channel: 'sms', delivered };
    }
    const { delivered } = await sendOtpEmail(user.email, otp, user.otp_purpose || 'verify');
    return { channel: 'email', delivered };
}

// ---------------------------------------------------------------------------
// AUTH: register (email or phone, at least one) -> verify OTP -> login
// forgot/reset password via OTP, using either identifier
// ---------------------------------------------------------------------------
app.post('/api/register', async (req, res) => {
    const { password, name, role } = req.body;
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);

    if (!name?.trim() || !password) return res.status(400).json({ error: 'Name and password are required.' });
    if (!email && !phone) return res.status(400).json({ error: 'Enter an email or a phone number (at least one is required).' });
    if (phone && phone.replace(/\D/g, '').length < 7) return res.status(400).json({ error: 'Enter a valid phone number.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const finalRole = ['student', 'faculty'].includes(role) ? role : 'student';

    try {
        // Clean up any stale UNVERIFIED accounts that would collide on the
        // email/phone unique constraints -- an unverified account isn't a
        // real account yet, so a fresh registration attempt just replaces it.
        // A VERIFIED match on either field is a genuine conflict.
        const conditions = []; const condParams = [];
        if (email) { condParams.push(email); conditions.push(`email = $${condParams.length}`); }
        if (phone) { condParams.push(phone); conditions.push(`phone = $${condParams.length}`); }
        const { rows: conflicting } = await pool.query(`SELECT id, is_verified FROM users WHERE ${conditions.join(' OR ')}`, condParams);
        if (conflicting.some(r => r.is_verified)) return res.status(409).json({ error: 'An account with this email or phone already exists.' });
        if (conflicting.length) await pool.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [conflicting.map(r => r.id)]);

        const hash = await bcrypt.hash(password, 10);
        const otp = generateOtp();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
        const otpChannel = phone ? 'sms' : 'email';

        const { rows: [user] } = await pool.query(
            `INSERT INTO users (email, phone, password_hash, role, name, otp_code_hash, otp_purpose, otp_channel, otp_expires_at, otp_attempts)
             VALUES ($1,$2,$3,$4,$5,$6,'verify',$7,$8,0) RETURNING *`,
            [email, phone, hash, finalRole, name.trim(), otpHash, otpChannel, expiresAt]
        );

        const { channel, delivered } = await deliverOtp(user, otp);
        res.status(201).json({
            message: `Verification code sent via ${channel === 'sms' ? 'SMS' : 'email'}.`,
            userId: user.id, channel,
            ...(delivered ? {} : { devOtp: otp }) // only present when no real provider is configured
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

app.post('/api/verify-otp', async (req, res) => {
    const { userId, otp } = req.body;
    if (!userId || !otp) return res.status(400).json({ error: 'Missing verification details.' });
    try {
        const { rows: [user] } = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
        if (!user || !user.otp_code_hash || user.otp_purpose !== 'verify')
            return res.status(400).json({ error: 'No pending verification for this account.' });
        if (new Date(user.otp_expires_at) < new Date())
            return res.status(400).json({ error: 'Code expired. Request a new one.' });
        if (user.otp_attempts >= OTP_MAX_ATTEMPTS)
            return res.status(429).json({ error: 'Too many attempts. Request a new code.' });

        const ok = await bcrypt.compare(otp, user.otp_code_hash);
        if (!ok) {
            await pool.query(`UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id=$1`, [userId]);
            return res.status(400).json({ error: 'Incorrect code.' });
        }

        await pool.query(
            `UPDATE users SET is_verified=TRUE, otp_code_hash=NULL, otp_purpose=NULL, otp_channel=NULL, otp_expires_at=NULL, otp_attempts=0 WHERE id=$1`,
            [userId]
        );
        if (user.role === 'faculty') {
            await pool.query(`INSERT INTO faculty (user_id, name) VALUES ($1,$2) ON CONFLICT (user_id) DO NOTHING`, [userId, user.name]);
        }
        res.json({ token: signToken(user), role: user.role, onboardingDone: user.onboarding_done });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error while verifying the code.' });
    }
});

app.post('/api/resend-otp', async (req, res) => {
    const { userId } = req.body;
    try {
        const { rows: [user] } = await pool.query(`SELECT * FROM users WHERE id=$1`, [userId]);
        if (!user || user.is_verified) return res.status(400).json({ error: 'No pending verification for this account.' });

        const otp = generateOtp();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
        const otpChannel = user.phone ? 'sms' : 'email';
        await pool.query(
            `UPDATE users SET otp_code_hash=$1, otp_purpose='verify', otp_channel=$2, otp_expires_at=$3, otp_attempts=0 WHERE id=$4`,
            [otpHash, otpChannel, expiresAt, userId]
        );
        const { channel, delivered } = await deliverOtp({ ...user, otp_purpose: 'verify' }, otp);
        res.json({ message: `Code resent via ${channel === 'sms' ? 'SMS' : 'email'}.`, ...(delivered ? {} : { devOtp: otp }) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error while resending the code.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'Enter your email/phone and password.' });
    const cleaned = identifier.trim();
    const asPhone = normalizePhone(cleaned);
    try {
        const { rows: [match] } = await pool.query(
            `SELECT * FROM users WHERE email = $1 OR phone = $2`, [cleaned.toLowerCase(), asPhone]
        );
        if (!match) return res.status(401).json({ error: 'Invalid credentials.' });
        const ok = await bcrypt.compare(password, match.password_hash);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });
        if (!match.is_verified) return res.status(403).json({ error: 'Please verify your account first.', needsVerification: true, userId: match.id });

        res.json({ token: signToken(match), role: match.role, onboardingDone: match.onboarding_done });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

app.post('/api/forgot-password', async (req, res) => {
    const identifier = (req.body.identifier || '').trim();
    if (!identifier) return res.json({ message: 'If that account exists, a reset code has been sent.' });
    try {
        const { rows: [user] } = await pool.query(
            `SELECT * FROM users WHERE email = $1 OR phone = $2`,
            [identifier.toLowerCase(), normalizePhone(identifier)]
        );
        if (!user) return res.json({ message: 'If that account exists, a reset code has been sent.' }); // don't reveal existence

        const otp = generateOtp();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
        const otpChannel = user.phone ? 'sms' : 'email';
        await pool.query(
            `UPDATE users SET otp_code_hash=$1, otp_purpose='reset', otp_channel=$2, otp_expires_at=$3, otp_attempts=0 WHERE id=$4`,
            [otpHash, otpChannel, expiresAt, user.id]
        );
        const { delivered } = await deliverOtp({ ...user, otp_purpose: 'reset' }, otp);
        res.json({ message: 'If that account exists, a reset code has been sent.', userId: user.id, ...(delivered ? {} : { devOtp: otp }) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error while requesting a reset code.' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { userId, otp, newPassword } = req.body;
    if (!userId || !otp || !newPassword) return res.status(400).json({ error: 'Missing reset details.' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    try {
        const { rows: [user] } = await pool.query(`SELECT * FROM users WHERE id=$1`, [userId]);
        if (!user || !user.otp_code_hash || user.otp_purpose !== 'reset')
            return res.status(400).json({ error: 'No pending reset for this account.' });
        if (new Date(user.otp_expires_at) < new Date())
            return res.status(400).json({ error: 'Code expired. Request a new one.' });
        if (user.otp_attempts >= OTP_MAX_ATTEMPTS)
            return res.status(429).json({ error: 'Too many attempts. Request a new code.' });

        const ok = await bcrypt.compare(otp, user.otp_code_hash);
        if (!ok) {
            await pool.query(`UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id=$1`, [userId]);
            return res.status(400).json({ error: 'Incorrect code.' });
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await pool.query(
            `UPDATE users SET password_hash=$1, otp_code_hash=NULL, otp_purpose=NULL, otp_channel=NULL, otp_expires_at=NULL, otp_attempts=0 WHERE id=$2`,
            [newHash, userId]
        );
        res.json({ message: 'Password updated. You can log in now.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error while resetting the password.' });
    }
});

app.get('/api/me', authenticate, async (req, res) => {
    try {
        const { rows: [user] } = await pool.query(
            `SELECT id, email, phone, role, name, onboarding_done FROM users WHERE id = $1`, [req.user.id]
        );
        if (!user) return res.status(404).json({ error: 'User not found.' });
        let profile = null;
        if (user.role === 'student') {
            profile = (await pool.query(`SELECT * FROM students WHERE user_id = $1`, [user.id])).rows[0];
        } else if (user.role === 'faculty') {
            profile = (await pool.query(`SELECT * FROM faculty WHERE user_id = $1`, [user.id])).rows[0];
        }
        res.json({ user, profile, impersonating: !!req.user.impersonatedBy });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------------------------------------------------------------------------
// STUDENT ONBOARDING
// ---------------------------------------------------------------------------
app.post('/api/onboarding', authenticate, requireRole('student'), async (req, res) => {
    const { phase, state, dailyStudyHours } = req.body;
    try {
        const { rows: [existing] } = await pool.query(`SELECT user_id FROM students WHERE user_id = $1`, [req.user.id]);
        if (existing) {
            await pool.query(`UPDATE students SET phase=$1, state=$2, daily_study_hours=$3 WHERE user_id=$4`,
                [phase || null, state || null, dailyStudyHours || null, req.user.id]);
        } else {
            await pool.query(`INSERT INTO students (user_id, name, phase, state, daily_study_hours) VALUES ($1,$2,$3,$4,$5)`,
                [req.user.id, req.user.name, phase || null, state || null, dailyStudyHours || null]);
        }
        await pool.query(`UPDATE users SET onboarding_done = TRUE WHERE id = $1`, [req.user.id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during onboarding.' });
    }
});

// ---------------------------------------------------------------------------
// SECTIONS / BOOKS / CHAPTERS — browsing (any authenticated user)
// ---------------------------------------------------------------------------
app.get('/api/sections', authenticate, async (req, res) => {
    try {
        res.json((await pool.query(`SELECT id, name, position FROM sections ORDER BY position`)).rows);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while listing sections.' }); }
});

app.get('/api/sections/:id/books', authenticate, async (req, res) => {
    try {
        res.json((await pool.query(
            `SELECT id, section_id, type, title, description, position FROM books WHERE section_id = $1 ORDER BY position`,
            [req.params.id]
        )).rows);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while listing books.' }); }
});

app.get('/api/sections/:id/chapters', authenticate, async (req, res) => {
    try {
        res.json((await pool.query(
            `SELECT id, section_id, name, position FROM chapters WHERE section_id = $1 ORDER BY position`,
            [req.params.id]
        )).rows);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while listing chapters.' }); }
});

app.get('/api/books/:bookId/chapters/:chapterId', authenticate, async (req, res) => {
    const { bookId, chapterId } = req.params;
    try {
        const [{ rows: notes }, { rows: materials }, { rows: lectures }, { rows: [chapter] }] = await Promise.all([
            pool.query(`SELECT id, title, html_content, position FROM chapter_notes WHERE chapter_id=$1 AND book_id=$2 ORDER BY position, created_at`, [chapterId, bookId]),
            pool.query(`SELECT id, title, material_type, external_url, description FROM materials WHERE chapter_id=$1 AND book_id=$2 ORDER BY created_at`, [chapterId, bookId]),
            pool.query(`SELECT id, title, url FROM lectures WHERE chapter_id=$1 AND book_id=$2 ORDER BY created_at`, [chapterId, bookId]),
            pool.query(`SELECT id, name, section_id FROM chapters WHERE id=$1`, [chapterId])
        ]);
        res.json({ chapter, notes, materials, lectures });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while loading chapter content.' }); }
});

app.get('/api/books/:bookId/general', authenticate, async (req, res) => {
    try {
        const [{ rows: materials }, { rows: lectures }] = await Promise.all([
            pool.query(`SELECT id, title, material_type, external_url, description FROM materials WHERE book_id=$1 AND chapter_id IS NULL ORDER BY created_at`, [req.params.bookId]),
            pool.query(`SELECT id, title, url FROM lectures WHERE book_id=$1 AND chapter_id IS NULL ORDER BY created_at`, [req.params.bookId])
        ]);
        res.json({ materials, lectures });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while loading book resources.' }); }
});

// ---------------------------------------------------------------------------
// FACULTY: sections / books / chapters — the dropdowns faculty organize
// content under. Full CRUD so faculty aren't stuck with only the seeded
// curriculum. No approval workflow here (unlike question bank) -- this is
// structural content, not exam content.
// ---------------------------------------------------------------------------
app.post('/api/faculty/sections', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
    const { name, position } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Section name is required.' });
    try {
        const { rows: [section] } = await pool.query(
            `INSERT INTO sections (name, position, created_by) VALUES ($1,$2,$3) RETURNING *`,
            [name.trim(), position || 0, req.user.id]
        );
        res.status(201).json({ success: true, section });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'A subject with this name already exists.' });
        console.error(err); res.status(500).json({ error: 'Server error while creating the subject.' });
    }
});

app.put('/api/faculty/sections/:id', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
    const { name, position } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Section name is required.' });
    try {
        const { rows: [section] } = await pool.query(
            `UPDATE sections SET name=$1, position=COALESCE($2, position) WHERE id=$3 RETURNING *`,
            [name.trim(), position, req.params.id]
        );
        if (!section) return res.status(404).json({ error: 'Subject not found.' });
        res.json({ success: true, section });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'A subject with this name already exists.' });
        console.error(err); res.status(500).json({ error: 'Server error while updating the subject.' });
    }
});

app.delete('/api/faculty/sections/:id', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
    try {
        // Cascades to that subject's books/chapters/notes/materials/lectures/
        // question bank/generated tests via existing FK ON DELETE CASCADE.
        await pool.query(`DELETE FROM sections WHERE id=$1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while deleting the subject.' }); }
});

app.post('/api/faculty/books', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
    const { sectionId, type, title, description, position } = req.body;
    if (!sectionId || !['mbbs', 'reference'].includes(type) || !title?.trim())
        return res.status(400).json({ error: 'Subject, type (mbbs/reference) and title are required.' });
    try {
        const { rows: [book] } = await pool.query(
            `INSERT INTO books (section_id, type, title, description, position, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [sectionId, type, title.trim(), description || null, position || 0, req.user.id]
        );
        res.status(201).json({ success: true, book });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while creating the book.' }); }
});

app.put('/api/faculty/books/:id', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
    const { title, description, position } = req.body;
    try {
        const { rows: [book] } = await pool.query(
            `UPDATE books SET title=COALESCE($1,title), description=$2, position=COALESCE($3,position) WHERE id=$4 RETURNING *`,
            [title?.trim(), description, position, req.params.id]
        );
        if (!book) return res.status(404).json({ error: 'Book not found.' });
        res.json({ success: true, book });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while updating the book.' }); }
});

app.delete('/api/faculty/books/:id', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
    try {
        await pool.query(`DELETE FROM books WHERE id=$1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while deleting the book.' }); }
});

app.post('/api/faculty/chapters', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
    const { sectionId, name, position } = req.body;
    if (!sectionId || !name?.trim()) return res.status(400).json({ error: 'Subject and chapter name are required.' });
    try {
        const { rows: [chapter] } = await pool.query(
            `INSERT INTO chapters (section_id, name, position, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
            [sectionId, name.trim(), position || 0, req.user.id]
        );
        res.status(201).json({ success: true, chapter });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'A chapter with this name already exists in this subject.' });
        console.error(err); res.status(500).json({ error: 'Server error while creating the chapter.' });
    }
});

app.put('/api/faculty/chapters/:id', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
    const { name, position } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Chapter name is required.' });
    try {
        const { rows: [chapter] } = await pool.query(
            `UPDATE chapters SET name=$1, position=COALESCE($2,position) WHERE id=$3 RETURNING *`,
            [name.trim(), position, req.params.id]
        );
        if (!chapter) return res.status(404).json({ error: 'Chapter not found.' });
        res.json({ success: true, chapter });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'A chapter with this name already exists in this subject.' });
        console.error(err); res.status(500).json({ error: 'Server error while updating the chapter.' });
    }
});

app.delete('/api/faculty/chapters/:id', authenticate, requireRole('faculty', 'admin'), async (req, res) => {
    try {
        // Cascades to notes/materials/lectures/question bank rows tied to
        // this chapter via existing FK ON DELETE CASCADE / SET NULL.
        await pool.query(`DELETE FROM chapters WHERE id=$1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while deleting the chapter.' }); }
});

// ---------------------------------------------------------------------------
// FACULTY: chapter notes — full CRUD + "my content" listing for management
// ---------------------------------------------------------------------------
app.get('/api/faculty/notes/mine', authenticate, requireRole('faculty'), async (req, res) => {
    try {
        res.json((await pool.query(
            `SELECT n.*, c.name AS chapter_name, b.title AS book_title, s.name AS section_name
             FROM chapter_notes n
             JOIN chapters c ON c.id = n.chapter_id
             JOIN books b ON b.id = n.book_id
             JOIN sections s ON s.id = c.section_id
             WHERE n.created_by = $1 ORDER BY n.created_at DESC`,
            [req.user.id]
        )).rows);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while listing your notes.' }); }
});

app.post('/api/faculty/notes', authenticate, requireRole('faculty'), async (req, res) => {
    const { chapterId, bookId, title, htmlContent } = req.body;
    if (!chapterId || !bookId || !title?.trim() || !htmlContent?.trim())
        return res.status(400).json({ error: 'Chapter, book, title and HTML content are required.' });
    try {
        const { rows: [maxPos] } = await pool.query(
            `SELECT COALESCE(MAX(position), -1) AS max_pos FROM chapter_notes WHERE chapter_id=$1 AND book_id=$2`, [chapterId, bookId]
        );
        const { rows: [note] } = await pool.query(
            `INSERT INTO chapter_notes (chapter_id, book_id, title, html_content, position, created_by)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [chapterId, bookId, title.trim(), htmlContent, parseInt(maxPos.max_pos, 10) + 1, req.user.id]
        );
        res.status(201).json({ success: true, note });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while saving the note.' }); }
});

app.put('/api/faculty/notes/:id', authenticate, requireRole('faculty'), async (req, res) => {
    const { title, htmlContent } = req.body;
    try {
        const { rows: [note] } = await pool.query(
            `UPDATE chapter_notes SET title=$1, html_content=$2, updated_at=NOW() WHERE id=$3 AND created_by=$4 RETURNING *`,
            [title, htmlContent, req.params.id, req.user.id]
        );
        if (!note) return res.status(404).json({ error: 'Note not found.' });
        res.json({ success: true, note });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while updating the note.' }); }
});

app.delete('/api/faculty/notes/:id', authenticate, requireRole('faculty'), async (req, res) => {
    try {
        await pool.query(`DELETE FROM chapter_notes WHERE id=$1 AND created_by=$2`, [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while deleting the note.' }); }
});

// ---------------------------------------------------------------------------
// FACULTY: materials — full CRUD + "my content" listing
// ---------------------------------------------------------------------------
app.get('/api/faculty/materials/mine', authenticate, requireRole('faculty'), async (req, res) => {
    try {
        res.json((await pool.query(
            `SELECT m.*, c.name AS chapter_name, b.title AS book_title, s.name AS section_name
             FROM materials m
             JOIN books b ON b.id = m.book_id
             JOIN sections s ON s.id = b.section_id
             LEFT JOIN chapters c ON c.id = m.chapter_id
             WHERE m.uploaded_by = $1 ORDER BY m.created_at DESC`,
            [req.user.id]
        )).rows);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while listing your materials.' }); }
});

app.post('/api/faculty/materials', authenticate, requireRole('faculty'), uploadDoc.single('file'), async (req, res) => {
    const { bookId, chapterId, title, materialType, externalUrl, description } = req.body;
    if (!bookId || !title?.trim()) return res.status(400).json({ error: 'Book and title are required.' });
    if (!req.file && !externalUrl?.trim()) return res.status(400).json({ error: 'Provide either a file to upload or a link.' });

    try {
        let sourceType, finalUrl, storageKey = null, fileSizeBytes = null;
        if (req.file) {
            const uploaded = await storage.uploadFile({
                folder: 'materials', buffer: req.file.buffer,
                originalName: req.file.originalname, contentType: req.file.mimetype
            });
            sourceType = 'file'; finalUrl = uploaded.url; storageKey = uploaded.key; fileSizeBytes = req.file.size;
        } else {
            sourceType = 'link'; finalUrl = externalUrl.trim();
        }
        const { rows: [material] } = await pool.query(
            `INSERT INTO materials (book_id, chapter_id, title, material_type, external_url, description, uploaded_by, source_type, storage_key, file_size_bytes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [bookId, chapterId || null, title.trim(), materialType || 'link', finalUrl, description || null, req.user.id, sourceType, storageKey, fileSizeBytes]
        );
        res.status(201).json({ success: true, material });
    } catch (err) {
        if (err.code === 'STORAGE_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
        console.error(err); res.status(500).json({ error: 'Server error while saving the material.' });
    }
});

app.put('/api/faculty/materials/:id', authenticate, requireRole('faculty'), uploadDoc.single('file'), async (req, res) => {
    const { title, materialType, externalUrl, description } = req.body;
    try {
        const { rows: [existing] } = await pool.query(`SELECT * FROM materials WHERE id=$1 AND uploaded_by=$2`, [req.params.id, req.user.id]);
        if (!existing) return res.status(404).json({ error: 'Material not found.' });

        let sourceType = existing.source_type, finalUrl = existing.external_url,
            storageKey = existing.storage_key, fileSizeBytes = existing.file_size_bytes;
        if (req.file) {
            const uploaded = await storage.uploadFile({
                folder: 'materials', buffer: req.file.buffer,
                originalName: req.file.originalname, contentType: req.file.mimetype
            });
            if (existing.storage_key) await storage.deleteFile(existing.storage_key); // replace, don't leak the old object
            sourceType = 'file'; finalUrl = uploaded.url; storageKey = uploaded.key; fileSizeBytes = req.file.size;
        } else if (externalUrl?.trim() && externalUrl.trim() !== existing.external_url) {
            if (existing.storage_key) await storage.deleteFile(existing.storage_key); // switching from file to link
            sourceType = 'link'; finalUrl = externalUrl.trim(); storageKey = null; fileSizeBytes = null;
        }

        const { rows: [material] } = await pool.query(
            `UPDATE materials SET title=$1, material_type=$2, external_url=$3, description=$4, source_type=$5, storage_key=$6, file_size_bytes=$7
             WHERE id=$8 AND uploaded_by=$9 RETURNING *`,
            [title || existing.title, materialType || existing.material_type, finalUrl, description ?? existing.description,
             sourceType, storageKey, fileSizeBytes, req.params.id, req.user.id]
        );
        res.json({ success: true, material });
    } catch (err) {
        if (err.code === 'STORAGE_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
        console.error(err); res.status(500).json({ error: 'Server error while updating the material.' });
    }
});

app.delete('/api/faculty/materials/:id', authenticate, requireRole('faculty'), async (req, res) => {
    try {
        const { rows: [material] } = await pool.query(
            `DELETE FROM materials WHERE id=$1 AND uploaded_by=$2 RETURNING storage_key`, [req.params.id, req.user.id]
        );
        if (material?.storage_key) await storage.deleteFile(material.storage_key);
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while deleting the material.' }); }
});

// ---------------------------------------------------------------------------
// FACULTY: lecture videos — full CRUD + "my content" listing
// ---------------------------------------------------------------------------
app.get('/api/faculty/lectures/mine', authenticate, requireRole('faculty'), async (req, res) => {
    try {
        res.json((await pool.query(
            `SELECT l.*, c.name AS chapter_name, b.title AS book_title, s.name AS section_name
             FROM lectures l
             JOIN books b ON b.id = l.book_id
             JOIN sections s ON s.id = b.section_id
             LEFT JOIN chapters c ON c.id = l.chapter_id
             WHERE l.uploaded_by = $1 ORDER BY l.created_at DESC`,
            [req.user.id]
        )).rows);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while listing your lectures.' }); }
});

app.post('/api/faculty/lectures', authenticate, requireRole('faculty'), uploadVideo.single('file'), async (req, res) => {
    const { bookId, chapterId, title } = req.body;
    if (!bookId || !title?.trim()) return res.status(400).json({ error: 'Book and title are required.' });
    if (!req.file) return res.status(400).json({ error: 'Lecture videos must be uploaded as a file (CDN-hosted only) -- links are not accepted.' });
    try {
        const uploaded = await storage.uploadFile({
            folder: 'lectures', buffer: req.file.buffer,
            originalName: req.file.originalname, contentType: req.file.mimetype
        });
        const { rows: [lecture] } = await pool.query(
            `INSERT INTO lectures (book_id, chapter_id, title, url, uploaded_by, storage_key, file_size_bytes)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [bookId, chapterId || null, title.trim(), uploaded.url, req.user.id, uploaded.key, req.file.size]
        );
        res.status(201).json({ success: true, lecture });
    } catch (err) {
        if (err.code === 'STORAGE_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
        console.error(err); res.status(500).json({ error: 'Server error while saving the lecture.' });
    }
});

app.put('/api/faculty/lectures/:id', authenticate, requireRole('faculty'), uploadVideo.single('file'), async (req, res) => {
    const { title } = req.body;
    try {
        const { rows: [existing] } = await pool.query(`SELECT * FROM lectures WHERE id=$1 AND uploaded_by=$2`, [req.params.id, req.user.id]);
        if (!existing) return res.status(404).json({ error: 'Lecture not found.' });

        let url = existing.url, storageKey = existing.storage_key, fileSizeBytes = existing.file_size_bytes;
        if (req.file) {
            const uploaded = await storage.uploadFile({
                folder: 'lectures', buffer: req.file.buffer,
                originalName: req.file.originalname, contentType: req.file.mimetype
            });
            if (existing.storage_key) await storage.deleteFile(existing.storage_key); // replace, don't leak the old object
            url = uploaded.url; storageKey = uploaded.key; fileSizeBytes = req.file.size;
        }
        const { rows: [lecture] } = await pool.query(
            `UPDATE lectures SET title=$1, url=$2, storage_key=$3, file_size_bytes=$4 WHERE id=$5 AND uploaded_by=$6 RETURNING *`,
            [title || existing.title, url, storageKey, fileSizeBytes, req.params.id, req.user.id]
        );
        res.json({ success: true, lecture });
    } catch (err) {
        if (err.code === 'STORAGE_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
        console.error(err); res.status(500).json({ error: 'Server error while updating the lecture.' });
    }
});

app.delete('/api/faculty/lectures/:id', authenticate, requireRole('faculty'), async (req, res) => {
    try {
        const { rows: [lecture] } = await pool.query(
            `DELETE FROM lectures WHERE id=$1 AND uploaded_by=$2 RETURNING storage_key`, [req.params.id, req.user.id]
        );
        if (lecture?.storage_key) await storage.deleteFile(lecture.storage_key);
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while deleting the lecture.' }); }
});

// ---------------------------------------------------------------------------
// ADMIN: students / faculty management with search, stats, impersonation
// ---------------------------------------------------------------------------
app.get('/api/admin/stats', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { rows: [u] } = await pool.query(`SELECT
            COUNT(*) FILTER (WHERE role='student') AS students,
            COUNT(*) FILTER (WHERE role='faculty') AS faculty,
            COUNT(*) FILTER (WHERE role='student' AND is_verified) AS verified_students
            FROM users`);
        const { rows: [n] } = await pool.query(`SELECT COUNT(*) AS total FROM chapter_notes`);
        const { rows: [m] } = await pool.query(`SELECT COUNT(*) AS total FROM materials`);
        const { rows: [l] } = await pool.query(`SELECT COUNT(*) AS total FROM lectures`);
        res.json({
            students: parseInt(u.students, 10), faculty: parseInt(u.faculty, 10),
            verifiedStudents: parseInt(u.verified_students, 10),
            notes: parseInt(n.total, 10), materials: parseInt(m.total, 10), lectures: parseInt(l.total, 10)
        });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while loading stats.' }); }
});

app.get('/api/admin/students', authenticate, requireRole('admin'), async (req, res) => {
    const { search } = req.query;
    try {
        const { rows } = await pool.query(
            `SELECT u.id, u.email, u.phone, u.name, u.is_verified, u.created_at, s.phase, s.state
             FROM users u LEFT JOIN students s ON s.user_id = u.id
             WHERE u.role='student' AND ($1::text IS NULL OR u.name ILIKE '%'||$1||'%' OR u.email ILIKE '%'||$1||'%' OR u.phone ILIKE '%'||$1||'%')
             ORDER BY u.created_at DESC`,
            [search || null]
        );
        res.json(rows);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while listing students.' }); }
});

app.get('/api/admin/faculty', authenticate, requireRole('admin'), async (req, res) => {
    const { search } = req.query;
    try {
        const { rows } = await pool.query(
            `SELECT u.id, u.email, u.phone, u.name, u.is_verified, u.created_at, f.specialization
             FROM users u LEFT JOIN faculty f ON f.user_id = u.id
             WHERE u.role='faculty' AND ($1::text IS NULL OR u.name ILIKE '%'||$1||'%' OR u.email ILIKE '%'||$1||'%' OR u.phone ILIKE '%'||$1||'%')
             ORDER BY u.created_at DESC`,
            [search || null]
        );
        res.json(rows);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while listing faculty.' }); }
});

app.delete('/api/admin/users/:id', authenticate, requireRole('admin'), async (req, res) => {
    try {
        await pool.query(`DELETE FROM users WHERE id=$1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while deleting the user.' }); }
});

app.post('/api/admin/impersonate/:id', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { rows: [target] } = await pool.query(`SELECT * FROM users WHERE id=$1`, [req.params.id]);
        if (!target) return res.status(404).json({ error: 'User not found.' });
        const token = jwt.sign(
            { id: target.id, role: target.role, name: target.name, impersonatedBy: req.user.id },
            JWT_SECRET, { expiresIn: '2h' }
        );
        res.json({ token, role: target.role, name: target.name });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error while starting impersonation.' }); }
});

// ---------------------------------------------------------------------------
// TEST ENGINE — question bank, chapter/subject/grand tests, progress
// ---------------------------------------------------------------------------
app.use(qbank.init({ pool, authenticate, requireRole }));

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'Connectomic Medical Academy' }));

// SPA fallback: any non-API GET (e.g. a direct load or refresh on /tests,
// /progress, /sections/3, etc.) serves the built index.html so React
// Router can take over client-side, instead of a bare 404.
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 4100;
initSchema()
    .then(() => app.listen(PORT, () => console.log(`🚀  Connectomic Medical Academy running on http://localhost:${PORT}`)))
    .catch(err => { console.error('Failed to initialise database:', err); process.exit(1); });