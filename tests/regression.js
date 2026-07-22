const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.join(__dirname, '..', 'index.html');
const source = fs.readFileSync(indexPath, 'utf8');

assert.match(
  source,
  /^<!DOCTYPE html>/i,
  'index.html must be the HTML document, not a serialized command result',
);
assert.doesNotMatch(
  source,
  /^\s*\{\s*"returncode"/,
  'index.html must not contain the returncode/stdout/stderr wrapper',
);
assert.match(source, /<script>[\s\S]*renderAll\(\);[\s\S]*<\/script>/);

console.log('index.html artifact regression checks passed');
