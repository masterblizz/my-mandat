"use client";

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Festival } from './festivals';

const PERIOD = 7.5;
const ASCENT = 1.4;
const BURST_LIFE = 2.8;
const TRAIL = 3;

// One pooled point cloud: no new meshes, lights or textures per explosion.
export function CelebrationFireworks({ festivals, span, metro, detail }: {
  festivals: Festival[]; span: number; metro: boolean; detail: number;
}) {
  const pool = useMemo(() => {
    const shells = detail >= 0.4 ? 3 : 2;
    const sparks = detail >= 0.7 ? 96 : 56;
    const count = shells * sparks * TRAIL;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const alpha = new Float32Array(count);
    const velocity = new Float32Array(shells * sparks * 3);
    const palette = festivals.flatMap(f => [...f.colors]);
    for (let shell = 0; shell < shells; shell++) {
      for (let spark = 0; spark < sparks; spark++) {
        // Even spherical distribution with deterministic variation in speed.
        const y = 1 - 2 * (spark + 0.5) / sparks;
        const angle = spark * 2.399963 + shell * 1.7;
        const radius = Math.sqrt(1 - y * y);
        const speed = (metro ? 95 : 65) * (0.72 + (spark * 17 % 29) / 100);
        const offset = (shell * sparks + spark) * 3;
        velocity.set([Math.cos(angle) * radius * speed, y * speed, Math.sin(angle) * radius * speed], offset);
        const color = new THREE.Color(palette[(shell + Math.floor(spark / 12)) % palette.length] ?? '#ffdb8c');
        for (let trail = 0; trail < TRAIL; trail++) {
          color.toArray(colors, ((shell * sparks + spark) * TRAIL + trail) * 3);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('sparkAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      toneMapped: false, vertexColors: true,
      uniforms: { pixelScale: { value: 400 } },
      vertexShader: `
        attribute float sparkAlpha;
        uniform float pixelScale;
        varying vec3 sparkColor;
        varying float opacity;
        void main() {
          sparkColor = color; opacity = sparkAlpha;
          vec4 view = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * view;
          gl_PointSize = clamp(pixelScale * 7.0 / max(1.0, -view.z), 1.5, 14.0);
        }
      `,
      fragmentShader: `
        varying vec3 sparkColor;
        varying float opacity;
        void main() {
          float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
          if (radius > 1.0 || opacity < 0.005) discard;
          float halo = pow(1.0 - radius, 1.6);
          gl_FragColor = vec4(sparkColor * 1.8, opacity * halo);
        }
      `,
    });
    return { shells, sparks, positions, alpha, velocity, geometry, material };
  }, [festivals, metro, detail]);
  useEffect(() => () => { pool.geometry.dispose(); pool.material.dispose(); }, [pool]);

  useFrame(({ clock, size, gl }) => {
    pool.material.uniforms.pixelScale.value = size.height * gl.getPixelRatio();
    const time = clock.elapsedTime;
    const ceiling = metro ? 690 : 370;
    for (let shell = 0; shell < pool.shells; shell++) {
      const offsetTime = time + shell * PERIOD / pool.shells;
      const age = offsetTime % PERIOD;
      const cycle = Math.floor(offsetTime / PERIOD);
      const angle = shell * Math.PI * 2 / pool.shells + cycle * 0.9;
      const x = Math.cos(angle) * Math.min(span * 0.14, 550);
      const z = Math.sin(angle) * Math.min(span * 0.14, 550);
      const top = ceiling + shell * 35;
      for (let spark = 0; spark < pool.sparks; spark++) {
        const v = (shell * pool.sparks + spark) * 3;
        for (let trail = 0; trail < TRAIL; trail++) {
          const index = (shell * pool.sparks + spark) * TRAIL + trail;
          const p = index * 3;
          pool.alpha[index] = 0;
          if (age < ASCENT) {
            if (spark > 1) continue;
            const rise = Math.max(0, (age - (trail + spark * TRAIL) * 0.045) / ASCENT);
            pool.positions.set([x, top - 230 + rise * 230, z], p);
            pool.alpha[index] = (1 - trail * 0.25) * 0.8;
          } else {
            const t = age - ASCENT - trail * 0.07;
            if (t < 0 || t > BURST_LIFE) continue;
            const spread = (1 - Math.exp(-0.65 * t)) / 0.65;
            pool.positions.set([
              x + pool.velocity[v] * spread,
              top + pool.velocity[v + 1] * spread - 20 * t * t,
              z + pool.velocity[v + 2] * spread,
            ], p);
            pool.alpha[index] = Math.pow(1 - t / BURST_LIFE, 1.4) * (1 - trail * 0.25);
          }
        }
      }
    }
    pool.geometry.attributes.position.needsUpdate = true;
    pool.geometry.attributes.sparkAlpha.needsUpdate = true;
  });

  return <points geometry={pool.geometry} material={pool.material} frustumCulled={false} raycast={() => {}} />;
}
