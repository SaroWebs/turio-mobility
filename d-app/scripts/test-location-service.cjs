// Run with: node scripts/test-location-service.cjs
// Exercise publishing/lifecycle behavior without a device or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness({ expoGo = true, background = 'denied', deferWatch = false } = {}) {
  const calls = { posts: [], backgroundRequests: 0, starts: 0, removed: 0 };
  const point = { coords: { latitude: 26, longitude: 91, heading: null, speed: null, accuracy: 10 } };
  let callback;
  let finishWatch;
  const location = {
    Accuracy: { High: 4, Balanced: 3 },
    requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    requestBackgroundPermissionsAsync: async () => { calls.backgroundRequests++; },
    getBackgroundPermissionsAsync: async () => ({ status: background }),
    getCurrentPositionAsync: async () => point,
    hasStartedLocationUpdatesAsync: async () => false,
    startLocationUpdatesAsync: async () => { calls.starts++; },
    stopLocationUpdatesAsync: async () => {},
    watchPositionAsync: async (_, cb) => {
      callback = cb;
      const subscription = { remove: () => { calls.removed++; } };
      if (deferWatch) return new Promise(resolve => { finishWatch = () => resolve(subscription); });
      return subscription;
    },
  };
  const modules = {
    'expo-location': location,
    'expo-task-manager': { defineTask: () => {} },
    expo: { isRunningInExpoGo: () => expoGo },
    'react-native': { Platform: { OS: 'android' } },
    '../lib/api': { post: async (...args) => { calls.posts.push(args); } },
  };
  const context = { exports: {}, require: name => modules[name], __DEV__: false, console };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/LocationService.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return { service: context.exports.LocationService, calls, emit: () => callback(point), finish: () => finishWatch() };
}

(async () => {
  const go = harness();
  assert.equal(await go.service.requestPermissions(), true);
  await go.service.startTracking();
  go.emit();
  assert.equal(go.calls.backgroundRequests, 0);
  assert.equal(go.calls.starts, 0);
  assert.equal(go.calls.posts.length, 2, 'initial and moving foreground positions are published');
  await go.service.stopTracking();
  go.emit();
  assert.equal(go.calls.posts.length, 2, 'late callback after stop is ignored');
  assert.equal(go.calls.removed, 1);

  const foregroundOnly = harness({ expoGo: false });
  await foregroundOnly.service.startTracking();
  foregroundOnly.emit();
  assert.equal(foregroundOnly.calls.posts.length, 2, 'denied background permission retains foreground updates');
  await foregroundOnly.service.stopTracking();

  const native = harness({ expoGo: false, background: 'granted' });
  await native.service.startTracking();
  assert.equal(native.calls.starts, 1, 'native background publishing remains supported');

  const pending = harness({ deferWatch: true });
  const starting = pending.service.startTracking();
  await new Promise(resolve => setImmediate(resolve));
  await pending.service.stopTracking();
  pending.finish();
  await starting;
  assert.equal(pending.calls.removed, 1, 'a late subscription is removed after stop');
  console.log('LocationService: 4 lifecycle scenarios passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
