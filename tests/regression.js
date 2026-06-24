const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert(
  html.trimStart().startsWith('<!DOCTYPE html>'),
  'index.html must serve the HTML document, not a command-result wrapper'
);
assert(!html.includes('"returncode"'), 'index.html must not contain wrapper metadata');
assert(!html.includes('"stdout"'), 'index.html must not contain escaped stdout payloads');

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert(scriptMatch, 'expected inline application script');

function createElement(id) {
  const classes = new Set();
  const el = {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    className: '',
  };
  el.classList = {
    add(cls) {
      classes.add(cls);
    },
    remove(cls) {
      classes.delete(cls);
    },
    contains(cls) {
      return classes.has(cls);
    },
    toggle(cls, force) {
      const shouldAdd = force === undefined ? !classes.has(cls) : !!force;
      if (shouldAdd) classes.add(cls);
      else classes.delete(cls);
      return shouldAdd;
    },
  };
  return el;
}

function runAppScenario(scenario) {
  const elements = new Map();
  const sandbox = {
    assert,
    console,
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, createElement(id));
        return elements.get(id);
      },
    },
    confirm() {
      return true;
    },
    location: {
      reload() {},
    },
    setTimeout() {
      return 0;
    },
    clearTimeout() {},
  };

  vm.runInNewContext(`${scriptMatch[1]}\n${scenario}`, sandbox);
}

runAppScenario(`
state={
  currentDate:'2026-06-24',
  pos:[{id:'p1',name:'Positive one',pts:5},{id:'p2',name:'Positive two',pts:9}],
  stop:[{id:'s1',name:'Stop one',pts:-7}],
  rewards:JSON.parse(JSON.stringify(DEFAULT_REWARDS)),
  days:{'2026-06-24':{pos:{p1:true},stop:{}}}
};
openEditModal('pos',0);
document.getElementById('modalName').value='Moved habit';
document.getElementById('modalXP').value='11';
setType('stop');
saveHabit();

assert.deepStrictEqual(state.pos.map(h=>h.id), ['p2']);
assert.deepStrictEqual(state.stop.map(h=>h.id), ['s1','p1']);
assert.strictEqual(state.stop[0].name, 'Stop one');
assert.strictEqual(state.stop[1].name, 'Moved habit');
assert.strictEqual(state.stop[1].pts, -11);
assert.strictEqual(state.days['2026-06-24'].pos.p1, undefined);
assert.strictEqual(state.days['2026-06-24'].stop.p1, true);
`);

runAppScenario(`
state={
  currentDate:'2026-06-24',
  pos:[{id:'p1',name:'Positive one',pts:5}],
  stop:[{id:'s1',name:'Stop one',pts:-7},{id:'s2',name:'Stop two',pts:-8}],
  rewards:JSON.parse(JSON.stringify(DEFAULT_REWARDS)),
  days:{}
};
openEditModal('pos',0);
setType('stop');
deleteHabit();

assert.deepStrictEqual(state.pos.map(h=>h.id), []);
assert.deepStrictEqual(state.stop.map(h=>h.id), ['s1','s2']);
`);

console.log('Regression tests passed');
