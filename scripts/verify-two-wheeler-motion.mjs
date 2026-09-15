// Run from the project root: node scripts/verify-two-wheeler-motion.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';

const riders = readFileSync('app/kawasan-3d/twowheelers.tsx', 'utf8');
const scenery = readFileSync('app/kawasan-3d/scenery.tsx', 'utf8');
const extract = (source, name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
const source = [
  ...['lineP', 'arcP', 'finishLoop', 'posAt', 'blockLoop'].map(name => extract(scenery, name)),
  ...['approach', 'tangent', 'cornerLean'].map(name => extract(riders, name)),
].join('\n');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const { approach, blockLoop, posAt, tangent, cornerLean } = new Function('THREE', `${js}; return { approach, blockLoop, posAt, tangent, cornerLean };`)(THREE);
for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
  let speed = 0;
  for (let i = 0; i < 200; i++) {
    const next = approach(speed, 30, 160 * dt);
    assert.ok(next >= speed && next <= 30);
    speed = next;
  }
  assert.equal(speed, 30);
  for (let i = 0; i < 200; i++) speed = approach(speed, 0, 300 * dt);
  assert.equal(speed, 0);
}
const loop = blockLoop(-129, 129, -129, 129, 0, 12);
for (let s = 0; s < loop.L; s += 0.5) {
  const a = tangent(loop, s), b = tangent(loop, s + 0.5);
  assert.ok(Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) < 0.05);
  assert.equal(cornerLean(loop, s, 0, 0.22), 0);
  assert.ok(Math.abs(cornerLean(loop, s, 30, 0.22)) <= 0.22);
  const facing = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, -a, 0, 'YXZ'));
  assert.ok(facing.dot(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))) > 0.9999);
}
assert.ok(Math.hypot(...posAt(loop, 0).map((v, i) => v - posAt(loop, loop.L)[i])) < 1e-8);
console.log('PASS: monotonic acceleration/braking at 30/60/144 Hz, continuous corner headings, closed loop, bounded lean, forward-axis alignment.');
