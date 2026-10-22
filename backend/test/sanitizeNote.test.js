const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeNoteHtml, processNoteContent } = require('../sanitizeNote');

test('sanitizeNoteHtml: strips <script> tags entirely', () => {
    const out = sanitizeNoteHtml('<p>Hello</p><script>alert(1)</script>');
    assert.ok(!out.includes('script'));
    assert.ok(out.includes('Hello'));
});

test('sanitizeNoteHtml: strips inline event handler attributes', () => {
    const out = sanitizeNoteHtml('<img src="x" onerror="alert(1)">');
    assert.ok(!out.includes('onerror'));
});

test('sanitizeNoteHtml: strips javascript: URLs from links', () => {
    const out = sanitizeNoteHtml('<a href="javascript:alert(1)">click</a>');
    assert.ok(!out.includes('javascript:'));
});

test('sanitizeNoteHtml: strips iframe/object/embed tags', () => {
    const out = sanitizeNoteHtml('<iframe src="//evil.example"></iframe><object data="x"></object><embed src="x">');
    assert.ok(!/iframe|object|embed/i.test(out));
});

test('sanitizeNoteHtml: keeps legitimate formatting', () => {
    const out = sanitizeNoteHtml('<h2>Cardiac Cycle</h2><p>The cycle has <b>two</b> phases.</p><table><tr><td>Systole</td></tr></table>');
    assert.ok(out.includes('<h2>Cardiac Cycle</h2>'));
    assert.ok(out.includes('<b>two</b>'));
    assert.ok(out.includes('<table>'));
});

test('processNoteContent: converts Markdown to sanitised HTML', () => {
    const out = processNoteContent('# Title\n\n**bold** text', 'markdown');
    assert.ok(out.includes('<h1>Title</h1>'));
    assert.ok(out.includes('<strong>bold</strong>'));
});

test('processNoteContent: Markdown input still gets malicious HTML stripped', () => {
    const out = processNoteContent('Some text <script>alert(1)</script>', 'markdown');
    assert.ok(!out.includes('script'));
});

test('processNoteContent: format "html" (or omitted) treats input as raw HTML, unchanged behaviour', () => {
    const out = processNoteContent('<p>Plain HTML</p>', 'html');
    assert.ok(out.includes('<p>Plain HTML</p>'));
});
