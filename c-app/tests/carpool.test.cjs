/* global __dirname */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadCarpool(get = async () => ({ data: { data: [] } })) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/carpool.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, Intl, Date,
    require(name) {
      assert.equal(name, './api');
      return { __esModule: true, default: { get }, API_URL: 'https://example.test/api/customer-app' };
    },
  });
  return exports;
}

test('search uses both endpoint coordinates, earliest departures and the cancellable Carpool API', async () => {
  const controller = new AbortController();
  const trips = [{ id: 7 }];
  const { findCarpoolTrips } = loadCarpool(async (url, config) => {
    assert.equal(config.baseURL + url, 'https://example.test/api/carpool/rides');
    assert.equal(config.signal, controller.signal);
    assert.deepEqual(JSON.parse(JSON.stringify(config.params)), {
      origin: 'Guwahati', destination: 'Shillong', origin_lat: 26.1445, origin_lng: 91.7362,
      destination_lat: 25.5788, destination_lng: 91.8933, seats: 1, sort: 'departure',
    });
    return { data: { data: trips } };
  });
  assert.equal(await findCarpoolTrips({ name: 'Guwahati', lat: 26.1445, lng: 91.7362 },
    { name: 'Shillong', lat: 25.5788, lng: 91.8933 }, controller.signal), trips);
});

test('trip timing shows the next arrival date in the departure timezone', () => {
  const timing = loadCarpool().carpoolTiming({ departure_at: '2026-09-29T18:00:00Z', duration_minutes: 90, timezone: 'Asia/Kolkata' });
  assert.match(timing.departure, /29/);
  assert.match(timing.arrival, /30/);
  assert.equal(timing.duration, '1h 30m');
});

test('trip timing handles daylight saving transitions using elapsed journey time', () => {
  const timing = loadCarpool().carpoolTiming({ departure_at: '2026-03-08T06:30:00Z', duration_minutes: 60, timezone: 'America/New_York' });
  assert.match(timing.departure, /1:30|01:30/);
  assert.match(timing.arrival, /3:30|03:30/);
  assert.equal(timing.duration, '1h 0m');
});

test('contributions display minor units as currency amounts', () => {
  assert.match(loadCarpool().carpoolMoney(12550, 'INR'), /125\.50/);
});
