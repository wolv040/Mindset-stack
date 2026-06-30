const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

assert(
  html.startsWith('<!DOCTYPE html>'),
  'index.html must be a browser-ready HTML document, not a command wrapper'
);
assert(!html.includes('"returncode"'), 'index.html must not contain command wrapper metadata');

const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
assert(scriptMatch, 'inline application script should be present');

const habitIds = (habits) => Array.from(habits, (h) => h.id);

function createElement() {
  return {
    textContent: '',
    innerHTML: '',
    value: '',
    style: {},
    _classes: new Set(),
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

function createAppContext() {
  const elements = new Map();
  const context = {
    console,
    Date,
    Math,
    JSON,
    Object,
    parseInt,
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
    confirm() {
      return true;
    },
    location: {
      reload() {},
    },
    localStorage: {
      _items: new Map(),
      getItem(key) {
        return this._items.has(key) ? this._items.get(key) : null;
      },
      setItem(key, value) {
        this._items.set(key, String(value));
      },
      removeItem(key) {
        this._items.delete(key);
      },
    },
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, createElement());
        return elements.get(id);
      },
    },
  };

  vm.createContext(context);
  vm.runInContext(
    `${scriptMatch[1]}
this.__app = {
  DEFAULT_STOP,
  state,
  getDayState,
  openEditModal,
  setType,
  saveHabit,
  deleteHabit,
};`,
    context
  );
  return { app: context.__app, elements };
}

{
  const { app, elements } = createAppContext();
  const originalStop = habitIds(app.state.stop);
  app.getDayState(app.state.currentDate).pos.semen = true;

  app.openEditModal('pos', 0);
  elements.get('modalName').value = 'Semen retentie updated';
  elements.get('modalXP').value = '30';
  app.setType('stop');
  app.saveHabit();

  assert.strictEqual(app.state.pos.some((h) => h.id === 'semen'), false);
  assert.strictEqual(app.state.stop.some((h) => h.id === 'semen'), true);
  assert.deepStrictEqual(
    habitIds(app.state.stop.slice(0, originalStop.length)),
    originalStop,
    'changing a positive habit to penalty must not overwrite an existing penalty habit'
  );
  assert.strictEqual(app.state.days[app.state.currentDate].pos.semen, undefined);
  assert.strictEqual(app.state.days[app.state.currentDate].stop.semen, true);
}

{
  const { app } = createAppContext();
  const originalPos = habitIds(app.state.pos);

  app.openEditModal('pos', 0);
  app.setType('stop');
  app.deleteHabit();

  assert.strictEqual(app.state.pos.some((h) => h.id === 'semen'), false);
  assert.deepStrictEqual(
    habitIds(app.state.stop),
    habitIds(app.DEFAULT_STOP),
    'delete after changing type selection must delete the original habit only'
  );
  assert.deepStrictEqual(
    habitIds(app.state.pos),
    originalPos.slice(1),
    'delete should remove the edited positive habit'
  );
}
