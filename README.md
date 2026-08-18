# Connectomic Medical Academy

A pre-clinical MBBS learning platform — **Anatomy, Physiology, Biochemistry,
Neuroscience** — each split into two tracks:

1. **MBBS Level** — core chapter-wise teaching content (notes, materials, lecture videos)
2. **Reference & Resources** — reference book material, PPTs and videos

The public Welcome page carries Prof. Konuri's Seven Hills videos, playable by anyone without logging in.

**No test/quiz engine in this pass** — by request, this build is scoped to full auth + full content management. See "What's not here yet" below.

## Stack

- **Backend:** Node.js + Express + PostgreSQL, JWT auth, OTP email verification (`nodemailer`, with a console-log dev fallback when no SMTP is configured)
- **Frontend:** **React + Vite** (not a single HTML file) — chosen because this is a CRUD-heavy, multi-role app (student/faculty/admin, each with several forms and panels) that will keep growing; a component-based structure with routing is far more maintainable here than one large hand-rolled `app.js`, which is exactly the kind of file that gets painful to work in as a platform like this grows.

## Theme

Deliberately not the usual medical blue/white/green. Warm ivory paper + a
muted burgundy/plum accent — an anatomical-atlas feel (old textbook paper +
engraved-plate ink) rather than a clinical app. Colors live as CSS variables
in `frontend/src/index.css` if you want to adjust them.

## Setup

**Backend:**
```bash
cd backend
npm install
cp .env.example .env   # edit DATABASE_URL, JWT_SECRET, and optionally SMTP_*
npm start
```

**Frontend (development):**
```bash
cd frontend
npm install
npm run dev             # http://localhost:5173, proxies /api to :4100
```

**Frontend (production):**
```bash
cd frontend
npm run build            # outputs to frontend/dist
```
Then just run the backend (`npm start` in `backend/`) — it serves `frontend/dist` directly at the same origin, so open **http://localhost:4100** and there's nothing else to run.

On first startup the schema is created and seeded automatically:
- 4 sections (Anatomy, Physiology, Biochemistry, Neuroscience), each with its 2 books and 6 chapters
- 1 default admin login: `admin@connectomicmedical.local` / `ChangeMe123!` — **change this immediately**

## Auth flow

Register with **either an email or a phone number — at least one is
required, not both.** Register → OTP sent → verify → logged in. Same for
password reset. Whichever contact method exists on the account is where
the OTP goes: **phone gets an SMS code, email-only accounts get an email
code.**

SMS delivery uses **Twilio** (`backend/sms.js`) — the most reliably
documented option, and it works with phone numbers worldwide rather than
one country. Sign up at twilio.com for ~$15 free trial credit (enough for
a few hundred test OTPs); trial accounts can only text numbers you've
manually verified in the Twilio console, a restriction that lifts once
you add billing. Set `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` /
`TWILIO_PHONE_NUMBER` in `.env` to enable it.

Prefer a free-tier India-specific provider instead? Fast2SMS and MSG91
both give free signup credits for Indian numbers — swap the
implementation inside `sendOtpSms()` in `backend/sms.js` for their HTTP
API; nothing else in the auth flow needs to change.

**With no SMS/email provider configured at all**, OTPs are printed to the
server console and echoed in the API response (clearly marked "dev
mode") — the whole flow works for free, zero setup, for development.

Admins log in from a separate page (`/admin-login`, linked only in the
footer when logged out) rather than the main Login page.

## Data model note

Since an account can be phone-only or email-only, `users.email` and
`users.phone` are both nullable + unique, with a `CHECK` constraint
requiring at least one of them. Every user is identified by a synthetic
`id` throughout the app (JWT payload, foreign keys, admin actions) rather
than by email, since email may not exist on a given account.

## Admin console

- Search + list students and faculty separately
- Delete any account
- **"View as" impersonation** — opens the target user's exact view, with a
  persistent banner and one-click exit back to the admin's own session
  (the admin's token is stashed locally while impersonating, not discarded)
- Top-line stats (students, verified count, faculty, notes/materials/lectures totals)

## Content model

```
Section (Anatomy / Physiology / Biochemistry / Neuroscience)
 ├─ Book: MBBS Level
 │   └─ Chapters (shared list per section)
 │       ├─ Notes (faculty-authored HTML, sandboxed fullscreen iframe)
 │       ├─ Materials (links / PPTs / reference books)
 │       └─ Lecture videos
 └─ Book: Reference & Resources
     └─ Chapters (same list)
         ├─ Reference materials / PPTs
         └─ Videos
```

Chapters belong to the **section**, not to one book, so the same chapter
map organises both tracks — only the content underneath differs. Faculty
manage all of this themselves from the Faculty Hub (add/edit/delete their
own notes, materials, and lectures — each attached to a specific chapter,
or left at "whole book" for general resources).

## What's not here yet

Called out explicitly so nothing is a surprise:

- **No test/quiz/question-bank engine** — dropped from scope on purpose for this pass. The old version of this project had a simple per-chapter quiz feature; if you want it back, it's a small, self-contained addition (a `question_bank` table + a couple of endpoints) that doesn't touch anything else here.
- **No file uploads to disk/CDN** — materials and lectures are external links, matching the "paste a URL" pattern the CTK Bridge Course platform already uses.
- **No AI-assisted recommendation features.**
