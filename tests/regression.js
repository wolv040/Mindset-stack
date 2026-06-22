const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

assert.match(html, /^\s*<!DOCTYPE html>/i, 'index.html must be an HTML document');
assert.ok(!html.trimStart().startsWith('{'), 'index.html must not be a command-result JSON wrapper');

const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
assert.ok(scriptMatch, 'index.html should contain the app script');

function createElement() {
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    className: '',
    style: {},
    classList: {
      contains() { return false; },
      add() {},
      remove() {},
      toggle() {},
    },
  };
}

const elements = new Map();
const context = vm.createContext({
  console,
  Date,
  Math,
  Object,
  JSON,
  parseInt,
  setTimeout,
  clearTimeout,
  confirm: () => true,
  location: { reload() {} },
  localStorage: {
    store: new Map(),
    getItem(key) { return this.store.has(key) ? this.store.get(key) : null; },
    setItem(key, value) { this.store.set(key, String(value)); },
    removeItem(key) { this.store.delete(key); },
  },
  document: {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
  },
});

vm.runInContext(scriptMatch[1], context);

vm.runInContext(`
  state.currentDate = '2026-01-01';
  state.days = {
    '2026-01-01': { pos: { semen: true }, stop: { frisdrank: true } }
  };
`, context);

context.openEditModal('pos', 0);
context.setType('stop');
elements.get('modalName').value = 'Moved habit';
elements.get('modalXP').value = '30';
context.saveHabit();

const movedState = vm.runInContext('state', context);
assert.equal(movedState.pos.some(h => h.id === 'semen'), false, 'moved habit should leave the original list');
assert.deepEqual(
  movedState.stop.map(h => h.id),
  ['frisdrank', 'social', 'dating', 'semen'],
  'moving a positive habit must append it to stop habits without overwriting an existing stop habit',
);
assert.equal(movedState.stop.find(h => h.id === 'semen').pts, -30, 'moved habit should use penalty XP');
assert.equal(movedState.days['2026-01-01'].pos.semen, undefined, 'historical positive marker should move with the habit');
assert.equal(movedState.days['2026-01-01'].stop.semen, true, 'historical marker should be preserved under the new type');

context.openEditModal('stop', 0);
context.setType('pos');
context.deleteHabit();

const deletedState = vm.runInContext('state', context);
assert.equal(deletedState.stop.some(h => h.id === 'frisdrank'), false, 'delete should use the originally edited list');
assert.equal(deletedState.pos.some(h => h.id === 'frisdrank'), false, 'delete should not move records during deletion');
assert.equal(deletedState.days['2026-01-01'].stop.frisdrank, undefined, 'delete should remove historical markers for the deleted habit');

console.log('Regression tests passed');
