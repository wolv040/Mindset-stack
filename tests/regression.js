const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

assert.match(html, /^\s*<!DOCTYPE html>/i, 'index.html must be served as an HTML document');
assert.doesNotMatch(html, /^\s*\{\s*"returncode"/, 'index.html must not contain a command-result JSON wrapper');

const modalStart = html.indexOf("let modalMode='pos'");
const modalEnd = html.indexOf('function clearAll()');
assert.ok(modalStart >= 0 && modalEnd > modalStart, 'modal code should be present in index.html');
const modalCode = html.slice(modalStart, modalEnd);

function createElement() {
  return {
    value: '',
    textContent: '',
    className: '',
    style: {},
    classList: {
      add() {},
      remove() {},
    },
  };
}

function createModalContext() {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
  };
  const context = {
    document,
    state: {
      pos: [
        { id: 'p0', name: 'Positive 0', pts: 10 },
        { id: 'p1', name: 'Positive 1', pts: 20 },
      ],
      stop: [
        { id: 's0', name: 'Stop 0', pts: -5 },
        { id: 's1', name: 'Stop 1', pts: -15 },
      ],
      days: {
        '2026-06-20': { pos: { p1: true }, stop: { s0: true } },
      },
    },
    confirm: () => true,
    save() {},
    renderAll() {},
    showToast() {},
  };

  vm.createContext(context);
  vm.runInContext(modalCode, context);
  return { context, elements };
}

{
  const { context, elements } = createModalContext();

  context.openEditModal('pos', 1);
  context.setType('stop');
  elements.get('modalName').value = 'Moved habit';
  elements.get('modalXP').value = '30';
  context.saveHabit();

  assert.deepEqual(context.state.pos.map((h) => h.id), ['p0']);
  assert.deepEqual(context.state.stop.map((h) => h.id), ['s0', 's1', 'p1']);
  assert.equal(context.state.stop[1].name, 'Stop 1', 'editing a positive habit must not overwrite stop index 1');
  assert.deepEqual(context.state.stop[2], { id: 'p1', name: 'Moved habit', pts: -30 });
  assert.equal(context.state.days['2026-06-20'].pos.p1, undefined);
  assert.equal(context.state.days['2026-06-20'].stop.p1, true);
}

{
  const { context } = createModalContext();

  context.openEditModal('pos', 0);
  context.setType('stop');
  context.deleteHabit();

  assert.deepEqual(context.state.pos.map((h) => h.id), ['p1']);
  assert.deepEqual(context.state.stop.map((h) => h.id), ['s0', 's1']);
}

console.log('regression checks passed');
