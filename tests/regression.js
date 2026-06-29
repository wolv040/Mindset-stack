const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const trimmed = html.trimStart();

assert(
  trimmed.toLowerCase().startsWith('<!doctype html>'),
  'index.html must be a deployable HTML document, not command output'
);

assert(
  !trimmed.startsWith('{') && !html.includes('"stdout"'),
  'index.html must not contain a command-result wrapper'
);

assert(
  html.includes('</html>'),
  'index.html must contain a complete HTML document'
);

const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
assert(scriptMatch, 'index.html must contain the application script');

new vm.Script(scriptMatch[1]);
