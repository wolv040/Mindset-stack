const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

assert(
  html.trimStart().startsWith('<!DOCTYPE html>'),
  'index.html must be served as HTML, not a command-result wrapper'
);
assert(!html.trimStart().startsWith('{'), 'index.html must not start with JSON');
assert(html.includes('<script>'), 'index.html should include the app script');

const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
assert(scriptMatch, 'app script should be present');
const appScript = scriptMatch[1].replace(/\nrenderAll\(\);\s*$/, '');

function createElement() {
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    className: '',
    style: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; },
    },
  };
}

const elements = new Map();
const context = {
  console,
  setTimeout,
  clearTimeout,
  confirm: () => true,
  location: { reload() {} },
  localStorage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
  },
  document: {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
  },
};

vm.createContext(context);

vm.runInContext(`${appScript}
function testAssert(condition,message){ if(!condition) throw new Error(message); }
function setInput(id,value){ document.getElementById(id).value=value; }

state={
  currentDate:'2026-06-26',
  pos:[{id:'p1',name:'Pos 1',pts:10},{id:'p2',name:'Pos 2',pts:20}],
  stop:[{id:'s1',name:'Stop 1',pts:-10},{id:'s2',name:'Stop 2',pts:-20}],
  rewards:JSON.parse(JSON.stringify(DEFAULT_REWARDS)),
  days:{'2026-06-26':{pos:{p2:true},stop:{s2:true}}}
};
openEditModal('pos',1);
setInput('modalName','Moved Habit');
setInput('modalXP','30');
setType('stop');
saveHabit();
testAssert(state.pos.length===1&&state.pos[0].id==='p1','saving after type change should remove original positive habit');
testAssert(state.stop.length===3,'saving after type change should append to stop habits');
testAssert(state.stop[1].id==='s2'&&state.stop[1].name==='Stop 2','saving after type change must not overwrite stop habit at same index');
testAssert(state.stop[2].id==='p2'&&state.stop[2].name==='Moved Habit'&&state.stop[2].pts===-30,'saving after type change should preserve and update moved habit');
testAssert(!state.days['2026-06-26'].pos.p2&&state.days['2026-06-26'].stop.p2,'saving after type change should migrate day markers');

state={
  currentDate:'2026-06-26',
  pos:[{id:'p1',name:'Pos 1',pts:10},{id:'p2',name:'Pos 2',pts:20}],
  stop:[{id:'s1',name:'Stop 1',pts:-10},{id:'s2',name:'Stop 2',pts:-20}],
  rewards:JSON.parse(JSON.stringify(DEFAULT_REWARDS)),
  days:{}
};
openEditModal('pos',1);
setType('stop');
deleteHabit();
testAssert(state.pos.length===1&&state.pos[0].id==='p1','delete after type change should remove original positive habit');
testAssert(state.stop.length===2&&state.stop[1].id==='s2','delete after type change must not remove stop habit at same index');
`, context);

