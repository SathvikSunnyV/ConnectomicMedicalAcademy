// storage.js — Cloudflare R2 file storage for faculty uploads (reference
// books/PPTs and lecture videos). R2 is S3-compatible, so this uses the
// standard AWS S3 SDK pointed at R2's endpoint. Shares the same bucket
// the app's existing "Seven Hills" welcome videos already live in
// (see frontend/src/pages/Welcome.jsx for that public base URL).
//
// Required env vars:
//   R2_ACCOUNT_ID          — Cloudflare account ID (R2 → Overview page)
//   R2_ACCESS_KEY_ID       — from an R2 API token (Object Read & Write)
//   R2_SECRET_ACCESS_KEY   — from the same R2 API token
//   R2_BUCKET_NAME         — the actual bucket name
//   R2_PUBLIC_URL_BASE     — the bucket's public base URL, e.g.
//                            https://pub-xxxxxxxx.r2.dev (no trailing slash)
// If any of these are missing, uploads are refused with a clear error
// instead of silently failing later -- unlike email/SMS OTP, there's no
// safe "dev fallback" for a file that must actually be stored somewhere.
const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME;
const publicUrlBase = (process.env.R2_PUBLIC_URL_BASE || '').replace(/\/+$/, '');

const isConfigured = !!(accountId && accessKeyId && secretAccessKey && bucket && publicUrlBase);

const client = isConfigured
    ? new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey }
    })
    : null;

function safeFilename(originalName) {
    return (originalName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
}

// folder: 'materials' | 'lectures' — keeps the bucket organized and lets
// callers scope key prefixes if they ever want to.
function buildKey(folder, originalName) {
    return `${folder}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeFilename(originalName)}`;
}

async function uploadFile({ folder, buffer, originalName, contentType }) {
    if (!isConfigured) {
        const err = new Error(
            'File uploads are not configured yet. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, ' +
            'R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_PUBLIC_URL_BASE in backend/.env.'
        );
        err.code = 'STORAGE_NOT_CONFIGURED';
        throw err;
    }
    const key = buildKey(folder, originalName);
    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream'
    }));
    return { key, url: `${publicUrlBase}/${key}` };
}

// Best-effort delete -- never throw. Losing track of an orphaned object in
// the bucket is a much smaller problem than a 500 on an otherwise-successful
// database delete.
async function deleteFile(key) {
    if (!isConfigured || !key) return;
    try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (err) {
        console.error('R2 delete failed (continuing anyway):', err?.message || err);
    }
}

module.exports = { uploadFile, deleteFile, isConfigured };