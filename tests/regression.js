const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const trimmed = html.trimStart();

assert.ok(trimmed.startsWith('<!DOCTYPE html>'), 'index.html must be the HTML document, not command output');
assert.equal(trimmed[0], '<', 'index.html should begin with markup');
assert.ok(!/^\s*\{\s*"returncode"\s*:/.test(html), 'index.html must not contain a command-result wrapper');

assert.ok(
  html.includes("let modalMode='pos',modalOriginalMode='pos',modalEditIdx=-1;"),
  'habit edit modal must track original and selected types separately',
);
assert.ok(
  html.includes('state[modalOriginalMode].splice(modalEditIdx,1);'),
  'habit deletion must use the original list, even after changing the selected type',
);
assert.ok(
  html.includes('Object.values(state.days).forEach'),
  'habit type changes should migrate existing day markers',
);
