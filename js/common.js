// BLUE HAVEN (deep sea) — shared helpers: noise, shared uniforms, deep-sea material patch (bioluminescent glow, rim, sway, swim)
import * as THREE from 'three';

export const U = {
  uTime: { value: 0 },
  uRimCol: { value: new THREE.Color(0.035, 0.07, 0.16) },
  uGlowStr: { value: 1.0 },
  uLowQ: { value: 0 },
};

export function rng(seed = 1) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function fbm(x, y, o = 4) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { v += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return v; }
export function noise3(x, y, z) { return (vnoise(x + z * 1.7, y - z * 0.9) + vnoise(y * 1.3 + 5.1, z * 1.1 - x * 0.7)) * 0.5; }

export function sandHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = (fbm(x * 0.035 + 3, z * 0.035 - 1, 4) - 0.5) * 2.8;
  h += (fbm(x * 0.25, z * 0.25, 2) - 0.5) * 0.25;
  const e = Math.max(0, r - 26); h += Math.min(e * e * 0.018, 7.0 + e * 0.02);
  return h;
}

/** add a per-vertex glow attribute (0..1+) */
export function setGlow(g, fn) {
  const p = g.attributes.position, a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) a[i] = typeof fn === 'number' ? fn : fn(p.getX(i), p.getY(i), p.getZ(i), i);
  g.setAttribute('aGlow', new THREE.BufferAttribute(a, 1)); return g;
}

/**
 * Patch a MeshStandardMaterial for the deep sea.
 * opts.glow: strength (needs aGlow attribute)  opts.sway: { amp, height }  opts.swim: 'fish' | 'whale' | 'squid'  opts.rim  opts.sheen: Color
 */
export function deep(mat, opts = {}) {
  const rim = opts.rim ?? 1.0, glow = opts.glow ?? 0, sheen = opts.sheen || null;
  mat.userData.sheen = { value: sheen || new THREE.Color(0, 0, 0) };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uRimCol: U.uRimCol, uGlowStr: U.uGlowStr, uSheen: mat.userData.sheen });
    let deform = '';
    if (opts.sway) {
      deform = `{
        float hh = clamp(position.y / ${opts.sway.height.toFixed(3)}, 0.0, 1.0);
        vec3 ip = vec3(position.x, 0.0, position.z);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float k = hh * hh * ${opts.sway.amp.toFixed(3)};
        transformed.x += (sin(uTime * 0.45 + ip.x * 0.21 + ip.z * 0.13 + hh * 2.2) + 0.3 * sin(uTime * 1.1 + ip.z + hh * 5.0)) * k;
        transformed.z += (cos(uTime * 0.38 + ip.z * 0.19 + hh * 1.8) + 0.25 * sin(uTime * 0.9 + ip.x)) * k * 0.7;
      }`;
    } else if (opts.swim === 'fish') {
      deform = `{
        float tw = smoothstep(0.42, -0.5, position.z);
        float amp = 0.012 + 0.11 * tw * tw;
        transformed.x += sin(position.z * 7.0 + aSwim.x) * amp * aSwim.w;
        transformed.x += aSwim.z * (position.z - 0.15) * (position.z - 0.15) * 0.9;
      }`;
    } else if (opts.swim === 'whale') {
      deform = `{
        float tw = smoothstep(0.25, -0.5, position.z);
        transformed.y += sin(position.z * 5.0 + aSwim.x) * (0.004 + 0.07 * tw * tw);
        transformed.x += aSwim.z * (position.z - 0.15) * (position.z - 0.15) * 0.5;
      }`;
    } else if (opts.swim === 'squid') {
      deform = `{
        float d = max(0.0, -position.z - 0.05);            // arms trail behind the head (-z)
        transformed.x += sin(position.z * 9.0 + aSwim.x + position.x * 30.0) * d * 0.09;
        transformed.y += cos(position.z * 7.0 + aSwim.x * 0.8 + position.y * 30.0) * d * 0.07;
        float m = smoothstep(0.0, 0.5, position.z);         // mantle pulse
        transformed.xy *= 1.0 + sin(aSwim.x * 0.5) * 0.05 * m;
      }`;
    }
    const glowV = glow ? 'attribute float aGlow; varying float vGlow;' : '';
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime; varying vec3 vCW;\n${opts.swim ? 'attribute vec4 aSwim;' : ''}\n${glowV}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${deform}\n${glow ? 'vGlow = aGlow;' : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 cw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            cw = instanceMatrix * cw;
          #endif
          vCW = (modelMatrix * cw).xyz; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime; uniform float uGlowStr; uniform vec3 uRimCol; uniform vec3 uSheen; varying vec3 vCW;\n${glow ? 'varying float vGlow;' : ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        ${glow ? `{ float pulse = 0.8 + 0.2 * sin(uTime * 0.7 + vCW.x * 0.5 + vCW.z * 0.37 + vGlow * 5.0);
          float farG = 1.0 - 0.65 * smoothstep(8.0, 26.0, length(vViewPosition));
          totalEmissiveRadiance += diffuseColor.rgb * vGlow * pulse * farG * uGlowStr * ${glow.toFixed(3)}; }` : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        { vec3 q = vCW * 1.7; vec3 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
          float a = fract(sin(dot(i, vec3(127.1, 311.7, 74.7))) * 43758.5453), b = fract(sin(dot(i + vec3(1.0, 0.0, 0.0), vec3(127.1, 311.7, 74.7))) * 43758.5453);
          float c2 = fract(sin(dot(i + vec3(0.0, 1.0, 0.0), vec3(127.1, 311.7, 74.7))) * 43758.5453), d = fract(sin(dot(i + vec3(1.0, 1.0, 0.0), vec3(127.1, 311.7, 74.7))) * 43758.5453);
          float nn = mix(mix(a, b, f.x), mix(c2, d, f.x), f.y);
          diffuseColor.rgb *= 0.9 + 0.2 * nn; }`)
      .replace('#include <opaque_fragment>', `
        { vec3 vd = normalize(vViewPosition);
          float fr = pow(1.0 - clamp(abs(dot(normal, vd)), 0.0, 1.0), 2.4);
          outgoingLight += uRimCol * fr * ${rim.toFixed(3)} + uSheen * fr * (0.7 + 0.3 * sin(vCW.x * 3.0 + vCW.y * 4.0 + uTime * 0.5));
          outgoingLight *= mix(vec3(1.0), vec3(0.6, 0.84, 1.0), 1.0 - exp(-length(vViewPosition) * 0.045)); }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'deepR1' + JSON.stringify({ s: opts.sway, w: opts.swim, r: rim, g: glow, h: !!sheen });
  return mat;
}
