const assert = require('assert');
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const trimmed = html.trimStart();

assert(
  trimmed.toLowerCase().startsWith('<!doctype html>'),
  'index.html must be the HTML document, not a serialized command result'
);

assert.doesNotThrow(() => {
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    assert(
      !Object.prototype.hasOwnProperty.call(parsed, 'stdout') &&
        !Object.prototype.hasOwnProperty.call(parsed, 'returncode'),
      'index.html contains a command-result wrapper instead of HTML'
    );
  }
});

assert(html.includes('<title>Mindset Stack</title>'), 'app title is missing');
assert(html.includes('localStorage.getItem'), 'app script is missing');
