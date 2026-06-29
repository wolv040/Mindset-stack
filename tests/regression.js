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

function createElement() {
  return {
    textContent: '',
    value: '',
    innerHTML: '',
    className: '',
    style: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() {
        return false;
      },
    },
  };
}

function runAppWithState(state) {
  const elements = new Map();
  const storage = {
    mindset_stack_v3: JSON.stringify(state),
  };
  const context = {
    console,
    confirm: () => true,
    clearTimeout: () => {},
    setTimeout: () => 0,
    localStorage: {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
      },
      setItem(key, value) {
        storage[key] = String(value);
      },
      removeItem(key) {
        delete storage[key];
      },
    },
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, createElement());
        return elements.get(id);
      },
    },
    location: {
      reload() {},
    },
  };

  vm.runInNewContext(scriptMatch[1], context);
  return { context, elements, storage };
}

function baseState() {
  return {
    currentDate: '2026-06-29',
    pos: [{ id: 'p1', name: 'Positive', pts: 10 }],
    stop: [{ id: 's1', name: 'Stop', pts: -5 }],
    rewards: [{ level: 'Beginner', xp: 0, reward: 'Start', perk: 'Start' }],
    days: {
      '2026-06-29': {
        pos: { p1: true },
        stop: { s1: true },
      },
    },
  };
}

{
  const { context, storage } = runAppWithState(baseState());
  context.openEditModal('pos', 0);
  context.setType('stop');
  context.document.getElementById('modalName').value = 'Moved penalty';
  context.document.getElementById('modalXP').value = '20';
  context.saveHabit();

  const saved = JSON.parse(storage.mindset_stack_v3);
  assert.deepStrictEqual(saved.pos, [], 'moving a positive habit to penalty must remove it from the positive list');
  assert.deepStrictEqual(
    saved.stop.find((habit) => habit.id === 's1'),
    { id: 's1', name: 'Stop', pts: -5 },
    'moving another habit must not overwrite an existing penalty habit'
  );
  assert.deepStrictEqual(
    saved.stop.find((habit) => habit.id === 'p1'),
    { id: 'p1', name: 'Moved penalty', pts: -20 },
    'moving a habit must preserve its id and apply the new type points'
  );
  assert.strictEqual(saved.days['2026-06-29'].pos.p1, undefined, 'moved habit markers must leave the old bucket');
  assert.strictEqual(saved.days['2026-06-29'].stop.p1, true, 'moved habit markers must enter the new bucket');
}

{
  const { context, storage } = runAppWithState(baseState());
  context.openEditModal('stop', 0);
  context.setType('pos');
  context.deleteHabit();

  const saved = JSON.parse(storage.mindset_stack_v3);
  assert.deepStrictEqual(saved.pos, [{ id: 'p1', name: 'Positive', pts: 10 }], 'delete must not remove a habit from the newly selected type');
  assert.deepStrictEqual(saved.stop, [], 'delete must remove the originally edited habit');
  assert.strictEqual(saved.days['2026-06-29'].pos.p1, true, 'delete must preserve unrelated day markers');
  assert.strictEqual(saved.days['2026-06-29'].stop.s1, undefined, 'delete must clear the removed habit marker');
}
