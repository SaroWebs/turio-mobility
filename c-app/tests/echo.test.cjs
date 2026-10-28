/* global __dirname */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadEcho(pusher = {}, Echo = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/echo.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      if (name === 'pusher-js') return pusher;
      if (name === 'laravel-echo') return Echo;
      if (name === './secure-store') return { getItemAsync: async () => 'test-token' };
      if (name === './api') return { API_URL: 'http://localhost:8000/api/customer-app' };
      throw new Error(`Unexpected import: ${name}`);
    },
    process: { env: { EXPO_PUBLIC_PUSHER_APP_KEY: 'test-key' } },
    console: { warn() {} },
  });
  return exports;
}

test('polling fallback supports chained subscriptions and repeated cancellation cleanup', async () => {
  const echo = await loadEcho().initEcho();
  const channel = echo.private('ride.1');
  assert.equal(channel.listen('status', () => {}).listen('location', () => {}).stopListening('status'), channel);
  assert.doesNotThrow(() => {
    echo.leave('ride.1');
    echo.disconnect();
    echo.leave('ride.1');
    echo.disconnect();
  });
});

test('resolves the named Pusher export inside a CommonJS default wrapper', async () => {
  let pusherCreated = false;
  class Pusher { constructor() { pusherCreated = true; } }
  class Echo { constructor(options) { this.client = options.client; } }
  const echo = await loadEcho({ __esModule: true, default: { Pusher } }, Echo).initEcho();
  assert.ok(pusherCreated);
  assert.ok(echo instanceof Echo);
  assert.ok(echo.client instanceof Pusher);
});

test('client initialization failure still returns a cancellable polling fallback', async () => {
  class Pusher { constructor() { throw new Error('Socket unavailable'); } }
  const echo = await loadEcho(Pusher, class Echo {}).initEcho();
  assert.doesNotThrow(() => echo.private('ride.2').listen('status', () => {}));
  assert.doesNotThrow(() => { echo.leave('ride.2'); echo.disconnect(); });
});
