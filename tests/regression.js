const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');

assert.match(html, /^\s*<!DOCTYPE html>/i, 'index.html must be a browser-renderable HTML document');
assert.doesNotMatch(html.slice(0, 200), /"returncode"|"stdout"|"stderr"/, 'index.html must not contain a command-result wrapper');

const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
assert.ok(scriptMatch, 'index.html should contain the app script');

const script = scriptMatch[1];
const modalStart = script.indexOf("let modalMode='pos'");
const modalEnd = script.indexOf('function clearAll');
assert.notEqual(modalStart, -1, 'modal state should be present');
assert.notEqual(modalEnd, -1, 'clearAll should follow modal functions');

const modalScript = script.slice(modalStart, modalEnd);
const harness = `
const assert = globalThis.assert;
const elements = {
  modalTitle: { textContent: '' },
  modalName: { value: '' },
  modalXP: { value: '' },
  deleteBtn: { style: {} },
  typePosBtn: { className: '' },
  typeStopBtn: { className: '' },
  modalOverlay: { classList: { add() {}, remove() {} } },
};
const document = {
  getElementById(id) {
    if (!elements[id]) elements[id] = {};
    return elements[id];
  },
};
function save() {}
function closeModal() {}
function renderAll() {}
function showToast() {}
function confirm() { return true; }
let state;

${modalScript}

state = {
  pos: [
    { id: 'p1', name: 'Original positive', pts: 10 },
    { id: 'p2', name: 'Other positive', pts: 12 },
  ],
  stop: [
    { id: 's1', name: 'Existing penalty', pts: -20 },
  ],
  days: {
    '2026-07-01': { pos: { p1: true, p2: true }, stop: { s1: true } },
  },
};
openEditModal('pos', 0);
setType('stop');
elements.modalName.value = 'Moved habit';
elements.modalXP.value = '5';
saveHabit();

assert.deepEqual(state.pos.map(h => h.id), ['p2']);
assert.deepEqual(state.stop.map(h => h.id), ['s1', 'p1']);
assert.equal(state.stop[0].name, 'Existing penalty');
assert.equal(state.stop[1].name, 'Moved habit');
assert.equal(state.stop[1].pts, -5);
assert.equal(state.days['2026-07-01'].pos.p1, undefined);
assert.equal(state.days['2026-07-01'].stop.p1, true);

state = {
  pos: [
    { id: 'p1', name: 'Original positive', pts: 10 },
    { id: 'p2', name: 'Other positive', pts: 12 },
  ],
  stop: [
    { id: 's1', name: 'Existing penalty', pts: -20 },
  ],
  days: {},
};
openEditModal('pos', 0);
setType('stop');
deleteHabit();

assert.deepEqual(state.pos.map(h => h.id), ['p2']);
assert.deepEqual(state.stop.map(h => h.id), ['s1']);
`;

vm.runInNewContext(harness, { assert });

console.log('Regression checks passed');
