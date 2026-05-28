const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadApp() {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.startsWith('<!DOCTYPE html>'), 'index.html must be an HTML document');

  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const elements = {};

  class StubElement {
    constructor(id) {
      this.id = id;
      this.value = '';
      this.textContent = '';
      this.innerHTML = '';
      this.className = '';
      this.style = {};
      this._classes = new Set(id === 'panel-dag' || id === 'nav-dag' ? ['active'] : []);
      this.classList = {
        add: (cls) => this._classes.add(cls),
        remove: (cls) => this._classes.delete(cls),
        contains: (cls) => this._classes.has(cls),
        toggle: (cls, force) => {
          if (force === undefined) {
            if (this._classes.has(cls)) this._classes.delete(cls);
            else this._classes.add(cls);
          } else if (force) {
            this._classes.add(cls);
          } else {
            this._classes.delete(cls);
          }
        },
      };
    }
  }

  const storage = {};
  const context = {
    console,
    setTimeout: () => 1,
    clearTimeout: () => {},
    confirm: () => true,
    location: { reload: () => {} },
    localStorage: {
      getItem: (key) => storage[key] || null,
      setItem: (key, value) => {
        storage[key] = value;
      },
      removeItem: (key) => {
        delete storage[key];
      },
    },
    document: {
      getElementById: (id) => {
        if (!elements[id]) elements[id] = new StubElement(id);
        return elements[id];
      },
    },
  };

  vm.createContext(context);
  vm.runInContext(script, context, { filename: 'index.html' });

  return {
    context,
    elements,
    get state() {
      return vm.runInContext('state', context);
    },
  };
}

{
  const app = loadApp();
  const firstPenaltyName = app.state.stop[0].name;

  app.context.openEditModal('pos', 0);
  app.context.setType('stop');
  app.elements.modalName.value = 'Moved habit';
  app.elements.modalXP.value = '7';
  app.context.saveHabit();

  assert.equal(app.state.pos.some((habit) => habit.id === 'semen'), false);
  assert.equal(app.state.stop[0].name, firstPenaltyName, 'existing penalty habit must not be overwritten by index');

  const moved = app.state.stop.find((habit) => habit.id === 'semen');
  assert.ok(moved, 'edited habit should move to the selected type');
  assert.equal(moved.name, 'Moved habit');
  assert.equal(moved.pts, -7);
}

{
  const app = loadApp();
  const initialPenaltyIds = app.state.stop.map((habit) => habit.id);

  app.context.openEditModal('pos', 1);
  app.context.setType('stop');
  app.context.deleteHabit();

  assert.equal(app.state.pos.some((habit) => habit.id === 'dialoog'), false);
  assert.deepEqual(app.state.stop.map((habit) => habit.id), initialPenaltyIds, 'delete must use the original edited list');
}
