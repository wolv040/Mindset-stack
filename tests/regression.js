const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

assert.ok(html.startsWith('<!DOCTYPE html>'), 'index.html must be a deployable HTML document');
assert.ok(!html.includes('"returncode"'), 'index.html must not contain a command result wrapper');

const scriptMatch = html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/);
assert.ok(scriptMatch, 'inline app script should be present');

const appScript = scriptMatch[1].replace(
  /\nrenderAll\(\);\s*$/,
  `
globalThis.__appTest = {
  openEditModal,
  setType,
  saveHabit,
  deleteHabit,
  getState: () => state,
  getElement: id => document.getElementById(id)
};
`
);

function baseState() {
  return {
    currentDate: '2026-07-02',
    pos: [
      { id: 'p1', name: 'Original positive', pts: 10 },
      { id: 'p2', name: 'Second positive', pts: 5 },
    ],
    stop: [
      { id: 's1', name: 'Existing penalty', pts: -20 },
    ],
    rewards: [
      { level: 'Beginner', xp: 0, reward: 'Start', perk: 'Start' },
    ],
    days: {
      '2026-07-02': {
        pos: { p1: true, p2: true },
        stop: { s1: true },
      },
    },
  };
}

function makeClassList() {
  const classes = new Set();
  return {
    add: (...names) => names.forEach(name => classes.add(name)),
    remove: (...names) => names.forEach(name => classes.delete(name)),
    toggle: (name, force) => {
      const shouldAdd = force === undefined ? !classes.has(name) : !!force;
      if (shouldAdd) classes.add(name);
      else classes.delete(name);
      return shouldAdd;
    },
    contains: name => classes.has(name),
  };
}

function createHarness(seedState) {
  const elements = new Map();
  const storage = new Map([['mindset_stack_v3', JSON.stringify(seedState)]]);

  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          id,
          value: '',
          textContent: '',
          innerHTML: '',
          className: '',
          style: {},
          classList: makeClassList(),
        });
      }
      return elements.get(id);
    },
  };

  const context = {
    console,
    document,
    confirm: () => true,
    location: { reload() {} },
    localStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
  };
  context.globalThis = context;

  vm.runInNewContext(appScript, context, { filename: 'index.html' });
  return context.__appTest;
}

const ids = list => Array.from(list, item => item.id);
const plain = value => JSON.parse(JSON.stringify(value));

{
  const app = createHarness(baseState());

  app.openEditModal('pos', 0);
  app.setType('stop');
  app.getElement('modalName').value = 'Moved to penalty';
  app.getElement('modalXP').value = '7';
  app.saveHabit();

  const state = app.getState();
  assert.deepStrictEqual(ids(state.pos), ['p2']);
  assert.deepStrictEqual(ids(state.stop), ['s1', 'p1']);
  assert.strictEqual(state.stop[0].name, 'Existing penalty');
  assert.deepStrictEqual(plain(state.stop[1]), { id: 'p1', name: 'Moved to penalty', pts: -7 });
  assert.strictEqual(state.days['2026-07-02'].pos.p1, undefined);
  assert.strictEqual(state.days['2026-07-02'].stop.p1, true);
  assert.strictEqual(state.days['2026-07-02'].stop.s1, true);
}

{
  const app = createHarness(baseState());

  app.openEditModal('pos', 0);
  app.setType('stop');
  app.deleteHabit();

  const state = app.getState();
  assert.deepStrictEqual(ids(state.pos), ['p2']);
  assert.deepStrictEqual(ids(state.stop), ['s1']);
  assert.strictEqual(state.days['2026-07-02'].pos.p1, undefined);
  assert.strictEqual(state.days['2026-07-02'].stop.s1, true);
}

console.log('regression tests passed');
