// sanitizeNote.js — server-side HTML sanitisation for faculty-authored chapter notes.
//
// Faculty author notes as raw HTML (see server.js: POST/PUT /api/faculty/notes).
// That HTML is later rendered client-side inside an iframe (NoteModal.jsx). Even
// with a locked-down iframe sandbox, we never store or trust unsanitised HTML —
// this is defence in depth, not a substitute for the sandbox fix.
//
// Whitelist approach: allow the tags/attributes a medical note plausibly needs
// (headings, paragraphs, lists, tables, images, links, emphasis, code, basic
// inline styling) and strip everything else, including <script>, <iframe>,
// <object>, <embed>, event handler attributes (onClick etc.), and javascript:
// URLs. sanitize-html strips these by default when not explicitly allowed.
//
// Faculty can also author in Markdown (see FacultyHub.jsx's format toggle) --
// `marked` converts that to HTML first, then the same whitelist sanitiser
// runs over the result, since Markdown can itself contain raw HTML passthrough.

const sanitizeHtml = require('sanitize-html');
const { marked } = require('marked');

const ALLOWED_TAGS = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'a', 'img',
    'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'mark', 'small',
    'code', 'pre', 'blockquote',
    'div', 'span', 'figure', 'figcaption',
];

const ALLOWED_ATTRIBUTES = {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['style', 'class'],
};

// Only allow safe URL schemes for links/images — blocks javascript: and data:
// (other than harmless image data URIs, which sanitize-html's default
// allowedSchemesByTag handles for img).
const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

// Keep inline styling narrow: layout/scripting-relevant CSS (position,
// behavior, external url() references) is stripped; purely cosmetic
// properties pass through.
const ALLOWED_STYLES = {
    '*': {
        'color': [/^.*$/],
        'background-color': [/^.*$/],
        'text-align': [/^.*$/],
        'font-weight': [/^.*$/],
        'font-style': [/^.*$/],
        'text-decoration': [/^.*$/],
    },
};

function sanitizeNoteHtml(html) {
    return sanitizeHtml(html || '', {
        allowedTags: ALLOWED_TAGS,
        allowedAttributes: ALLOWED_ATTRIBUTES,
        allowedSchemes: ALLOWED_SCHEMES,
        allowedSchemesByTag: { img: ['http', 'https', 'data'] },
        allowedStyles: ALLOWED_STYLES,
        allowVulnerableTags: false,
        // Strip disallowed tags but keep their text content (e.g. a stray
        // <script> is removed entirely, including its content, by default
        // nonTextTags behaviour — that's what we want for script/style).
        exclusiveFilter: (frame) => false,
        transformTags: {
            a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
        },
    });
}

// Faculty-facing entry point: content is either raw HTML (format==='html',
// the original behaviour) or Markdown (format==='markdown', the new
// lower-barrier option in FacultyHub's note editor). Either way, what gets
// stored is always sanitised HTML.
function processNoteContent(content, format) {
    const html = format === 'markdown' ? marked.parse(content || '') : (content || '');
    return sanitizeNoteHtml(html);
}

module.exports = { sanitizeNoteHtml, processNoteContent };
