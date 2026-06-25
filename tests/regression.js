const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const indexPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');

assert.match(html, /^\s*<!DOCTYPE html>/i, 'index.html must be served as HTML');
assert.doesNotMatch(html.slice(0, 200), /"returncode"\s*:|"stdout"\s*:/, 'index.html must not contain a command wrapper');

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(scriptMatch, 'inline app script should exist');

function classList(initial = []) {
  const values = new Set(initial);
  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    contains(value) {
      return values.has(value);
    },
    toggle(value, force) {
      if (force === undefined ? !values.has(value) : force) values.add(value);
      else values.delete(value);
    },
  };
}

function runApp(initialState) {
  let stored = JSON.stringify(initialState);
  const elements = new Map();

  function getElementById(id) {
    if (!elements.has(id)) {
      const activeByDefault = id === 'panel-dag' || id === 'nav-dag';
      elements.set(id, {
        id,
        textContent: '',
        innerHTML: '',
        value: '',
        className: '',
        style: {},
        classList: classList(activeByDefault ? ['active'] : []),
      });
    }
    return elements.get(id);
  }

  const context = {
    console,
    Date,
    document: { getElementById },
    localStorage: {
      getItem(key) {
        return key === 'mindset_stack_v3' ? stored : null;
      },
      setItem(key, value) {
        if (key === 'mindset_stack_v3') stored = value;
      },
      removeItem(key) {
        if (key === 'mindset_stack_v3') stored = null;
      },
    },
    confirm() {
      return true;
    },
    clearTimeout() {},
    setTimeout() {
      return 1;
    },
    location: { reload() {} },
  };

  vm.createContext(context);
  vm.runInContext(scriptMatch[1], context);

  return {
    context,
    elements,
    get state() {
      return vm.runInContext('state', context);
    },
  };
}

const app = runApp({
  currentDate: '2026-06-25',
  pos: [
    { id: 'p1', name: 'Read', pts: 10 },
    { id: 'p2', name: 'Train', pts: 20 },
  ],
  stop: [
    { id: 's1', name: 'No soda', pts: -5 },
    { id: 's2', name: 'No scrolling', pts: -15 },
  ],
  rewards: [],
  days: {
    '2026-06-25': {
      pos: { p1: true, p2: true },
      stop: { s1: true },
    },
  },
});

function habitIds(habits) {
  return Array.from(habits, (habit) => habit.id);
}

app.context.openEditModal('pos', 0);
app.context.setType('stop');
app.elements.get('modalName').value = 'Read penalty';
app.elements.get('modalXP').value = '7';
app.context.saveHabit();

assert.deepEqual(habitIds(app.state.pos), ['p2'], 'moved habit should leave the positive list');
assert.deepEqual(habitIds(app.state.stop), ['s1', 's2', 'p1'], 'moved habit should append to the penalty list without overwriting entries');
assert.equal(app.state.stop[2].name, 'Read penalty');
assert.equal(app.state.stop[2].pts, -7);
assert.equal(app.state.days['2026-06-25'].pos.p1, undefined, 'moved habit day marker should leave source type');
assert.equal(app.state.days['2026-06-25'].stop.p1, true, 'moved habit day marker should follow destination type');
assert.equal(app.state.days['2026-06-25'].pos.p2, true, 'unrelated positive marker should be preserved');
assert.equal(app.state.days['2026-06-25'].stop.s1, true, 'unrelated penalty marker should be preserved');

app.context.openEditModal('stop', 1);
app.context.setType('pos');
app.context.deleteHabit();

assert.deepEqual(habitIds(app.state.pos), ['p2'], 'delete should not use the selected destination type');
assert.deepEqual(habitIds(app.state.stop), ['s1', 'p1'], 'delete should remove the originally edited habit');

console.log('regression tests passed');
