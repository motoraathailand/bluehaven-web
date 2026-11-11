// BLUE HAVEN — shared helpers: noise, shared uniforms, underwater material patch (caustics, rim light, sway, swim)
import * as THREE from 'three';

export const U = {
  uTime: { value: 0 },
  uCaus: { value: 0.62 },
  uCausCol: { value: new THREE.Color(1.0, 0.93, 0.75) },
  uRimCol: { value: new THREE.Color(0.10, 0.32, 0.38) },
  uLowQ: { value: 0 },
};

// --- deterministic random ---
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

// sand height (shared by terrain and object placement)
export function sandHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = (fbm(x * 0.035 + 3, z * 0.035 - 1, 4) - 0.5) * 2.6;
  h += Math.sin(x * 0.9 + fbm(x * 0.2, z * 0.2) * 6) * 0.05;
  const e = Math.max(0, r - 26); h += Math.min(e * e * 0.018, 7.0 + e * 0.02);
  return h;
}

const CAUSTIC_GLSL = /* glsl */`
uniform float uTime; uniform float uCaus; uniform vec3 uCausCol; uniform vec3 uRimCol; uniform float uLowQ;
varying vec3 vCW; varying vec3 vCN;
vec2 bhH2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float bhVoro(vec2 p, float t){
  vec2 i = floor(p), f = fract(p); float f1 = 8.0, f2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 o = bhH2(i + g); o = 0.5 + 0.42 * sin(t + 6.2831 * o);
    float d = length(g + o - f); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  return f2 - f1;
}
float bhCaustic(vec2 p, float t){
  vec2 w = p * 0.62 + vec2(sin(t * 0.13), cos(t * 0.11)) * 0.6;
  float a = bhVoro(w, t * 0.9);
  float c = pow(1.0 - smoothstep(0.0, 0.2, a), 3.0);
  if (uLowQ < 0.5) {
    float b = bhVoro(w * 1.31 + vec2(3.1, 1.7) + a * 0.25, -t * 0.7 + 2.0);
    c = c * 0.75 + pow(1.0 - smoothstep(0.0, 0.2, b), 3.0) * 0.55;
  }
  return c;
}`;

/**
 * Patch a MeshStandardMaterial with underwater lighting.
 * opts.sway: { amp, height } (plants)  opts.swim: 'fish' | 'manta'  opts.rim: strength  opts.caus: strength  opts.sheen: Color
 */
export function underwater(mat, opts = {}) {
  const caus = opts.caus ?? 1.0, rim = opts.rim ?? 1.0;
  const sheen = opts.sheen || null;
  mat.userData.sheen = { value: sheen || new THREE.Color(0, 0, 0) };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uCaus: U.uCaus, uCausCol: U.uCausCol, uRimCol: U.uRimCol, uLowQ: U.uLowQ, uSheen: mat.userData.sheen });
    let deform = '';
    if (opts.sway) {
      deform = `{
        float hh = clamp(position.y / ${opts.sway.height.toFixed(3)}, 0.0, 1.0);
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float k = hh * hh * ${opts.sway.amp.toFixed(3)};
        transformed.x += (sin(uTime * 0.65 + ip.x * 0.21 + ip.z * 0.13 + hh * 2.2) + 0.4 * sin(uTime * 1.7 + ip.z + hh * 5.0)) * k;
        transformed.z += (cos(uTime * 0.5 + ip.z * 0.19 + hh * 1.8) + 0.3 * sin(uTime * 1.3 + ip.x)) * k * 0.7;
      }`;
    } else if (opts.swim === 'fish') {
      deform = `{
        float tw = smoothstep(0.42, -0.5, position.z);
        float amp = 0.012 + 0.11 * tw * tw;
        transformed.x += sin(position.z * 7.0 + aSwim.x) * amp * aSwim.w;
        transformed.x += aSwim.z * (position.z - 0.15) * (position.z - 0.15) * 0.9;
      }`;
    } else if (opts.swim === 'manta') {
      deform = `{
        float ax = abs(position.x);
        transformed.y += sin(aSwim.x - ax * 2.2) * ax * ax * 0.32;
        transformed.y += sin(aSwim.x * 0.5 + position.z * 3.0) * 0.015;
      }`;
    }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime; varying vec3 vCW; varying vec3 vCN;\n${opts.swim ? 'attribute vec4 aSwim;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${deform}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 cw = vec4(transformed, 1.0); vec3 cn = objectNormal;
          #ifdef USE_INSTANCING
            cw = instanceMatrix * cw; cn = mat3(instanceMatrix) * cn;
          #endif
          cw = modelMatrix * cw; vCW = cw.xyz; vCN = normalize(mat3(modelMatrix) * cn); }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${CAUSTIC_GLSL}\nuniform vec3 uSheen;`)
      .replace('#include <opaque_fragment>', `
        {
          float up = smoothstep(-0.15, 0.9, normalize(vCN).y);
          float cz = bhCaustic(vCW.xz + vCW.y * vec2(0.18, 0.12), uTime * 0.55);
          outgoingLight += diffuseColor.rgb * uCausCol * (cz * up * uCaus * ${caus.toFixed(3)});
          vec3 vd = normalize(vViewPosition);
          float fr = pow(1.0 - clamp(abs(dot(normal, vd)), 0.0, 1.0), 2.4);
          outgoingLight += uRimCol * fr * ${rim.toFixed(3)} + uSheen * fr * (0.6 + 0.4 * sin(vCW.x * 3.0 + vCW.y * 4.0 + uTime));
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'uw' + JSON.stringify({ s: opts.sway, w: opts.swim, c: caus, r: rim, h: !!sheen });
  return mat;
}
