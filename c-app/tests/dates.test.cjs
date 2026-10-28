/* global __dirname */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

process.env.TZ = 'Asia/Kolkata';
const source = fs.readFileSync(path.join(__dirname, '../src/lib/dates.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const dates = {};
vm.runInNewContext(outputText, { exports: dates, Date });

test('birthday and departure dates retain their local day instead of shifting to the previous UTC day', () => {
  const date = dates.parseLocalDate('2000-01-01');
  assert.equal(date.getHours(), 0);
  assert.equal(dates.localDateValue(date), '2000-01-01');
  assert.equal(date.toISOString().slice(0, 10), '1999-12-31');
});

test('invalid and incomplete calendar dates are rejected', () => {
  for (const invalid of ['', '2026-02-30', '2025-02-29', '2026-13-01', '2026-1-2']) assert.equal(dates.parseLocalDate(invalid), null);
  assert.equal(dates.localDateValue(dates.parseLocalDate('2024-02-29')), '2024-02-29');
});

test('date-only bounds include the full day for birthdays and rental start/end dates', () => {
  const today = new Date(2026, 9, 4, 18, 0);
  assert.equal(dates.withinDateBounds(new Date(2026, 9, 4), 'date', today), true);
  assert.equal(dates.withinDateBounds(new Date(2026, 9, 4, 23), 'date', undefined, today), true);
  assert.equal(dates.withinDateBounds(new Date(2026, 9, 3), 'date', today), false);
  assert.equal(dates.withinDateBounds(new Date(2026, 9, 5), 'date', undefined, today), false);
});

test('date-time bounds reject earlier pickup times on the same day', () => {
  const minimum = new Date(2026, 9, 4, 18, 5);
  assert.equal(dates.withinDateBounds(new Date(2026, 9, 4, 18, 4), 'datetime', minimum), false);
  assert.equal(dates.withinDateBounds(new Date(2026, 9, 4, 18, 5), 'datetime', minimum), true);
  assert.equal(dates.withinDateBounds(new Date(NaN), 'datetime', minimum), false);
});
