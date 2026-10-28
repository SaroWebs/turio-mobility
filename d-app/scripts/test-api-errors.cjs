const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadApi(platform) {
  const client = { interceptors: { request: { use() {} }, response: { use() {} } } };
  const modules = {
    axios: { create: () => client },
    'expo-constants': { expoConfig: { hostUri: 'localhost:8081' } },
    'react-native': { Platform: { OS: platform } },
    './secure-store': {},
  };
  const context = { exports: {}, require: name => modules[name], process: { env: {} }, __DEV__: true };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/api.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}

const web = loadApi('web');
assert.equal(web.API_URL, 'http://localhost:8000/api/driver-app');
for (const code of ['ECONNABORTED', 'ETIMEDOUT']) {
  assert.match(web.apiErrorMessage({ code, request: {} }), /timed out/);
}
assert.match(web.apiErrorMessage({ request: {} }), /this browser/);
assert.doesNotMatch(web.apiErrorMessage({ request: {} }), /Wi-Fi/);
assert.match(loadApi('android').apiErrorMessage({ request: {} }), /Wi-Fi/);
assert.equal(web.apiErrorMessage({ request: {}, response: { status: 413, data: '<html>Too large</html>' } }, 'Upload failed.'), 'Upload failed. (HTTP 413)');
assert.equal(web.apiErrorMessage({ response: { status: 422, data: { errors: { file: ['Invalid file.'] } } } }), 'Invalid file.');
assert.equal(web.apiErrorMessage({ response: { status: 503, data: { message: 'Unavailable.' } } }), 'Unavailable. (HTTP 503)');
console.log('API error regression checks passed.');
