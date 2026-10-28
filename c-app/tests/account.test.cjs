/* global __dirname */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadAccount(get = async () => ({ data: { data: { data: [] } } })) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/account.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const exports = {};
  const state = [];
  let focus;
  vm.runInNewContext(outputText, { exports, Date, require(name) {
    if (name === 'react') return {
      useCallback: fn => fn, useRef: current => ({ current }),
      useState(initial) { const index = state.push(initial) - 1; return [initial, next => { state[index] = next; }]; },
    };
    if (name === 'expo-router') return { useFocusEffect: callback => { focus = callback; } };
    if (name === './api') return { __esModule: true, default: { get }, apiErrorMessage: err => err.message };
    throw new Error(`Unexpected import ${name}`);
  } });
  return { ...exports, state, focus: () => focus() };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('booking updates combine real service records in newest-first order with distinct read keys', async () => {
  const responses = {
    '/rides': [{ id: 1, status: 'completed', dropoff_location: 'Airport', updated_at: '2026-10-04T10:00:00Z' }],
    '/tour-bookings': [{ id: 1, status: 'confirmed', tour: { title: 'Hill tour' }, created_at: '2026-10-03T10:00:00Z' }],
    '/car-rentals': [{ id: 1, status: 'pending', car_category: { name: 'SUV' }, updated_at: '2026-10-04T11:00:00Z' }],
  };
  const { getBookingUpdates } = loadAccount(async endpoint => ({ data: { data: { data: responses[endpoint] } } }));
  const updates = await getBookingUpdates();
  assert.deepEqual(Array.from(updates, item => item.title), ['SUV', 'Airport', 'Hill tour']);
  assert.equal(new Set(updates.map(item => item.key)).size, 3);
  assert.equal(updates[2].kind, 'tour');
});

test('failed booking requests surface an error instead of showing a misleading empty inbox', async () => {
  const { getBookingUpdates } = loadAccount(async () => { throw new Error('Offline'); });
  await assert.rejects(getBookingUpdates, /Offline/);
});

test('account data refreshes on every focus so a wallet change appears after returning', async () => {
  const account = loadAccount();
  let balance = 100;
  account.useAccountData(async () => ({ balance }));
  const blur = account.focus();
  await flush();
  assert.equal(account.state[0].balance, 100);
  blur();
  balance = 750;
  account.focus();
  await flush();
  assert.equal(account.state[0].balance, 750);
  assert.equal(account.state[1], false);
});

test('a slower stale request cannot overwrite a newer refresh', async () => {
  const account = loadAccount();
  const pending = [];
  const result = account.useAccountData(() => new Promise(resolve => pending.push(resolve)));
  const first = result.reload();
  const second = result.reload();
  pending[1]({ balance: 900 }); await second;
  pending[0]({ balance: 100 }); await first;
  assert.equal(account.state[0].balance, 900);
});

test('account data ignores responses arriving after the screen loses focus', async () => {
  const account = loadAccount();
  let finish;
  account.useAccountData(() => new Promise(resolve => { finish = resolve; }));
  const blur = account.focus(); blur();
  finish({ balance: 100 }); await flush();
  assert.equal(account.state[0], null);
});
