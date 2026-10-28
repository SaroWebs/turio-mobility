const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/driver-access.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, context);
const { canUseDriverServices } = context.exports;

const approved = { status: 'active', is_approved: true, is_active: true };
assert.equal(canUseDriverServices(approved), true);
for (const account of [null, undefined, {},
  { ...approved, status: 'pending' },
  { ...approved, status: 'suspended' },
  { ...approved, is_approved: false },
  { ...approved, is_active: false },
  { status: 'active' },
]) {
  assert.equal(canUseDriverServices(account), false);
}
// Account approval is separate from car/document setup readiness.
assert.equal(canUseDriverServices({ ...approved, vehicle: null, document_verification: { is_complete: false } }), true);
console.log('Driver approval access checks passed.');
