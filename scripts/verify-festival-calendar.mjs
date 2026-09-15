import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync('app/kawasan-3d/festivals.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const api = {};
new Function('exports', compiled)(api);
const ids = date => api.activeFestivals(date).map(f => f.id);
assert.equal(api.malaysiaDateKey(new Date('2026-09-15T15:59:59Z')), '2026-09-15');
assert.equal(api.malaysiaDateKey(new Date('2026-09-15T16:00:00Z')), '2026-09-16');
for (const [date, festival] of Object.entries({
  '2026-08-31': 'merdeka', '2026-09-16': 'malaysia', '2026-03-21': 'raya',
  '2026-02-17': 'cny', '2026-05-27': 'aidiladha', '2026-05-31': 'wesak',
  '2026-11-08': 'deepavali', '2026-12-25': 'christmas', '2026-02-01': 'thaipusam',
  '2026-05-30': 'kaamatan', '2026-06-01': 'gawai',
})) assert.equal(ids(date)[0], festival, date);
assert.ok(!ids('2026-09-08').includes('malaysia'));
assert.ok(ids('2026-09-09').includes('malaysia'));
assert.ok(ids('2026-09-18').includes('malaysia'));
assert.ok(!ids('2026-09-19').includes('malaysia'));
assert.ok(ids('2026-05-31').includes('kaamatan'), 'Overlapping celebrations coexist');
assert.ok(!ids('2027-03-21').includes('raya'), 'No guessed lunar dates in unverified years');
assert.ok(ids('2027-09-16').includes('malaysia'), 'Fixed dates recur');
assert.deepEqual(ids(''), []);
console.log('PASS: 11 celebrations, Malaysia midnight, decoration boundaries, overlaps, and unverified-year fallback.');
