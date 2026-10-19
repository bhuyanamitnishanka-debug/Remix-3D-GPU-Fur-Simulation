import * as THREE from 'three';

// Note: Mochi-Puff is treated as a 2-inch × 2-inch miniature creature (1 Three.js unit ≈ 1 inch).
export const ENVIRONMENT_PRESETS = [
  {
    id: 'studio',
    name: 'Studio',
    subtitle: 'Black Cyclorama',
    lightAngle: -74,
    lightIntensity: 1.35,
    rimIntensity: 1.35,
    windStrength: 0.95,
    keyColor: '#fff7ed',
    rimColor: '#c4b5fd',
    hemiSkyColor: '#f5d0fe',
    hemiGroundColor: '#1e1b4b',
    hemiIntensity: 0.85,
    envSkyColor: '#f5d0fe',
    envGroundColor: '#1e1b4b',
    envTintStrength: 0.0,
    ambientIntensity: 0.62,
    exposure: 1.08,
    rimLightPos: [-2.4, 1.8, -3.2]
  },
  {
    id: 'meadow',
    name: 'Cloud Sky',
    subtitle: 'Blue Sky & Clouds',
    lightAngle: 137,
    lightIntensity: 1.36,
    rimIntensity: 0.98,
    windStrength: 0.70,
    keyColor: '#fffbeb',
    rimColor: '#e0f2fe',
    hemiSkyColor: '#60a5fa',
    hemiGroundColor: '#dbeafe',
    hemiIntensity: 0.94,
    envSkyColor: '#7dd3fc',
    envGroundColor: '#dbeafe',
    envTintStrength: 0.34,
    ambientIntensity: 0.66,
    exposure: 0.98,
    rimLightPos: [-2.4, -1.2, -2.6]
  },
  {
    id: 'highrise',
    name: 'Cozy Desk',
    subtitle: 'Tilt-Shift Dusk View',
    lightAngle: 108,
    lightIntensity: 1.38,
    rimIntensity: 0.50,
    windStrength: 0.24,
    keyColor: '#ffd8a8',
    rimColor: '#f472b6',
    hemiSkyColor: '#818cf8',
    hemiGroundColor: '#c2410c',
    hemiIntensity: 0.96,
    envSkyColor: '#93c5fd',
    envGroundColor: '#fb923c',
    envTintStrength: 0.56,
    ambientIntensity: 0.65,
    exposure: 1.12,
    rimLightPos: [-1.1, 1.65, -3.6]
  },
  {
    id: 'ar',
    name: 'AR View',
    subtitle: 'Live Camera',
    lightAngle: -32,
    lightIntensity: 1.42,
    rimIntensity: 1.25,
    windStrength: 0.80,
    keyColor: '#fffdf7',
    rimColor: '#67e8f9',
    hemiSkyColor: '#e0f2fe',
    hemiGroundColor: '#475569',
    hemiIntensity: 0.96,
    envSkyColor: '#e0f2fe',
    envGroundColor: '#64748b',
    envTintStrength: 0.30,
    ambientIntensity: 0.68,
    exposure: 1.08,
    rimLightPos: [-2.2, 1.8, -3.0]
  }
];

const ALLOWED_ENV_IDS = new Set(ENVIRONMENT_PRESETS.map((e) => e.id));

export function sanitizeEnvId(val, fallback = 'studio') {
  if (typeof val === 'string' && ALLOWED_ENV_IDS.has(val)) {
    return val;
  }
  return fallback;
}

// ============================================================================
// 1. CLOUD SKY SHADERS (360° Blue Sky & Fluffy Cloud Sea — Zero Grass)
// ============================================================================

const MEADOW_SKY_VERTEX_SHADER = /* glsl */ `
  uniform vec3 uSunDir;
  varying vec3 vWorldDir;
  varying vec4 vClipPos;
  varying vec2 vSunNDC;
  varying float vSunForward;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldDir = position;
    vClipPos = projectionMatrix * viewMatrix * wp;
    vec3 sunWorldPos = normalize(uSunDir) * 48.0;
    vec4 sunViewPos = viewMatrix * modelMatrix * vec4(sunWorldPos, 1.0);
    vSunForward = -sunViewPos.z / max(1.0, length(sunViewPos.xyz));
    vec4 sunClip = projectionMatrix * sunViewPos;
    vSunNDC = sunClip.xy / max(0.001, abs(sunClip.w));
    gl_Position = vClipPos;
  }
`;

const MEADOW_SKY_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uWindStrength;
  uniform vec3 uSunDir;
  varying vec3 vWorldDir;
  varying vec4 vClipPos;
  varying vec2 vSunNDC;
  varying float vSunForward;

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm5(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      v += amp * valueNoise(p);
      p = rot * p * 2.02 + vec2(17.3, 9.1);
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float y = dir.y;
    vec3 sunDir = normalize(uSunDir);
    float sunDot = max(0.0, dot(dir, sunDir));

    vec3 deepZenith = vec3(0.10, 0.32, 0.85);
    vec3 midCerulean = vec3(0.24, 0.62, 0.96);
    vec3 softAzure = vec3(0.58, 0.85, 0.99);
    vec3 horizonGlow = vec3(0.88, 0.96, 1.0);

    float skyElev = clamp(abs(y), 0.0, 1.0);
    vec3 sky = mix(horizonGlow, softAzure, smoothstep(0.0, 0.18, skyElev));
    sky = mix(sky, midCerulean, smoothstep(0.14, 0.52, skyElev));
    sky = mix(sky, deepZenith, pow(skyElev, 1.15));

    if (y < 0.0) {
      vec3 lowerSky = mix(horizonGlow, vec3(0.42, 0.73, 0.96), smoothstep(0.0, 0.85, -y));
      sky = lowerSky;
    }

    // 3D orthonormal tangent frame around sunDir for volumetric 3D solar rays
    vec3 sunRight = normalize(cross(vec3(0.0, 1.0, 0.0), sunDir) + vec3(1e-4, 0.0, 0.0));
    vec3 sunUp = cross(sunDir, sunRight);
    float rayAngle = atan(dot(dir, sunUp), dot(dir, sunRight));
    float camTwist = (vSunNDC.x * 0.65 - vSunNDC.y * 0.45);
    float godRays = 0.5 + 0.5 * sin(rayAngle * 10.0 + camTwist + uTime * 0.18) * cos(rayAngle * 6.0 - camTwist * 0.8 - uTime * 0.12);
    float starNeedles = pow(max(0.0, cos(rayAngle * 4.0 + camTwist * 0.7)), 18.0) * pow(sunDot, 22.0);
    sky += vec3(1.0, 0.94, 0.76) * pow(sunDot, 5.5) * (0.28 + 0.14 * godRays);
    sky += vec3(1.0, 0.97, 0.86) * (pow(sunDot, 36.0) * 0.65 + starNeedles * 0.55);
    sky += vec3(1.0, 0.99, 0.95) * smoothstep(0.9965, 0.9994, sunDot) * 1.45;

    float driftSpeed = 0.012 * (0.5 + 0.5 * uWindStrength);

    if (y > -0.05) {
      float projY = max(0.04, y + 0.20);
      vec2 skyUV = dir.xz / projY;

      float cirrus = fbm5(skyUV * vec2(0.8, 2.1) + vec2(uTime * driftSpeed * 0.5, 4.2));
      float cirrusMask = smoothstep(0.58, 0.82, cirrus) * smoothstep(0.02, 0.35, y) * 0.38;
      sky = mix(sky, vec3(0.99, 0.995, 1.0), cirrusMask);

      vec2 cumUV = skyUV * 1.12 + vec2(uTime * driftSpeed, -uTime * driftSpeed * 0.45);
      float warp = fbm5(cumUV * 0.85 + vec2(3.1, 7.4));
      float cBase = fbm5(cumUV + warp * 0.35);
      float cDetail = fbm5(cumUV * 2.3 - vec2(uTime * driftSpeed * 0.7, 0.0));
      float cloudDensity = smoothstep(0.44, 0.72, cBase * 0.74 + cDetail * 0.26);
      cloudDensity *= smoothstep(-0.04, 0.14, y);

      float topGrad = clamp(0.54 + 0.46 * (cBase - cDetail * 0.52) + 0.35 * sunDot, 0.0, 1.0);
      float silverLining = pow(sunDot, 6.0) * smoothstep(0.44, 0.62, cBase) * (1.0 - smoothstep(0.62, 0.78, cBase));
      vec3 cloudBright = vec3(1.0, 0.99, 0.97) + vec3(1.0, 0.93, 0.78) * silverLining * 0.85;
      vec3 cloudMid = vec3(0.87, 0.93, 0.99);
      vec3 cloudUnder = vec3(0.68, 0.80, 0.94);
      vec3 cloudColor = mix(cloudUnder, cloudMid, smoothstep(0.2, 0.55, topGrad));
      cloudColor = mix(cloudColor, cloudBright, smoothstep(0.5, 0.92, topGrad));

      sky = mix(sky, cloudColor, cloudDensity * 0.93);
    }

    // Lower Hemisphere Billowing Cloud Sea (Floating Above the Clouds — Zero Grass!)
    if (y < 0.08) {
      float seaMask = smoothstep(0.08, -0.06, y);
      vec2 seaUV = dir.xz / max(0.16, -y + 0.22) * 1.35 + vec2(uTime * driftSpeed * 0.85, -uTime * driftSpeed * 0.35);

      float puff1 = fbm5(seaUV);
      float puff2 = fbm5(seaUV * 2.15 + vec2(5.2, -3.7));
      float puffs = puff1 * 0.72 + puff2 * 0.28;

      float cloudCover = smoothstep(0.32, 0.68, puffs);
      float sunCrest = smoothstep(0.52, 0.84, puff1) * (0.65 + 0.35 * sunDot);

      vec3 valleyBlue = vec3(0.52, 0.78, 0.97);
      vec3 cloudShadowCol = vec3(0.74, 0.85, 0.97);
      vec3 cloudTopWhite = vec3(0.99, 0.99, 1.0);
      vec3 cloudWarmGold = vec3(1.0, 0.96, 0.90);

      vec3 seaCol = mix(valleyBlue, cloudShadowCol, cloudCover);
      seaCol = mix(seaCol, cloudTopWhite, smoothstep(0.42, 0.72, puffs));
      seaCol = mix(seaCol, cloudWarmGold, sunCrest * 0.75);

      float horizonMistBand = exp(-abs(y) * 12.0);
      seaCol = mix(seaCol, vec3(0.94, 0.98, 1.0), horizonMistBand * 0.55);

      sky = mix(sky, seaCol, seaMask);
    }

    gl_FragColor = vec4(sky * 0.94, 1.0);
  }
`;

// 3D Camera-Projected Optical Lens Flare Shader (visible when looking towards the light, with 3D parallax bokeh ghosts)
const MEADOW_LENS_FLARE_VERTEX_SHADER = /* glsl */ `
  uniform vec3 uSunDir;
  varying vec2 vNdc;
  varying vec2 vSunNDC;
  varying float vSunForward;
  void main() {
    vNdc = position.xy;
    vec3 sunWorldPos = normalize(uSunDir) * 48.0;
    vec4 sunViewPos = viewMatrix * vec4(sunWorldPos, 1.0);
    vSunForward = -sunViewPos.z / max(1.0, length(sunViewPos.xyz));
    vec4 sunClip = projectionMatrix * sunViewPos;
    vSunNDC = sunClip.xy / max(0.001, abs(sunClip.w));
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const MEADOW_LENS_FLARE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec2 vNdc;
  varying vec2 vSunNDC;
  varying float vSunForward;

  // Soft 6-blade hexagonal camera aperture bokeh disc (filled & dreamy, zero harsh rings)
  float softBokehGhost(vec2 p, vec2 center, float radius, float rot) {
    vec2 dVec = (p - center) / max(0.001, radius);
    float r = length(dVec);
    float ang = atan(dVec.y, dVec.x) + rot;
    float hexR = r * (0.94 + 0.06 * cos(ang * 6.0));
    float core = pow(max(0.0, 1.0 - hexR), 1.6) * 0.72;
    float feather = smoothstep(0.60, 0.92, hexR) * (1.0 - smoothstep(0.92, 1.04, hexR)) * 0.22;
    return core + feather;
  }

  void main() {
    // Only visible when the camera is looking towards the 3D light source
    if (vSunForward <= 0.12) {
      discard;
    }
    vec2 aspect = vec2(1.55, 1.0);
    vec2 p = vNdc * aspect;
    vec2 sunP = vSunNDC * aspect;

    float offAxis = length(vSunNDC);
    // Smooth angular fade as the 3D sun enters/exits the camera frustum
    float frustumVis = smoothstep(0.12, 0.55, vSunForward) * (1.0 - smoothstep(0.75, 1.55, offAxis));
    // Partial occlusion when the sun passes directly behind Mochi-Puff's body at center of frame, blooming as it peeks past his ears
    float mochiOcclusion = 0.22 + 0.78 * smoothstep(0.10, 0.34, offAxis);
    float flareVis = frustumVis * mochiOcclusion;

    if (flareVis <= 0.002) {
      discard;
    }

    vec2 toSun = p - sunP;
    float dSun = length(toSun);
    float sAng = atan(toSun.y, toSun.x);
    float camRoll = vSunNDC.x * 1.15 - vSunNDC.y * 0.75;

    // 1. 3D Solar Core Bloom, Rotating Diffraction Starburst Needles & Subtle Anamorphic Glint
    float sunBloom = exp(-dSun * 3.0) * 0.28 + exp(-dSun * 10.5) * 0.38;
    float needles8 = pow(max(0.0, cos(sAng * 4.0 + camRoll)), 20.0) * exp(-dSun * 4.2) * 0.30;
    float needles12 = pow(max(0.0, cos(sAng * 6.0 - camRoll * 0.6 + uTime * 0.15)), 28.0) * exp(-dSun * 5.5) * 0.18;
    float anamorphic = exp(-abs(toSun.y) * 32.0) * exp(-abs(toSun.x) * 2.6) * 0.18;

    // 2. 3D Counter-Parallax Bokeh Ghost Chain pivoting through the optical center (0, 0)
    float g1 = softBokehGhost(p, sunP *  0.52, 0.095, camRoll * 0.5);
    float g2 = softBokehGhost(p, sunP *  0.16, 0.055, -camRoll * 0.4);
    float g3 = softBokehGhost(p, sunP * -0.24, 0.125, camRoll * 0.6);
    float g4 = softBokehGhost(p, sunP * -0.58, 0.080, -camRoll * 0.5);
    float g5 = softBokehGhost(p, sunP * -0.94, 0.175, camRoll * 0.7);
    float g6 = softBokehGhost(p, sunP * -1.28, 0.110, -camRoll * 0.3);

    vec3 flareCol = vec3(1.0, 0.94, 0.80) * (sunBloom + needles8 + needles12)
                  + vec3(0.90, 0.96, 1.0) * anamorphic
                  + vec3(1.0, 0.90, 0.72) * g1 * 0.24
                  + vec3(0.76, 0.96, 0.92) * g2 * 0.26
                  + vec3(1.0, 0.80, 0.88) * g3 * 0.22
                  + vec3(0.78, 0.88, 1.0) * g4 * 0.24
                  + vec3(1.0, 0.93, 0.78) * g5 * 0.19
                  + vec3(0.88, 0.82, 1.0) * g6 * 0.16;

    gl_FragColor = vec4(flareCol * flareVis, 1.0);
  }
`;

// ============================================================================
// 2. LOOP 13–17: COZY HOME DESK & TILT-SHIFT TWILIGHT MOUNTAIN VALLEY SHADERS
// ============================================================================

const CITY_SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vWorldDir = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// Loop 13: High-Elevation Twilight Sunset Clouds, Misty Mountain Ridges &
// 4-Layer Tilt-Shift Bokeh Hillside City Lights
const CITY_SKY_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldDir;

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm4(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      v += amp * valueNoise(p);
      p = rot * p * 2.03 + vec2(11.7, 5.3);
      amp *= 0.5;
    }
    return v;
  }

  // Creamy Tilt-Shift Bokeh Circle-of-Confusion Layer with Slow Meditative Pulse
  vec3 bokehLayer(vec2 uv, float scale, float density, float radius, float seedOffset, float time) {
    vec2 g = uv * scale;
    vec2 cell = floor(g);
    vec2 f = fract(g) - 0.5;
    vec3 accum = vec3(0.0);

    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 neighbor = vec2(float(i), float(j));
        vec2 cId = cell + neighbor;
        float h = hash21(cId + seedOffset);
        if (h > density) {
          vec2 jitter = (vec2(fract(h * 17.3), fract(h * 31.7)) - 0.5) * 0.72;
          vec2 delta = f - neighbor - jitter;
          // Slight optical cat-eye / oval bokeh stretch
          float d = length(delta * vec2(1.0, 1.12));

          // Slow breathing pulse per bokeh orb (period ~9–12 seconds)
          float slowPulse = 0.5 + 0.5 * sin(time * 0.62 + h * 62.83 + sin(time * 0.27 + h * 19.1) * 0.65);
          float r = radius * (0.54 + 0.74 * fract(h * 11.1)) * (0.85 + 0.25 * slowPulse);

          // Authentic lens aperture disc with subtle bright outer bokeh ring
          float inner = 1.0 - smoothstep(r * 0.68, r, d);
          float outerRim = 0.72 + 0.42 * smoothstep(r * 0.25, r * 0.82, d);
          float disc = inner * outerRim;
          float twinkle = 0.28 + 1.02 * slowPulse;

          vec3 warmGold   = vec3(1.0, 0.79, 0.40);
          vec3 honeyAmber = vec3(0.99, 0.54, 0.22);
          vec3 rosePeach  = vec3(1.0, 0.68, 0.64);
          vec3 iceBlue    = vec3(0.76, 0.90, 1.0);

          float cPick = fract(h * 23.7);
          vec3 bCol = warmGold;
          if (cPick < 0.46) bCol = warmGold;
          else if (cPick < 0.78) bCol = honeyAmber;
          else if (cPick < 0.91) bCol = rosePeach;
          else bCol = iceBlue;

          accum += bCol * disc * twinkle * (0.65 + 0.65 * fract(h * 43.1));
        }
      }
    }
    return accum;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float y = dir.y;
    float az = atan(dir.x, -dir.z); // 0 directly out the window (-Z)

    // 1. Dusk Blue-Hour & Rose-Coral Sunset Sky (High in the Window)
    vec3 nightZenith   = vec3(0.06, 0.09, 0.18);
    vec3 twilightSlate = vec3(0.16, 0.23, 0.37);
    vec3 lavenderDusk  = vec3(0.45, 0.36, 0.54);
    vec3 roseSunset    = vec3(0.86, 0.48, 0.58);
    vec3 warmApricot   = vec3(0.95, 0.64, 0.54);

    float skyT = clamp((y - 0.16) / 0.58, 0.0, 1.0);
    vec3 col = mix(warmApricot, roseSunset, smoothstep(0.0, 0.22, skyT));
    col = mix(col, lavenderDusk, smoothstep(0.18, 0.46, skyT));
    col = mix(col, twilightSlate, smoothstep(0.40, 0.74, skyT));
    col = mix(col, nightZenith, smoothstep(0.68, 1.0, skyT));

    // Dramatic layered dusk cloud bands sweeping across the sunset sky
    if (y > 0.10) {
      vec2 duskUV = vec2(az * 2.4, (y - 0.10) * 7.2);
      float c1 = fbm4(duskUV + vec2(uTime * 0.005, 0.0));
      float c2 = fbm4(duskUV * 1.85 - vec2(uTime * 0.003, 1.4));

      // Glowing pink-salmon sunset undersides
      float pinkBand = exp(-pow((y - 0.31) * 6.2, 2.0));
      vec3 litCloud = mix(vec3(0.96, 0.58, 0.62), vec3(1.0, 0.74, 0.64), c1);
      col = mix(col, litCloud, smoothstep(0.32, 0.68, c1) * pinkBand * 0.82);

      // Dark blue-slate silhouette cloud billows floating in front of the pink glow
      vec3 darkBillow = mix(vec3(0.15, 0.20, 0.33), vec3(0.24, 0.26, 0.40), c1);
      float darkMask = smoothstep(0.47, 0.76, c2) * smoothstep(0.14, 0.58, y);
      col = mix(col, darkBillow, darkMask * 0.68);
    }

    // 2. High-Elevation Misty Mountain Valley Silhouettes (Positioned prominently in window view)
    // Far mountain range peaking around y = 0.28..0.36
    float farRidge =
      0.27 +
      0.065 * sin(az * 2.1 - 0.55) +
      0.042 * cos(az * 3.6 + 1.2) +
      0.014 * fbm4(vec2(az * 7.5, 1.0));

    // Near/Mid mountain slopes framing left & right, dipping into a deep valley saddle at center-left
    float valleySaddle = 1.0 - 0.48 * exp(-pow((az + 0.12) * 2.3, 2.0));
    float midRidge =
      (0.28 * valleySaddle) +
      0.075 * sin(az * 2.5 + 0.85) +
      0.032 * cos(az * 4.8 - 0.5) +
      0.011 * fbm4(vec2(az * 9.5, 2.5));

    // Distant hazy blue mountain layer
    if (y < farRidge) {
      float farMask = smoothstep(farRidge, farRidge - 0.015, y);
      float farDepth = clamp((farRidge - y) * 5.0, 0.0, 1.0);
      vec3 farMtnCol = mix(vec3(0.20, 0.27, 0.43), vec3(0.13, 0.19, 0.33), farDepth);
      col = mix(col, farMtnCol, farMask);
    }

    // Main mountain valley bowl & cascading hillside city lights
    if (y < midRidge) {
      float midMask = smoothstep(midRidge, midRidge - 0.014, y);
      float slopeDepth = clamp((midRidge - y) * 2.6, 0.0, 1.0);
      vec3 valleyBase = mix(vec3(0.11, 0.16, 0.29), vec3(0.045, 0.068, 0.14), slopeDepth);

      // Perspective mapping across the valley hillsides (stretching from y = midRidge down to y = -0.25)
      float vDrop = max(0.005, midRidge - y);
      vec2 valleyUV = vec2(az / (0.32 + vDrop * 0.85) * 1.45, log(1.0 + vDrop * 6.5) * 1.35);

      // Organic town & hillside neighborhood density map
      float townDensity = fbm4(valleyUV * 1.5 + vec2(1.7, 0.9));
      float bowlMask = smoothstep(0.006, 0.045, vDrop) *
                       smoothstep(0.16, 0.62, townDensity + 0.32 * (1.0 - abs(az * 0.85)));

      // Slow valley-wide breathing pulse wave for the background environment lights
      float valleyPulseWave = 0.74 + 0.26 * sin(uTime * 0.52 - valleyUV.x * 1.2 + valleyUV.y * 0.8);

      // Warm golden-amber & misty blue atmospheric town glow on the mountain slopes
      valleyBase += vec3(0.36, 0.21, 0.16) * bowlMask * 0.46 * valleyPulseWave;
      valleyBase += vec3(0.12, 0.20, 0.35) * exp(-abs(vDrop - 0.11) * 12.0) * 0.38;

      // Loop 22: Drifting Blue-Violet Valley Twilight Mist Bands & Terraced Hillside Contours
      float mistBand1 = exp(-pow((vDrop - 0.065 + 0.015 * sin(az * 4.0 + uTime * 0.02)) * 22.0, 2.0));
      float mistBand2 = exp(-pow((vDrop - 0.155 - 0.018 * cos(az * 3.2 - uTime * 0.015)) * 18.0, 2.0));
      valleyBase = mix(valleyBase, vec3(0.18, 0.25, 0.42), (mistBand1 * 0.36 + mistBand2 * 0.28) * bowlMask);

      // Loop 22: Micro-Scale Lit Hillside Chalet Window Grids & Terraced Retaining Walls (slowly pulsing circular motes)
      vec2 chaletGrid = valleyUV * vec2(68.0, 42.0);
      vec2 chaletCell = floor(chaletGrid);
      vec2 chaletF = fract(chaletGrid);
      float chaletHash = hash21(chaletCell);
      vec2 chaletCenter = vec2(0.5) + (vec2(fract(chaletHash * 13.7), fract(chaletHash * 29.3)) - 0.5) * 0.36;
      float chaletDist = length(chaletF - chaletCenter);
      float chaletWindow =
        step(0.68, chaletHash) *
        smoothstep(0.28, 0.04, chaletDist);
      vec3 chaletCol = mix(vec3(1.0, 0.76, 0.38), vec3(1.0, 0.90, 0.68), fract(chaletHash * 19.3));
      float chaletPulse = 0.30 + 0.70 * (0.5 + 0.5 * sin(uTime * 0.58 + chaletHash * 40.0));
      valleyBase += chaletCol * chaletWindow * bowlMask * chaletPulse * 0.85;

      // Winding illuminated hillside roads / arterial switchback avenues with slowly pulsing streetlamp beads
      float roadWave1 = abs(sin(valleyUV.x * 3.2 + sin(valleyUV.y * 2.6) * 0.8) * 0.25 + valleyUV.y * 0.35 - 0.42);
      float roadWave2 = abs(cos(valleyUV.x * 2.4 - valleyUV.y * 1.9) * 0.22 - 0.18);
      float roadGlow = (exp(-roadWave1 * 28.0) + exp(-roadWave2 * 24.0)) * bowlMask;
      float streetLampBeads = 0.75 + 0.25 * sin(valleyUV.x * 95.0 + valleyUV.y * 65.0);
      valleyBase += vec3(1.0, 0.68, 0.32) * roadGlow * streetLampBeads * 0.48 * valleyPulseWave;

      // 4-Tier Multi-Scale Tilt-Shift Bokeh Orbs (fine distant pinpoints -> large creamy foreground bokeh discs)
      vec3 bokehMicro = bokehLayer(valleyUV, 36.0, 0.34, 0.33, 1.3, uTime);
      vec3 bokehSmall = bokehLayer(valleyUV, 20.0, 0.44, 0.38, 5.7, uTime);
      vec3 bokehMed   = bokehLayer(valleyUV, 10.5, 0.56, 0.43, 13.9, uTime);
      vec3 bokehLarge = bokehLayer(valleyUV, 5.2,  0.68, 0.47, 27.4, uTime) * smoothstep(0.04, 0.24, vDrop);

      vec3 totalBokeh = (
        bokehMicro * 0.42 +
        bokehSmall * 0.62 +
        bokehMed   * 0.85 +
        bokehLarge * 1.15
      ) * bowlMask * valleyPulseWave;

      valleyBase += totalBokeh;
      col = mix(col, valleyBase, midMask);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

const HIGHRISE_FLOOR_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec2 vLocalXZ;
  void main() {
    vLocalXZ = position.xz;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// Loop 14: Macro Satin-Walnut Desktop Shader with Multi-Candle Caustics, Prop AO & Sky Fresnel
const HIGHRISE_FLOOR_FRAGMENT_SHADER = /* glsl */ `
  uniform vec2 uCreatureXZ;
  uniform float uShadowScale;
  uniform float uCreatureLift;
  uniform vec2 uCreatureSquash;
  uniform vec2 uCreatureRot;
  uniform vec3 uKeyLightDir;
  uniform float uKeyLightIntensity;
  uniform vec3 uKeyLightColor;
  uniform float uFurLength;
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec2 vLocalXZ;

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  // Closest normalized distance from a 3D ray (ro, rd) to an ellipsoid (center, radii)
  float rayEllipsoidDist(vec3 ro, vec3 rd, vec3 center, vec3 radii, out float hitT) {
    vec3 o = (ro - center) / radii;
    vec3 d = rd / radii;
    float dLen = max(1e-5, length(d));
    vec3 dn = d / dLen;
    float tProj = max(0.0, -dot(o, dn));
    hitT = tProj / dLen;
    return length(o + dn * tProj);
  }

  // Evaluates Mochi-Puff's 3D anatomical silhouette shadow (pear body, cheeks, perky ears, arms & fur coat)
  // cast onto world desk point P_desk along light direction L_dir
  float traceMochiCastShadow(vec3 P_desk, vec3 L_dir, float basePenumbra) {
    vec3 C_mochi = vec3(uCreatureXZ.x, -0.705 + uCreatureLift, uCreatureXZ.y);
    vec3 sq = max(vec3(0.08), 0.25 * vec3(uCreatureSquash.x, uCreatureSquash.y, uCreatureSquash.x));
    vec3 ro = (P_desk - C_mochi) / sq;
    vec3 rd = normalize(L_dir / sq);

    // Transform light ray into Mochi's live tilted & rotated local coordinate frame
    float cz = cos(-uCreatureRot.y);
    float sz = sin(-uCreatureRot.y);
    ro.xy = mat2(cz, -sz, sz, cz) * ro.xy;
    rd.xy = mat2(cz, -sz, sz, cz) * rd.xy;

    float cy = cos(-uCreatureRot.x);
    float sy = sin(-uCreatureRot.x);
    ro.xz = mat2(cy, -sy, sy, cy) * ro.xz;
    rd.xz = mat2(cy, -sy, sy, cy) * rd.xz;

    float furPad = clamp(uFurLength, 0.05, 0.65) * 0.72;

    // 1. Chubby pear lower belly & cheeks + rounded crown
    float tBelly, tHead;
    float dBelly = rayEllipsoidDist(
      ro, rd,
      vec3(0.0, -0.18, 0.04),
      vec3(1.20 + furPad, 0.78 + furPad * 0.85, 1.04 + furPad),
      tBelly
    );
    float dHead = rayEllipsoidDist(
      ro, rd,
      vec3(0.0, 0.24, 0.0),
      vec3(1.00 + furPad, 0.82 + furPad, 0.94 + furPad),
      tHead
    );
    float dBody = smin(dBelly, dHead, 0.22);
    float hitT = mix(tBelly, tHead, 0.5);

    // 2. Perky sculpted top-left and top-right ears (tilted outward)
    vec3 roEL = ro - vec3(-0.50, 0.90, 0.05);
    vec3 rdEL = rd;
    roEL.xy = mat2(0.90, -0.43, 0.43, 0.90) * roEL.xy;
    rdEL.xy = mat2(0.90, -0.43, 0.43, 0.90) * rdEL.xy;
    float tEL;
    float dEarL = rayEllipsoidDist(
      roEL, rdEL,
      vec3(0.0),
      vec3(0.28 + furPad * 0.50, 0.48 + furPad * 0.60, 0.25 + furPad * 0.50),
      tEL
    );

    vec3 roER = ro - vec3(0.50, 0.90, 0.05);
    vec3 rdER = rd;
    roER.xy = mat2(0.90, 0.43, -0.43, 0.90) * roER.xy;
    rdER.xy = mat2(0.90, 0.43, -0.43, 0.90) * rdER.xy;
    float tER;
    float dEarR = rayEllipsoidDist(
      roER, rdER,
      vec3(0.0),
      vec3(0.28 + furPad * 0.50, 0.48 + furPad * 0.60, 0.25 + furPad * 0.50),
      tER
    );

    // 3. Cute stubby side arms
    float tAL, tAR;
    float dArmL = rayEllipsoidDist(
      ro, rd,
      vec3(-1.12, -0.08, 0.22),
      vec3(0.32 + furPad * 0.45, 0.24 + furPad * 0.45, 0.26 + furPad * 0.45),
      tAL
    );
    float dArmR = rayEllipsoidDist(
      ro, rd,
      vec3(1.12, -0.08, 0.22),
      vec3(0.32 + furPad * 0.45, 0.24 + furPad * 0.45, 0.26 + furPad * 0.45),
      tAR
    );

    float dEars = min(dEarL, dEarR);
    float dArms = min(dArmL, dArmR);
    if (dEars < dBody) hitT = min(tEL, tER);

    float dMochi = smin(dBody, dEars, 0.16);
    dMochi = smin(dMochi, dArms, 0.14);

    // Soft optical penumbra increasing smoothly along the cast ray
    vec3 hitPos = ro + rd * hitT;
    float tuftAngle = atan(hitPos.y + 0.15, hitPos.x);
    float furFringe = 0.022 * sin(tuftAngle * 32.0) + 0.012 * cos(tuftAngle * 54.0 + 1.2);
    float penumbra = basePenumbra + 0.11 * clamp(hitT, 0.0, 3.2) + furPad * 0.26;

    float coreUmbra = 1.0 - smoothstep(0.55, 0.98 + penumbra * 0.55, dMochi);
    float coatPenumbra = 1.0 - smoothstep(0.75 - penumbra * 0.35, 1.12 + penumbra * 0.75, dMochi + furFringe);
    float distAtten = 1.0 / (1.0 + 0.14 * hitT * hitT + uCreatureLift * 2.4);

    return (coreUmbra * 0.58 + coatPenumbra * 0.42) * distAtten;
  }

  // Soft elliptical ambient occlusion helper for desk props
  float propAO(vec2 xz, vec2 center, vec2 radii, float strength) {
    vec2 d = (xz - center) / radii;
    return 1.0 - strength * exp(-dot(d, d) * 1.8);
  }

  void main() {
    vec2 xz = vWorldPos.xz;

    // 1. Macro-Scale Satin Walnut / Warm Oak Desktop Wood Grain
    float plankY = xz.y * 0.95;
    float boardId = floor(plankY);
    float seam = smoothstep(0.0, 0.012, fract(plankY)) * smoothstep(1.0, 0.988, fract(plankY));

    float cathedral = sin(xz.y * 14.0 + sin(xz.x * 1.8 + boardId * 2.1) * 2.4) * 0.5 + 0.5;
    float finePore  = sin(xz.y * 75.0 + sin(xz.x * 9.5) * 0.9) * 0.5 + 0.5;
    float rayFleck  = sin(xz.x * 28.0 + xz.y * 6.0) * 0.5 + 0.5;

    vec3 walnutDark = vec3(0.22, 0.13, 0.085);
    vec3 walnutMid  = vec3(0.36, 0.22, 0.145);
    vec3 walnutGold = vec3(0.48, 0.30, 0.195);

    vec3 deskCol = mix(walnutDark, walnutMid, cathedral * 0.72 + finePore * 0.18 + rayFleck * 0.10);
    deskCol = mix(deskCol, walnutGold, hash21(vec2(boardId, 3.0)) * 0.25);
    deskCol *= (0.88 + 0.12 * seam);

    // 2. Evaluate Mochi-Puff's Subtle Contact Shadow & Single Key-Light Cast Shadow (~50% softer)
    vec3 P_desk = vec3(xz.x, -0.942, xz.y);
    float furScale = 1.0 + clamp(uFurLength, 0.05, 0.65) * 0.45;
    vec2 relXZ = xz - uCreatureXZ;
    vec2 baseEll = relXZ / vec2(0.31 * uCreatureSquash.x * furScale, 0.25 * uCreatureSquash.x * furScale);
    float baseR2 = dot(baseEll, baseEll);
    float liftAtten = 1.0 / (1.0 + uCreatureLift * 5.0);

    // Gentle, non-aggressive contact shadow tucked right under Mochi's base
    float mochiContactAO = 0.26 * exp(-baseR2 * 2.10) * liftAtten;

    // Single directional cast shadow from the Key Light (~50% less strong for a natural soft shadow)
    vec3 keyRayDir = normalize(vec3(uKeyLightDir.x, max(0.28, uKeyLightDir.y * 0.62), uKeyLightDir.z));
    float keyLightFactor = clamp(uKeyLightIntensity * 0.28, 0.10, 0.44);
    float keyCastShadow = traceMochiCastShadow(P_desk, keyRayDir, 0.16) * keyLightFactor;

    float totalMochiShadow = clamp(max(mochiContactAO, keyCastShadow), 0.0, 0.46);

    // 3. Warm Flickering Candlelight Pools & Cut-Glass Votive Caustic Shimmer
    float flk1 = 0.95 + 0.05 * sin(uTime * 6.4 + 0.8);
    float flk2 = 0.95 + 0.05 * cos(uTime * 5.2 + 2.3);

    vec2 rightCluster = vec2(0.80, -0.64);
    vec2 leftCluster  = vec2(-1.28, -0.88);
    float dRight = length(xz - rightCluster);
    float dLeft  = length(xz - leftCluster);

    // Subtle radial cut-glass caustic rays around the votive candle holders
    float angR = atan(xz.y - rightCluster.y, xz.x - rightCluster.x);
    float causticR = (0.82 + 0.18 * sin(angR * 18.0 + uTime * 1.2)) * exp(-dRight * 0.65) * flk1;
    causticR *= (1.0 - totalMochiShadow * 0.55);

    float angL = atan(xz.y - leftCluster.y, xz.x - leftCluster.x);
    float causticL = (0.84 + 0.16 * cos(angL * 16.0 - uTime * 1.1)) * exp(-dLeft * 0.68) * flk2;
    float sillWarmth = exp(-pow(xz.y + 2.65, 2.0) * 0.42) * (1.0 - smoothstep(0.0, 5.5, abs(xz.x)));

    float warmPool = causticR * 1.25 + causticL * 1.05 + sillWarmth * 0.92;
    deskCol *= (0.46 + 0.82 * clamp(warmPool, 0.0, 1.45));
    deskCol += vec3(0.62, 0.30, 0.09) * pow(clamp(warmPool, 0.0, 1.25), 1.35) * 0.68 * (1.0 - totalMochiShadow * 0.50);

    // 4. Soft Dusk Pink-Blue Window Sky Reflection on Satin Wood Varnish
    float skyFresnel = exp(-pow(xz.y + 1.65, 2.0) * 0.22) * (1.0 - smoothstep(0.0, 5.2, abs(xz.x)));
    deskCol += mix(vec3(0.14, 0.18, 0.32), vec3(0.28, 0.16, 0.24), smoothstep(-3.0, 2.0, xz.x)) * skyFresnel * 0.42 * (1.0 - totalMochiShadow * 0.45);

    // 5. Soft Contact Ambient Occlusion Under Desk Props (Monitor, Keyboard, Single Mug, Magazine, Caddy, Book Stack)
    float ao = 1.0;
    ao *= propAO(xz, vec2(1.18, -1.52), vec2(0.58, 0.45), 0.52); // Monitor stand foot
    ao *= propAO(xz, vec2(0.76, -0.58), vec2(0.78, 0.32), 0.48); // Wireless keyboard
    ao *= propAO(xz, vec2(1.32, -0.18), vec2(0.22, 0.28), 0.42); // Wireless mouse
    ao *= propAO(xz, vec2(-1.14, -0.44), vec2(0.40, 0.40), 0.55); // Single coffee mug & saucer
    ao *= propAO(xz, vec2(-0.52, -1.24), vec2(0.62, 0.44), 0.45); // Open book
    ao *= propAO(xz, vec2(-0.55, -2.15), vec2(0.72, 0.44), 0.50); // Wooden desk caddy
    ao *= propAO(xz, vec2(1.85, -1.48),  vec2(0.55, 0.42), 0.46); // Hardcover book stack
    ao *= propAO(xz, vec2(-1.85, -1.45), vec2(0.45, 0.45), 0.50); // Left planter pot
    deskCol *= ao;

    // 6. Apply Mochi-Puff's Soft Cast & Contact Shadow + Key Light Color Tint
    float cDist = length(xz - uCreatureXZ) / max(0.08, uShadowScale);
    float contactShadow = 1.0 - totalMochiShadow;
    deskCol *= mix(vec3(1.0), uKeyLightColor * 1.08, clamp(uKeyLightIntensity * 0.25, 0.0, 0.45) * contactShadow);
    vec3 shadowedWalnut = deskCol * vec3(0.24, 0.20, 0.25);
    deskCol = mix(shadowedWalnut, deskCol, contactShadow);

    // 7. Subtle Front Desk Edge Highlight & Tilt-Shift Macro Vignette
    float frontEdge = exp(-pow(xz.y - 2.35, 2.0) * 18.0);
    deskCol += vec3(0.24, 0.14, 0.08) * frontEdge * 0.35;

    float edgeDist = length((xz - vec2(0.0, -0.5)) * vec2(0.11, 0.18));
    deskCol *= (1.0 - 0.38 * smoothstep(0.55, 1.25, edgeDist));

    gl_FragColor = vec4(deskCol, 1.0);
  }
`;

const HIGHRISE_GLASS_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const HIGHRISE_GLASS_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    // Warm double-pane interior candle reflection ghosting in the window glass (matching right pane in photo)
    float ghostFlame1 = exp(-length((vUv - vec2(0.76, 0.36)) * vec2(14.0, 18.0)));
    float ghostFlame2 = exp(-length((vUv - vec2(0.79, 0.36)) * vec2(16.0, 20.0)));
    float warmSillGlow = exp(-pow(vUv.y - 0.18, 2.0) * 12.0) * (0.4 + 0.6 * smoothstep(0.2, 0.8, vUv.x));
    float diagSheen = smoothstep(0.38, 0.62, sin((vUv.x * 1.4 + vUv.y) * 6.28));

    vec3 glassCol =
      vec3(0.38, 0.55, 0.85) * (0.20 + 0.20 * diagSheen) +
      vec3(1.0, 0.72, 0.35) * warmSillGlow * 0.75 +
      vec3(1.0, 0.88, 0.55) * (ghostFlame1 + ghostFlame2 * 0.85) * 2.2;

    float alpha = 0.018 + diagSheen * 0.012 + warmSillGlow * 0.035 + (ghostFlame1 + ghostFlame2) * 0.35;
    gl_FragColor = vec4(glassCol, alpha);
  }
`;

// Loop 16: Translucent Subsurface Wax Pillar Candle Shader
const CANDLE_WAX_VERTEX_SHADER = /* glsl */ `
  varying float vLocalY;
  varying vec3 vNormal;
  void main() {
    vLocalY = position.y; // [0..1]
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CANDLE_WAX_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying float vLocalY;
  varying vec3 vNormal;

  void main() {
    float flicker = 0.93 + 0.07 * sin(uTime * 6.5 + vLocalY * 4.0);
    vec3 baseCol = vec3(0.48, 0.22, 0.09);
    vec3 midCol  = vec3(0.95, 0.56, 0.20);
    vec3 topGlow = vec3(1.0, 0.93, 0.65);

    vec3 col = mix(baseCol, midCol, smoothstep(0.0, 0.65, vLocalY));
    col = mix(col, topGlow * flicker, smoothstep(0.50, 1.0, vLocalY));
    gl_FragColor = vec4(col, 0.96);
  }
`;

// Loop 16: Filigree / Ribbed Cut-Glass Votive Holder Shader (sparkles like the glass jars in the photo)
const GLASS_VOTIVE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying float vLocalY;
  varying vec3 vNormal;

  void main() {
    float angle = atan(vNormal.x, vNormal.z);
    float facet = sin(angle * 24.0) * cos(vLocalY * 28.0) * 0.5 + 0.5;
    float sparkle = pow(facet, 3.0) * (0.85 + 0.15 * sin(uTime * 7.2 + angle * 5.0));
    float coreFlame = exp(-pow((vLocalY - 0.38) * 2.6, 2.0));

    vec3 amberGlass = vec3(0.78, 0.34, 0.08);
    vec3 goldSparkle = vec3(1.0, 0.88, 0.48);
    vec3 hotCore = vec3(1.0, 0.96, 0.78);

    vec3 col = mix(amberGlass, goldSparkle, sparkle * 0.75 + coreFlame * 0.45);
    col = mix(col, hotCore, coreFlame * sparkle * 0.85);

    float rim = pow(1.0 - abs(vNormal.z), 1.8);
    col += vec3(1.0, 0.72, 0.32) * rim * 0.45;

    gl_FragColor = vec4(col, 0.92);
  }
`;

// Loop 20: Frosted Pleated Table Lamp Shade Shader (warm glowing cylinder lamp on windowsill)
const PLEATED_LAMP_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying float vLocalY;
  varying vec3 vNormal;

  void main() {
    float angle = atan(vNormal.x, vNormal.z);
    float pleat = sin(angle * 36.0) * 0.5 + 0.5;
    float verticalSeam = smoothstep(0.02, 0.06, abs(sin(angle * 2.0)));
    float bulbCore = exp(-pow((vLocalY - 0.46) * 2.2, 2.0));

    vec3 warmCream = vec3(0.96, 0.78, 0.52);
    vec3 hotAmber  = vec3(1.0, 0.94, 0.76);
    vec3 col = mix(warmCream * (0.84 + 0.16 * pleat), hotAmber, bulbCore * 0.75);
    col *= (0.88 + 0.12 * verticalSeam);

    gl_FragColor = vec4(col, 0.96);
  }
`;

// Loop 20: Animated Teardrop Candle Flame Shader (swaying tip + blue-white base + golden core)
const CANDLE_FLAME_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  varying float vFlameY;
  void main() {
    vFlameY = clamp(position.y * 8.0 + 0.5, 0.0, 1.0);
    vec3 pos = position;
    float sway = sin(uTime * 7.8 + modelMatrix[3].x * 4.5 + modelMatrix[3].z * 3.2) * 0.018 * vFlameY;
    pos.x += sway;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const CANDLE_FLAME_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying float vFlameY;
  void main() {
    vec3 blueBase = vec3(0.45, 0.68, 1.0);
    vec3 hotWhite = vec3(1.0, 0.98, 0.88);
    vec3 goldTip  = vec3(1.0, 0.62, 0.16);

    vec3 col = mix(blueBase, hotWhite, smoothstep(0.0, 0.35, vFlameY));
    col = mix(col, goldTip, smoothstep(0.55, 1.0, vFlameY));
    gl_FragColor = vec4(col, 0.95);
  }
`;

// Loop 18: Curling Translucent Espresso Steam Plume Shader
const COFFEE_STEAM_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    float y = vUv.y;
    float wave1 = sin(y * 9.0 - uTime * 2.1) * 0.14 * y;
    float wave2 = cos(y * 14.0 - uTime * 1.6 + 1.4) * 0.09 * y;

    float d1 = abs(vUv.x - 0.46 - wave1);
    float d2 = abs(vUv.x - 0.54 - wave2);

    float wisp1 = exp(-d1 * d1 * 55.0);
    float wisp2 = exp(-d2 * d2 * 65.0) * 0.75;
    float fade = smoothstep(0.0, 0.22, y) * (1.0 - smoothstep(0.55, 1.0, y));

    float alpha = (wisp1 + wisp2) * fade * 0.28;
    if (alpha < 0.01) discard;

    vec3 steamCol = mix(vec3(0.96, 0.84, 0.72), vec3(0.76, 0.82, 0.94), y);
    gl_FragColor = vec4(steamCol, alpha);
  }
`;

// Loop 23: Artisanal Speckled Stoneware & Hand-Dipped Caramel Glaze Shader (highlights 3D Lathe wheel ribs)
const STONEWARE_CERAMIC_VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;
  void main() {
    vLocalPos = position;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const STONEWARE_CERAMIC_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vec3(0.0, -0.59, 1.60) - vWorldPos);

    // Artisanal speckled stoneware clay & hand-dipped caramel top rim glaze
    // Seamless 3D Cartesian coordinates for speckle noise to eliminate any branch-cut seam
    float speckle = step(0.84, hash21(floor(vec2(vLocalPos.x * 24.0 + vLocalPos.z * 16.0, vLocalPos.y * 85.0))));
    float wheelGroove = sin(vLocalPos.y * 72.0) * 0.5 + 0.5;

    vec3 darkStone  = vec3(0.18, 0.14, 0.13);
    vec3 warmUmber  = vec3(0.32, 0.24, 0.21);
    vec3 caramelLip = vec3(0.68, 0.42, 0.24);

    // Hand-dipped organic wavy glaze line: 2*pi-periodic even harmonics so value and slope are identical across seams
    float angle = atan(vLocalPos.z, vLocalPos.x);
    float glazeLine = 0.54 + 0.022 * sin(angle * 2.0) + 0.012 * cos(angle * 4.0);
    float saucerOuter = smoothstep(0.42, 0.49, length(vLocalPos.xz));
    float dipMask = max(smoothstep(glazeLine - 0.04, glazeLine + 0.04, vLocalPos.y), saucerOuter * 0.75);

    vec3 baseCol = mix(darkStone, warmUmber, 0.35 + 0.45 * wheelGroove + 0.20 * N.y);
    baseCol = mix(baseCol, caramelLip, dipMask * 0.82);
    baseCol -= vec3(0.06) * speckle;

    // Multi-directional warm candle lighting + dusk window rim + front specular sheen on every 3D Lathe rib
    vec3 L_leftCandle  = normalize(vec3(-1.35, -0.35, -0.85) - vWorldPos);
    vec3 L_rightCandle = normalize(vec3(1.15, -0.25, -0.42) - vWorldPos);
    vec3 L_frontWarm   = normalize(vec3(-0.35, 0.45, 1.45));

    float diffL = max(0.0, dot(N, L_leftCandle));
    float diffR = max(0.0, dot(N, L_rightCandle));
    float diffF = max(0.0, dot(N, L_frontWarm));

    vec3 H_front = normalize(L_frontWarm + V);
    vec3 H_left  = normalize(L_leftCandle + V);
    float specF = pow(max(0.0, dot(N, H_front)), 38.0);
    float specL = pow(max(0.0, dot(N, H_left)), 28.0);
    float fresnel = pow(1.0 - max(0.0, dot(N, V)), 2.6);

    vec3 col = baseCol * (0.42 + 0.55 * diffF + 0.65 * diffL + 0.45 * diffR);
    col += vec3(1.0, 0.74, 0.38) * (diffL * 0.28 + specL * 0.65);
    col += vec3(0.98, 0.84, 0.68) * specF * 0.58;
    col += vec3(0.55, 0.64, 0.88) * fresnel * 0.34;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// Loop 18: Painted Sunset Mountain & Candle Artwork Inside Leaning Framed Prints
const FRAMED_PRINT_FRAGMENT_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    // Cream matboard border around the artwork
    float matBorder =
      smoothstep(0.08, 0.10, vUv.x) * (1.0 - smoothstep(0.90, 0.92, vUv.x)) *
      smoothstep(0.08, 0.10, vUv.y) * (1.0 - smoothstep(0.90, 0.92, vUv.y));

    vec3 matCol = vec3(0.94, 0.86, 0.74);
    vec2 artUV = clamp((vUv - 0.10) / 0.80, 0.0, 1.0);

    vec3 skyGrad = mix(vec3(0.88, 0.54, 0.46), vec3(0.22, 0.28, 0.44), artUV.y);
    float ridge1 = 0.46 + 0.12 * sin(artUV.x * 5.0 + 0.5);
    float ridge2 = 0.30 + 0.08 * cos(artUV.x * 7.2 - 0.8);

    vec3 artCol = skyGrad;
    artCol = mix(artCol, vec3(0.18, 0.20, 0.32), smoothstep(ridge1 + 0.02, ridge1 - 0.02, artUV.y));
    artCol = mix(artCol, vec3(0.10, 0.08, 0.14), smoothstep(ridge2 + 0.02, ridge2 - 0.02, artUV.y));

    // Warm sun / botanical motif in the center of the print
    float sunOrb = 1.0 - smoothstep(0.10, 0.13, length(artUV - vec2(0.52, 0.66)));
    artCol = mix(artCol, vec3(1.0, 0.86, 0.62), sunOrb * 0.85);

    vec3 finalCol = mix(matCol, artCol, matBorder);
    gl_FragColor = vec4(finalCol, 1.0);
  }
`;

// Loop 19: Chunky Waffle-Knit Cream Throw Blanket Shader (draped on the lounge armchair)
const KNIT_THROW_FRAGMENT_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    // Macro waffle / cable knit stitch pattern
    vec2 stitchUV = vUv * vec2(42.0, 36.0);
    float cableWave = sin(stitchUV.x * 3.14159 + sin(stitchUV.y * 3.14159) * 0.65) * 0.5 + 0.5;
    float purlBump  = cos(stitchUV.y * 6.28318) * 0.5 + 0.5;
    float softFold  = sin(vUv.x * 14.0 + vUv.y * 9.0) * 0.5 + 0.5;

    vec3 creamShadow = vec3(0.38, 0.31, 0.28);
    vec3 creamMid    = vec3(0.64, 0.55, 0.50);
    vec3 warmRim     = vec3(0.88, 0.72, 0.58);

    float knitRelief = cableWave * 0.55 + purlBump * 0.25 + softFold * 0.20;
    vec3 col = mix(creamShadow, creamMid, knitRelief);

    // Warm candlelight grazing across the right edge of the blanket facing the desk
    float deskGlow = smoothstep(0.25, 0.95, vUv.x) * (0.7 + 0.3 * softFold);
    col = mix(col, warmRim, deskGlow * 0.48);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// Loop 21: Botanical Leaf Venation & Subsurface Candlelight Rim Shader
const FOLIAGE_LEAF_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FOLIAGE_LEAF_FRAGMENT_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    // Central midrib and diagonal lateral veins
    float midrib = exp(-abs(vUv.y - 0.5) * 32.0);
    float latVein = exp(-abs(sin((vUv.x * 10.0 - abs(vUv.y - 0.5) * 14.0) * 3.14159)) * 14.0) *
                    smoothstep(0.05, 0.45, abs(vUv.y - 0.5));

    vec3 deepForest = vec3(0.06, 0.12, 0.09);
    vec3 lushJade   = vec3(0.14, 0.24, 0.16);
    vec3 veinTint   = vec3(0.24, 0.36, 0.20);

    vec3 leafCol = mix(deepForest, lushJade, 0.5 + 0.5 * vNormal.y);
    leafCol = mix(leafCol, veinTint, (midrib * 0.65 + latVein * 0.35));

    // Warm subsurface scattering when backlit by nearby desk candles
    float warmBacklight = exp(-length(vWorldPos.xz - vec2(-2.6, -1.5)) * 0.55) +
                          exp(-length(vWorldPos.xz - vec2(2.8, 0.2)) * 0.55);
    float rim = pow(1.0 - abs(vNormal.z), 1.6);
    leafCol += vec3(0.65, 0.42, 0.14) * (rim * 0.42 + warmBacklight * 0.28);

    gl_FragColor = vec4(leafCol, 1.0);
  }
`;

// Loop 15: Glossy Monitor Screen Reflection Shader (reflects dusk clouds, mountain ridge, tree leaves & candle bokeh)
const MONITOR_SCREEN_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  void main() {
    // Reflected twilight sky & mountain silhouette
    vec3 skyTop  = vec3(0.12, 0.18, 0.32);
    vec3 skyRose = vec3(0.64, 0.40, 0.50);
    vec3 mtnSil  = vec3(0.05, 0.08, 0.15);

    float mtnLine = 0.34 + 0.08 * sin(vUv.x * 4.5 + 0.6);
    vec3 col = mix(skyRose, skyTop, smoothstep(0.32, 0.95, vUv.y));
    col = mix(col, mtnSil, smoothstep(mtnLine + 0.02, mtnLine - 0.02, vUv.y));

    // Tiny reflected valley city lights on the mountain silhouette inside the monitor (slowly pulsing)
    if (vUv.y < mtnLine) {
      vec2 g = floor(vUv * vec2(36.0, 22.0));
      float h = hash21(g);
      if (h > 0.78) {
        float mPulse = 0.30 + 0.70 * (0.5 + 0.5 * sin(uTime * 0.62 + h * 40.0));
        col += vec3(1.0, 0.74, 0.36) * (0.4 + 0.4 * fract(h * 13.0)) * mPulse;
      }
    }

    // Intricate dark tree branch & leaf cluster silhouette reflected across left/center of screen (exact photo match!)
    vec2 leafUV = vUv * vec2(1.4, 1.1);
    float branchReach = (1.0 - vUv.x) * 0.75 + vUv.y * 0.45;
    float leafCluster =
      sin(leafUV.x * 26.0 + sin(leafUV.y * 18.0) * 1.5) *
      cos(leafUV.y * 24.0 + cos(leafUV.x * 14.0) * 1.5);
    float foliageMask = smoothstep(0.42, 0.72, branchReach + leafCluster * 0.24);
    col = mix(col, vec3(0.02, 0.03, 0.06), foliageMask * 0.88);

    // Warm golden candlelight reflection along the right & bottom edge of the glossy display
    float candleGlint = exp(-pow(vUv.x - 0.82, 2.0) * 10.0) * exp(-pow(vUv.y - 0.25, 2.0) * 8.0);
    col += vec3(1.0, 0.68, 0.30) * candleGlint * 0.55;

    // Crisp diagonal glass specular highlight
    float sheen = smoothstep(0.46, 0.54, vUv.x * 0.65 + vUv.y * 0.55);
    col += vec3(0.10, 0.14, 0.22) * sheen * 0.38;

    // Dark bezel border around the screen
    float bezel =
      smoothstep(0.0, 0.028, vUv.x) * (1.0 - smoothstep(0.972, 1.0, vUv.x)) *
      smoothstep(0.0, 0.042, vUv.y) * (1.0 - smoothstep(0.958, 1.0, vUv.y));
    col = mix(vec3(0.03, 0.04, 0.06), col, bezel);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// Loop 15: Procedural Individual-Keycap Wireless Keyboard Shader
const KEYBOARD_TOP_FRAGMENT_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    // Brushed warm-lit aluminum keyboard deck
    vec3 aluDeck = mix(vec3(0.55, 0.46, 0.42), vec3(0.78, 0.66, 0.58), vUv.x * 0.6 + vUv.y * 0.4);

    // 15 columns x 6 rows of dark chiclet keycaps
    vec2 padUV = (vUv - vec2(0.04, 0.08)) / vec2(0.92, 0.84);
    if (padUV.x > 0.0 && padUV.x < 1.0 && padUV.y > 0.0 && padUV.y < 1.0) {
      vec2 grid = padUV * vec2(15.0, 6.0);
      vec2 cellId = floor(grid);
      vec2 f = fract(grid);

      // Spacebar on bottom row (row 0, columns 4..9)
      if (cellId.y < 0.5 && cellId.x >= 4.0 && cellId.x <= 9.0) {
        f.x = (padUV.x * 15.0 - 4.0) / 6.0;
      }

      float keyMask =
        smoothstep(0.08, 0.15, f.x) * (1.0 - smoothstep(0.85, 0.92, f.x)) *
        smoothstep(0.10, 0.18, f.y) * (1.0 - smoothstep(0.82, 0.90, f.y));

      // Warm candlelight rim reflection on top/right edge of each keycap
      float keyRim = smoothstep(0.65, 0.88, f.x) + smoothstep(0.68, 0.88, f.y);
      vec3 keyCol = vec3(0.09, 0.10, 0.14) + vec3(0.32, 0.22, 0.16) * keyRim * 0.45;

      aluDeck = mix(aluDeck, keyCol, keyMask);
    }

    gl_FragColor = vec4(aluDeck, 1.0);
  }
`;

// Loop 15: Open Illustrated Magazine / Sketchbook Page Shader
const BOOK_PAGE_FRAGMENT_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    // Center spine crease at vUv.x = 0.5
    float spineDist = abs(vUv.x - 0.5);
    float spineShadow = 0.62 + 0.38 * smoothstep(0.0, 0.08, spineDist);
    float pageArch = 0.92 + 0.08 * sin(spineDist * 6.28);

    vec3 paperWarm = vec3(0.92, 0.84, 0.76) * spineShadow * pageArch;

    // Printed editorial layout (photo blocks & text lines on left and right pages)
    vec2 pageUV = vec2(fract(vUv.x * 2.0), vUv.y);
    float margin = smoothstep(0.10, 0.12, pageUV.x) * (1.0 - smoothstep(0.88, 0.90, pageUV.x)) *
                   smoothstep(0.10, 0.12, pageUV.y) * (1.0 - smoothstep(0.88, 0.90, pageUV.y));

    // Editorial illustration block on upper half of left page
    if (vUv.x < 0.5 && pageUV.y > 0.45 && pageUV.y < 0.84 && pageUV.x > 0.14 && pageUV.x < 0.86) {
      vec3 artCol = mix(vec3(0.24, 0.28, 0.38), vec3(0.72, 0.48, 0.42), pageUV.y);
      paperWarm = mix(paperWarm, artCol, 0.75);
    } else if (margin > 0.5) {
      // Faux typography lines
      float lineMask = step(0.45, sin(pageUV.y * 95.0)) * step(0.15, fract(pageUV.x * 2.0));
      paperWarm = mix(paperWarm, vec3(0.28, 0.24, 0.22), lineMask * 0.28);
    }

    gl_FragColor = vec4(paperWarm, 1.0);
  }
`;

// ============================================================================
// 3. AR MODE SPATIAL RETICLE & SHADOW CATCHER SHADER
// ============================================================================

const AR_RETICLE_VERTEX_SHADER = /* glsl */ `
  varying vec2 vLocalXY;
  void main() {
    vLocalXY = position.xz;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const AR_RETICLE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uShadowScale;
  uniform vec3 uKeyLightDir;
  uniform float uKeyLightIntensity;
  varying vec2 vLocalXY;

  void main() {
    float r = length(vLocalXY);
    if (r > 1.34) discard;

    float sScale = clamp(uShadowScale, 0.45, 0.88);
    float scaledR = r / sScale;
    float circularMask = 1.0 - smoothstep(0.62, 1.14, r);

    // Round contact shadow right under Mochi + soft elliptical cast shadow from AR Key Light
    float contactShadow = 0.34 * exp(-scaledR * scaledR * 4.80) * circularMask;
    vec2 castShift = -uKeyLightDir.xz * 0.18;
    vec2 castCoord = (vLocalXY - castShift) / (sScale * 1.05);
    float castCircularMask = 1.0 - smoothstep(0.62, 1.15, length(vLocalXY - castShift * 0.5));
    float castShadow = clamp(uKeyLightIntensity * 0.22, 0.06, 0.32) * exp(-dot(castCoord, castCoord) * 4.20) * castCircularMask;
    float shadowAlpha = max(contactShadow, castShadow);

    float angle = atan(vLocalXY.y, vLocalXY.x);
    float ringInner = smoothstep(0.91, 0.93, r) * (1.0 - smoothstep(0.94, 0.96, r));
    float dash = smoothstep(-0.15, 0.15, sin(angle * 24.0 - uTime * 1.6));
    float ringOuter = smoothstep(1.16, 1.175, r) * (1.0 - smoothstep(1.185, 1.20, r)) * dash;

    float cardinal = smoothstep(0.985, 0.998, abs(cos(angle * 2.0))) *
                     smoothstep(0.84, 0.86, r) * (1.0 - smoothstep(1.02, 1.04, r));

    vec2 dotGrid = fract(vLocalXY * 7.0) - 0.5;
    float lidarDots = (1.0 - smoothstep(0.06, 0.11, length(dotGrid))) *
                      smoothstep(0.35, 0.85, r) * (1.0 - smoothstep(0.85, 0.92, r)) * 0.22;

    vec3 ringColor = mix(
      vec3(0.38, 0.92, 0.99),
      vec3(1.0, 0.60, 0.82),
      0.4 + 0.4 * sin(uTime * 1.8 + angle * 2.0)
    );
    float ringAlpha = ringInner * 0.46 + ringOuter * 0.34 + cardinal * 0.55 + lidarDots;

    vec3 finalRGB = ringColor * (ringAlpha / max(0.001, shadowAlpha + ringAlpha));
    float finalAlpha = clamp(shadowAlpha + ringAlpha, 0.0, 0.86);
    if (finalAlpha < 0.005) discard;

    gl_FragColor = vec4(finalRGB, finalAlpha);
  }
`;

const AR_CURSOR_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const AR_CURSOR_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPulse;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float angle = atan(p.y, p.x);

    // Rotating dashed target circle
    float dash = smoothstep(-0.2, 0.2, sin(angle * 12.0 - uTime * 2.5));
    float ring1 = smoothstep(0.76, 0.79, r) * (1.0 - smoothstep(0.83, 0.86, r)) * dash;
    float ring2 = smoothstep(0.92, 0.94, r) * (1.0 - smoothstep(0.97, 0.99, r));

    // Circular cardinal arc ticks (zero square corners)
    float arcTicks = smoothstep(0.88, 0.96, abs(cos(angle * 2.0))) *
                     smoothstep(0.86, 0.88, r) * (1.0 - smoothstep(0.98, 1.0, r));

    // Central pulsing target dot
    float dot = (1.0 - smoothstep(0.04, 0.08, r)) * (0.7 + 0.3 * sin(uTime * 5.0));

    // Expanding placement pulse ripple
    float ripple = (1.0 - smoothstep(uPulse * 0.9, uPulse, r)) * smoothstep(max(0.0, uPulse - 0.15), uPulse, r) * (1.0 - uPulse);

    float alpha = ring1 * 0.75 + ring2 * 0.9 + arcTicks * 0.75 + dot + ripple * 1.2;
    if (alpha < 0.02) discard;

    vec3 col = mix(vec3(0.2, 0.85, 1.0), vec3(1.0, 0.45, 0.75), 0.5 + 0.5 * sin(uTime * 2.0 + angle));
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.95));
  }
`;

const AR_POINTS_VERTEX_SHADER = /* glsl */ `
  attribute float aConfidence;
  varying float vConf;
  void main() {
    vConf = aConfidence;
    vec4 mvp = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (7.0 + 5.0 * aConfidence) * (3.0 / max(0.2, -mvp.z));
    gl_Position = projectionMatrix * mvp;
  }
`;

const AR_POINTS_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying float vConf;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float glow = 1.0 - smoothstep(0.2, 1.0, r);
    float ring = smoothstep(0.65, 0.8, r) * (1.0 - smoothstep(0.85, 1.0, r));
    vec3 col = mix(vec3(0.22, 0.9, 0.95), vec3(1.0, 0.65, 0.85), vConf);
    gl_FragColor = vec4(col, (glow * 0.6 + ring * 0.8) * vConf * 0.85);
  }
`;

// ============================================================================
// ENVIRONMENT MANAGER FACTORY
// ============================================================================

export function createEnvironmentManager({ scene, renderer, container, keyLight, rimLight, hemiLight, furSystem, camera }) {
  let currentEnvId = 'studio';

  // Optical Tilt-Shift Lens Blur Overlay (active in Cozy Desk / Highrise mode)
  const tiltShiftOverlay = document.createElement('div');
  tiltShiftOverlay.id = 'tiltshift-overlay';
  tiltShiftOverlay.style.display = 'none';
  document.body.appendChild(tiltShiftOverlay);

  // --------------------------------------------------------------------------
  // A. STUDIO GROUP (Deep Black Cyclorama + Soft Contact Shadow + Bokeh Motes)
  // --------------------------------------------------------------------------
  const studioGroup = new THREE.Group();
  studioGroup.name = 'EnvStudio';
  scene.add(studioGroup);

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sCtx = shadowCanvas.getContext('2d');
  const grad = sCtx.createRadialGradient(128, 128, 10, 128, 128, 120);
  grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.78)');
  grad.addColorStop(0.45, 'rgba(2, 2, 6, 0.38)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 256, 256);

  const contactShadowTex = new THREE.CanvasTexture(shadowCanvas);
  const studioShadowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 2.7),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false
    })
  );
  studioShadowMesh.rotation.x = -Math.PI / 2;
  studioShadowMesh.position.y = -0.94;
  studioGroup.add(studioShadowMesh);

  // Soft circular radial-gradient sprite texture so floating dust motes are round bokeh orbs, not squares
  const moteCanvas = document.createElement('canvas');
  moteCanvas.width = 64;
  moteCanvas.height = 64;
  const moteCtx = moteCanvas.getContext('2d');
  const moteGrad = moteCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  moteGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  moteGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.85)');
  moteGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.25)');
  moteGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  moteCtx.fillStyle = moteGrad;
  moteCtx.fillRect(0, 0, 64, 64);
  const moteCircleTex = new THREE.CanvasTexture(moteCanvas);

  const moteCount = 90;
  const moteGeo = new THREE.BufferGeometry();
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePositions[i * 3] = (Math.random() - 0.5) * 5.8;
    motePositions[i * 3 + 1] = (Math.random() - 0.3) * 3.6;
    motePositions[i * 3 + 2] = (Math.random() - 0.5) * 4.2 - 0.8;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const studioMotes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({
      color: '#fbcfe8',
      map: moteCircleTex,
      size: 0.036,
      transparent: true,
      opacity: 0.42,
      alphaTest: 0.01,
      depthWrite: false
    })
  );
  studioGroup.add(studioMotes);

  // --------------------------------------------------------------------------
  // B. CLOUD SKY GROUP (Floating in 360° Blue Sky & Clouds — Zero Grass)
  // --------------------------------------------------------------------------
  const meadowGroup = new THREE.Group();
  meadowGroup.name = 'EnvMeadow';
  meadowGroup.visible = false;
  scene.add(meadowGroup);

  const meadowUniforms = {
    uTime: { value: 0.0 },
    uWindStrength: { value: 0.70 },
    uSunDir: { value: new THREE.Vector3(0.55, 0.52, 0.65).normalize() }
  };

  const meadowSkyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(48, 64, 48),
    new THREE.ShaderMaterial({
      vertexShader: MEADOW_SKY_VERTEX_SHADER,
      fragmentShader: MEADOW_SKY_FRAGMENT_SHADER,
      uniforms: meadowUniforms,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  meadowSkyMesh.renderOrder = -2;
  meadowGroup.add(meadowSkyMesh);

  // 3D Camera-Projected Optical Lens Flare (renders across lens when looking towards the 3D light)
  const meadowLensFlareMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: MEADOW_LENS_FLARE_VERTEX_SHADER,
      fragmentShader: MEADOW_LENS_FLARE_FRAGMENT_SHADER,
      uniforms: meadowUniforms,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.AdditiveBlending
    })
  );
  meadowLensFlareMesh.frustumCulled = false;
  meadowLensFlareMesh.renderOrder = 25;
  meadowGroup.add(meadowLensFlareMesh);

  let seedVal = 928371;
  const rand = () => {
    seedVal = (seedVal * 1664525 + 1013904223) >>> 0;
    return seedVal / 4294967296;
  };

  const cloudMoteCount = 110;
  const cloudMoteGeo = new THREE.BufferGeometry();
  const cloudMotePos = new Float32Array(cloudMoteCount * 3);
  for (let i = 0; i < cloudMoteCount; i++) {
    cloudMotePos[i * 3] = (rand() - 0.5) * 8.5;
    cloudMotePos[i * 3 + 1] = (rand() - 0.5) * 5.2;
    cloudMotePos[i * 3 + 2] = (rand() - 0.5) * 7.5;
  }
  cloudMoteGeo.setAttribute('position', new THREE.BufferAttribute(cloudMotePos, 3));
  const meadowPollen = new THREE.Points(
    cloudMoteGeo,
    new THREE.PointsMaterial({
      color: '#ffffff',
      map: moteCircleTex,
      size: 0.048,
      transparent: true,
      opacity: 0.62,
      alphaTest: 0.01,
      depthWrite: false
    })
  );
  meadowGroup.add(meadowPollen);

  // --------------------------------------------------------------------------
  // C. COZY DESK GROUP (Loops 13–17: 2"x2" Macro Scale Wooden Desk, Candles,
  //    Studio Monitor, Keycap Keyboard, Steaming Mugs, Lounge Chair &
  //    Tilt-Shift Twilight Mountain Valley Cityscape)
  // --------------------------------------------------------------------------
  const highriseGroup = new THREE.Group();
  highriseGroup.name = 'EnvHighrise';
  highriseGroup.visible = false;
  scene.add(highriseGroup);

  const highriseUniforms = {
    uTime: { value: 0.0 },
    uCreatureXZ: { value: new THREE.Vector2(0, 0) },
    uShadowScale: { value: 1.0 },
    uCreatureLift: { value: 0.0 },
    uCreatureSquash: { value: new THREE.Vector2(1.0, 1.0) },
    uCreatureRot: { value: new THREE.Vector2(0.0, 0.0) },
    uKeyLightDir: furSystem.sharedUniforms.uKeyLightDir,
    uKeyLightIntensity: furSystem.sharedUniforms.uKeyLightIntensity,
    uKeyLightColor: furSystem.sharedUniforms.uKeyLightColor,
    uFurLength: furSystem.sharedUniforms.uFurLength
  };

  // 1. Loop 13: Twilight Sunset & Tilt-Shift Mountain Valley Cityscape Dome
  const citySkyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(52, 64, 48),
    new THREE.ShaderMaterial({
      vertexShader: CITY_SKY_VERTEX_SHADER,
      fragmentShader: CITY_SKY_FRAGMENT_SHADER,
      uniforms: highriseUniforms,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  citySkyMesh.renderOrder = -2;
  highriseGroup.add(citySkyMesh);

  // 2. Loop 14: Macro-Scale Satin Walnut Desktop Slab & Drawer Pedestals
  const deskPlaneGeo = new THREE.PlaneGeometry(18.0, 6.2);
  deskPlaneGeo.rotateX(-Math.PI / 2);
  const deskTopMesh = new THREE.Mesh(
    deskPlaneGeo,
    new THREE.ShaderMaterial({
      vertexShader: HIGHRISE_FLOOR_VERTEX_SHADER,
      fragmentShader: HIGHRISE_FLOOR_FRAGMENT_SHADER,
      uniforms: highriseUniforms
    })
  );
  deskTopMesh.position.set(0, -0.942, -0.55);
  highriseGroup.add(deskTopMesh);

  const woodEdgeMat = new THREE.MeshStandardMaterial({
    color: '#3a2012',
    roughness: 0.48,
    metalness: 0.05
  });
  const deskApron = new THREE.Mesh(new THREE.BoxGeometry(18.0, 0.36, 6.2), woodEdgeMat);
  deskApron.position.set(0, -1.125, -0.55);
  highriseGroup.add(deskApron);

  // Left & Right wooden drawer pedestals with brass/dark pull knobs
  const drawerMat = new THREE.MeshStandardMaterial({ color: '#29160d', roughness: 0.55 });
  const knobMat = new THREE.MeshStandardMaterial({ color: '#0f1015', roughness: 0.3, metalness: 0.6 });

  const leftPedestal = new THREE.Mesh(new THREE.BoxGeometry(3.8, 5.5, 5.6), drawerMat);
  leftPedestal.position.set(-4.8, -4.0, -0.6);
  highriseGroup.add(leftPedestal);

  const rightPedestal = new THREE.Mesh(new THREE.BoxGeometry(3.8, 5.5, 5.6), drawerMat);
  rightPedestal.position.set(4.6, -4.0, -0.6);
  highriseGroup.add(rightPedestal);

  for (let d = 0; d < 3; d++) {
    const dy = -1.68 - d * 0.78;
    const rFace = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.68, 0.08), woodEdgeMat);
    rFace.position.set(4.6, dy, 2.22);
    highriseGroup.add(rFace);
    const rKnob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), knobMat);
    rKnob.position.set(4.6, dy, 2.30);
    highriseGroup.add(rKnob);
  }

  // 3. Panoramic Corner Window Architecture & Walnut Window Ledge
  const frameMat = new THREE.MeshStandardMaterial({
    color: '#141722',
    roughness: 0.34,
    metalness: 0.74
  });
  const sillMat = new THREE.MeshStandardMaterial({
    color: '#432616',
    roughness: 0.42,
    metalness: 0.08
  });

  // Window sill ledge running right behind the desk (lowered to y = -0.68 so the valley bokeh fills the window above it at macro camera height!)
  const windowSill = new THREE.Mesh(new THREE.BoxGeometry(20.0, 0.24, 1.15), sillMat);
  windowSill.position.set(0, -0.68, -3.45);
  highriseGroup.add(windowSill);

  // Loop 30: 3D Half-Round Bullnose Front Molding Nose & Stepped Sill Apron Trim
  const sillBullnose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 20.0, 20),
    sillMat
  );
  sillBullnose.rotation.z = Math.PI / 2;
  sillBullnose.position.set(0, -0.68, -2.875);
  highriseGroup.add(sillBullnose);

  const windowBackWall = new THREE.Mesh(new THREE.BoxGeometry(20.0, 1.1, 0.9), drawerMat);
  windowBackWall.position.set(0, -1.31, -3.58);
  highriseGroup.add(windowBackWall);

  // Vertical window mullions (left frame, center-left divider, right corner mullion) with Loop 30 stepped casement stop beads
  for (const mx of [-5.2, -0.35, 3.85]) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.24, 16.0, 0.28), frameMat);
    mullion.position.set(mx, 7.2, -3.92);
    highriseGroup.add(mullion);

    const mullionStep = new THREE.Mesh(new THREE.BoxGeometry(0.32, 16.0, 0.12), frameMat);
    mullionStep.position.set(mx, 7.2, -3.84);
    highriseGroup.add(mullionStep);
  }

  // Loop 30: Sculpted Brass Casement Window Latch Handle on the center-left mullion (mx = -0.35)
  const latchBrassMat = new THREE.MeshStandardMaterial({
    color: '#f5b942',
    roughness: 0.20,
    metalness: 0.88,
    emissive: '#5c3a08',
    emissiveIntensity: 0.35
  });
  const latchGroup = new THREE.Group();
  latchGroup.position.set(-0.35, 0.22, -3.76);
  const latchPlate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.03), latchBrassMat);
  latchGroup.add(latchPlate);
  const latchPivot = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.06, 14), latchBrassMat);
  latchPivot.rotation.x = Math.PI / 2;
  latchPivot.position.z = 0.03;
  latchGroup.add(latchPivot);
  const latchLeverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.0, 0.05),
    new THREE.Vector3(0.04, -0.08, 0.07),
    new THREE.Vector3(0.05, -0.22, 0.05)
  ]);
  const latchLever = new THREE.Mesh(
    new THREE.TubeGeometry(latchLeverCurve, 14, 0.016, 10, false),
    latchBrassMat
  );
  latchGroup.add(latchLever);
  highriseGroup.add(latchGroup);

  // Loop 30: Recessed Brushed-Brass Desktop Cable Grommet Ring where the monitor cable enters the walnut desk
  const grommetRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.095, 0.016, 12, 28),
    latchBrassMat
  );
  grommetRing.rotation.x = Math.PI / 2;
  grommetRing.position.set(0.82, -0.938, -1.78);
  highriseGroup.add(grommetRing);

  // Subtle reflective window glass pane with candle flame ghosting
  const windowGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(19.0, 15.0),
    new THREE.ShaderMaterial({
      vertexShader: HIGHRISE_GLASS_VERTEX_SHADER,
      fragmentShader: HIGHRISE_GLASS_FRAGMENT_SHADER,
      uniforms: highriseUniforms,
      transparent: true,
      depthWrite: false
    })
  );
  windowGlass.position.set(0, 7.0, -3.96);
  highriseGroup.add(windowGlass);

  // 4. Loop 15: High-Detail Workspace Props (Studio Monitor, Keycap Keyboard, Mouse, Mugs, Magazine)
  const silverMat = new THREE.MeshStandardMaterial({
    color: '#d8dee9',
    roughness: 0.25,
    metalness: 0.84
  });
  const darkBezelMat = new THREE.MeshStandardMaterial({
    color: '#0f141f',
    roughness: 0.20,
    metalness: 0.45
  });

  // Loop 26: Sculpted Unibody Studio Monitor, Stand Arm with Circular Cable Cutout, 3D Braided Cable & Top LED Monitor Light Bar
  const silverBrushedMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.22,
    metalness: 0.82,
    emissive: '#29211c',
    emissiveIntensity: 0.30
  });
  const darkAnodizedMat = new THREE.MeshStandardMaterial({
    color: '#141926',
    roughness: 0.22,
    metalness: 0.55,
    emissive: '#17131a',
    emissiveIntensity: 0.22
  });

  const monitorGroup = new THREE.Group();
  monitorGroup.position.set(0.96, -0.94, -1.56);
  monitorGroup.rotation.y = -0.36;
  monitorGroup.scale.setScalar(0.60);

  // 1. Multi-tier chamfered aluminum base plate with dark silicone pad inlay
  const standFootOuter = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.036, 0.96), silverBrushedMat);
  standFootOuter.position.y = 0.018;
  monitorGroup.add(standFootOuter);

  const standFootBevel = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.022, 0.86), silverMat);
  standFootBevel.position.y = 0.042;
  monitorGroup.add(standFootBevel);

  // 2. Sculpted Articulated Stand Arm with 3D Circular Cable-Management Ring Cutout
  const standPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.96, 0.075), silverBrushedMat);
  standPillarL.position.set(-0.17, 0.48, -0.22);
  standPillarL.rotation.x = 0.14;
  monitorGroup.add(standPillarL);

  const standPillarR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.96, 0.075), silverBrushedMat);
  standPillarR.position.set(0.17, 0.48, -0.22);
  standPillarR.rotation.x = 0.14;
  monitorGroup.add(standPillarR);

  const standTopBridge = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.08), silverBrushedMat);
  standTopBridge.position.set(0, 0.88, -0.16);
  standTopBridge.rotation.x = 0.14;
  monitorGroup.add(standTopBridge);

  // 3D circular brushed-aluminum cable-routing ring inside the stand neck
  const cableCutoutRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.115, 0.024, 14, 32),
    silverBrushedMat
  );
  cableCutoutRing.position.set(0, 0.34, -0.24);
  cableCutoutRing.rotation.x = 0.14;
  monitorGroup.add(cableCutoutRing);

  // 3D Curved Braided Display Power Cable threading through the stand's circular cutout hole
  const monitorCableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 1.15, -0.14),
    new THREE.Vector3(0.04, 0.65, -0.20),
    new THREE.Vector3(0.02, 0.34, -0.24),
    new THREE.Vector3(-0.08, 0.08, -0.45),
    new THREE.Vector3(-0.22, -0.05, -0.78)
  ]);
  const monitorCableMesh = new THREE.Mesh(
    new THREE.TubeGeometry(monitorCableCurve, 24, 0.022, 10, false),
    darkAnodizedMat
  );
  monitorGroup.add(monitorCableMesh);

  // 3. Sculpted Display Panel with 3D Recessed Bezel Frame, Chin Emblem & Cylindrical Hinge
  const panelGroup = new THREE.Group();
  panelGroup.position.set(0, 1.54, -0.06);
  panelGroup.rotation.x = -0.09;

  // Cylindrical tilt-hinge barrel connecting stand arm to display back
  const tiltHinge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.44, 20),
    silverBrushedMat
  );
  tiltHinge.rotation.z = Math.PI / 2;
  tiltHinge.position.set(0, -0.35, -0.08);
  panelGroup.add(tiltHinge);

  // Anodized aluminum rear housing & outer chamfered chassis
  const panelRearShell = new THREE.Mesh(new THREE.BoxGeometry(3.72, 2.32, 0.065), silverBrushedMat);
  panelRearShell.position.z = -0.02;
  panelGroup.add(panelRearShell);

  const panelBody = new THREE.Mesh(new THREE.BoxGeometry(3.65, 2.26, 0.08), darkAnodizedMat);
  panelGroup.add(panelBody);

  // 4-piece 3D raised outer bezel rails creating physical depth step around the glass screen
  const topBezelRail = new THREE.Mesh(new THREE.BoxGeometry(3.66, 0.065, 0.105), darkAnodizedMat);
  topBezelRail.position.set(0, 1.10, 0.012);
  panelGroup.add(topBezelRail);

  const leftBezelRail = new THREE.Mesh(new THREE.BoxGeometry(0.065, 2.02, 0.105), darkAnodizedMat);
  leftBezelRail.position.set(-1.795, 0.12, 0.012);
  panelGroup.add(leftBezelRail);

  const rightBezelRail = new THREE.Mesh(new THREE.BoxGeometry(0.065, 2.02, 0.105), darkAnodizedMat);
  rightBezelRail.position.set(1.795, 0.12, 0.012);
  panelGroup.add(rightBezelRail);

  // Brushed metallic lower chin bar + 3D circular metallic badge + warm power indicator LED
  const panelChin = new THREE.Mesh(new THREE.BoxGeometry(3.66, 0.28, 0.106), silverBrushedMat);
  panelChin.position.set(0, -0.99, 0.012);
  panelGroup.add(panelChin);

  const chinLogoBadge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 0.012, 20),
    darkAnodizedMat
  );
  chinLogoBadge.rotation.x = Math.PI / 2;
  chinLogoBadge.position.set(0, -0.99, 0.066);
  panelGroup.add(chinLogoBadge);

  const powerLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 10, 10),
    new THREE.MeshBasicMaterial({ color: '#fbbf24' })
  );
  powerLed.position.set(1.52, -0.99, 0.066);
  panelGroup.add(powerLed);

  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.52, 1.92),
    new THREE.ShaderMaterial({
      vertexShader: HIGHRISE_GLASS_VERTEX_SHADER,
      fragmentShader: MONITOR_SCREEN_FRAGMENT_SHADER,
      uniforms: highriseUniforms
    })
  );
  screenMesh.position.set(0, 0.12, 0.048);
  panelGroup.add(screenMesh);

  // 4. Loop 26: Sculpted Cylindrical LED Monitor Task Light Bar (ScreenBar) & Counterweight Clamp on Top Bezel
  const lightBarGroup = new THREE.Group();
  lightBarGroup.position.set(0, 1.15, 0.04);

  // Center mounting clip & cylindrical rear gravity counterweight
  const clampClip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.18), darkAnodizedMat);
  clampClip.position.set(0, -0.02, -0.02);
  lightBarGroup.add(clampClip);

  const counterweight = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.28, 18),
    silverBrushedMat
  );
  counterweight.rotation.z = Math.PI / 2;
  counterweight.position.set(0, -0.08, -0.14);
  lightBarGroup.add(counterweight);

  // Sleek cylindrical aluminum lamp bar tube + bronze endcaps + warm glowing LED diffuser strip
  const lightTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.036, 2.05, 20),
    darkAnodizedMat
  );
  lightTube.rotation.z = Math.PI / 2;
  lightTube.position.set(0, 0.04, 0.10);
  lightBarGroup.add(lightTube);

  for (const ex of [-1.03, 1.03]) {
    const endCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.04, 18),
      silverBrushedMat
    );
    endCap.rotation.z = Math.PI / 2;
    endCap.position.set(ex, 0.04, 0.10);
    lightBarGroup.add(endCap);
  }

  const ledStrip = new THREE.Mesh(
    new THREE.BoxGeometry(1.96, 0.018, 0.028),
    new THREE.MeshBasicMaterial({ color: '#fde68a' })
  );
  ledStrip.position.set(0, 0.012, 0.105);
  lightBarGroup.add(ledStrip);

  panelGroup.add(lightBarGroup);
  monitorGroup.add(panelGroup);
  highriseGroup.add(monitorGroup);

  // Loop 25: Stitched Charcoal Wool-Felt Desk Mat, Wedge Aluminum Keyboard with 78 3D Sculpted Keycaps & Multi-Part Ergonomic Mouse
  const feltMat = new THREE.MeshStandardMaterial({
    color: '#23252e',
    roughness: 0.88,
    metalness: 0.04
  });
  const deskPadGroup = new THREE.Group();
  deskPadGroup.position.set(0.46, -0.938, -0.44);
  deskPadGroup.rotation.y = -0.34;
  const deskPadBody = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.012, 0.78), feltMat);
  deskPadBody.receiveShadow = true;
  deskPadGroup.add(deskPadBody);
  // Stitched bronze-amber border trim around the felt desk mat
  const stitchMat = new THREE.MeshStandardMaterial({
    color: '#9a6b3b',
    roughness: 0.55,
    metalness: 0.35
  });
  const padTrimF = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.014, 0.012), stitchMat);
  padTrimF.position.set(0, 0.001, 0.38);
  padTrimF.receiveShadow = true;
  deskPadGroup.add(padTrimF);
  const padTrimB = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.014, 0.012), stitchMat);
  padTrimB.position.set(0, 0.001, -0.38);
  padTrimB.receiveShadow = true;
  deskPadGroup.add(padTrimB);
  highriseGroup.add(deskPadGroup);

  // Wedge-Profile Anodized Aluminum Keyboard with 3D Instanced Sculpted Mechanical Keycaps
  const kbGroup = new THREE.Group();
  kbGroup.position.set(0.56, -0.916, -0.50);
  kbGroup.rotation.y = -0.34;
  kbGroup.rotation.x = 0.075; // Ergonomic typing wedge tilt toward camera
  kbGroup.scale.setScalar(0.62);

  const aluAnodizedMat = new THREE.MeshStandardMaterial({
    color: '#b8c2d1',
    roughness: 0.24,
    metalness: 0.78,
    emissive: '#2e231c',
    emissiveIntensity: 0.28
  });
  const kbChassis = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.058, 0.76), aluAnodizedMat);
  kbGroup.add(kbChassis);

  // Cylindrical rear aluminum riser bar underneath back edge of keyboard
  const kbRiserBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.034, 1.88, 16),
    aluAnodizedMat
  );
  kbRiserBar.rotation.z = Math.PI / 2;
  kbRiserBar.position.set(0, -0.018, -0.32);
  kbGroup.add(kbRiserBar);

  // Warm backlit switch plate plane (also retains KEYBOARD_TOP_FRAGMENT_SHADER beneath the 3D keycaps)
  const kbTopPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.88, 0.70),
    new THREE.ShaderMaterial({
      vertexShader: HIGHRISE_GLASS_VERTEX_SHADER,
      fragmentShader: KEYBOARD_TOP_FRAGMENT_SHADER
    })
  );
  kbTopPlane.rotation.x = -Math.PI / 2;
  kbTopPlane.position.y = 0.030;
  kbGroup.add(kbTopPlane);

  // Sculpted 3D Mechanical Keycap Geometry (tapered upper walls + concave spherical finger dish on top)
  const keycapGeo = new THREE.BoxGeometry(0.098, 0.042, 0.088, 4, 2, 4);
  keycapGeo.translate(0, 0.021, 0);
  const kcPos = keycapGeo.attributes.position;
  for (let i = 0; i < kcPos.count; i++) {
    let kx = kcPos.getX(i);
    let ky = kcPos.getY(i);
    let kz = kcPos.getZ(i);
    if (ky > 0.020) {
      // Taper top of keycap inward like real Cherry/OEM profile mechanical keycaps
      kx *= 0.76;
      kz *= 0.76;
      // Cylindrical/spherical finger scoop dish on top face
      const dish = Math.max(0.0, 1.0 - (kx * kx) / (0.038 * 0.038));
      ky -= 0.0085 * dish;
    }
    kcPos.setXYZ(i, kx, ky, kz);
  }
  keycapGeo.computeVertexNormals();

  const keycapDarkMat = new THREE.MeshStandardMaterial({
    color: '#1e2230',
    roughness: 0.30,
    metalness: 0.25,
    emissive: '#3a2418',
    emissiveIntensity: 0.26
  });
  const keycapAccentMat = new THREE.MeshStandardMaterial({
    color: '#d97706',
    roughness: 0.28,
    metalness: 0.22,
    emissive: '#78350f',
    emissiveIntensity: 0.35
  });

  // Populate 6 rows of 3D instanced mechanical keycaps with realistic QWERTY staggering & wide modifier/spacebar keys
  const keySpecs = [];
  for (let r = 0; r < 6; r++) {
    const rz = -0.275 + r * 0.11;
    if (r === 5) {
      // Bottom row: Ctrl, Opt, Cmd, Spacebar (wide), Cmd, Fn, Left, Down, Right
      const bottomLayout = [
        { x: -0.82, w: 1.15 },
        { x: -0.67, w: 1.15 },
        { x: -0.51, w: 1.25 },
        { x: -0.05, w: 5.20 },
        { x: 0.42,  w: 1.25 },
        { x: 0.58,  w: 1.10 },
        { x: 0.72,  w: 0.95 },
        { x: 0.84,  w: 0.95 }
      ];
      for (const k of bottomLayout) {
        keySpecs.push({ x: k.x, z: rz, w: k.w });
      }
    } else {
      const stagger = (r % 2) * 0.022;
      for (let c = 0; c < 14; c++) {
        const kx = -0.83 + c * 0.125 + stagger;
        if (kx < 0.86) {
          keySpecs.push({ x: kx, z: rz, w: c === 13 ? 1.35 : 1.0 });
        }
      }
    }
  }

  const keycapInstanced = new THREE.InstancedMesh(keycapGeo, keycapDarkMat, keySpecs.length);
  const kcDummy = new THREE.Object3D();
  for (let i = 0; i < keySpecs.length; i++) {
    const ks = keySpecs[i];
    kcDummy.position.set(ks.x, 0.029, ks.z);
    kcDummy.scale.set(ks.w, 1.0, 1.0);
    kcDummy.updateMatrix();
    keycapInstanced.setMatrixAt(i, kcDummy.matrix);
  }
  keycapInstanced.instanceMatrix.needsUpdate = true;
  kbGroup.add(keycapInstanced);

  // Warm amber ESC & Enter accent keycaps
  const escKey = new THREE.Mesh(keycapGeo, keycapAccentMat);
  escKey.position.set(-0.83, 0.031, -0.275);
  kbGroup.add(escKey);

  highriseGroup.add(kbGroup);

  // Multi-Part Sculpted Ergonomic Wireless Mouse (positioned in clear view on the right side of the desk mat)
  const mouseGroup = new THREE.Group();
  mouseGroup.position.set(0.64, -0.928, -0.14);
  mouseGroup.rotation.y = -0.42;

  const mouseBodyGeo = new THREE.SphereGeometry(0.14, 28, 20);
  const mPos = mouseBodyGeo.attributes.position;
  for (let i = 0; i < mPos.count; i++) {
    let mx = mPos.getX(i);
    let my = mPos.getY(i);
    let mz = mPos.getZ(i);
    // Flatten underside, arch rear palm hump, slope front click plates, and scoop left thumb rest
    if (my < 0) my *= 0.18;
    else my *= 0.42 * (1.0 - 0.25 * (mz / 0.14));
    mx *= 0.72 - 0.08 * Math.sin((mz / 0.14) * 3.14159);
    mz *= 1.18;
    mPos.setXYZ(i, mx, my, mz);
  }
  mouseBodyGeo.computeVertexNormals();
  const mouseShell = new THREE.Mesh(mouseBodyGeo, aluAnodizedMat);
  mouseGroup.add(mouseShell);

  const spoonBrassMat = new THREE.MeshStandardMaterial({
    color: '#f5b942',
    roughness: 0.16,
    metalness: 0.88,
    emissive: '#6b420a',
    emissiveIntensity: 0.38
  });

  // Recessed center button split seam & 3D grooved metallic scroll wheel
  const mouseSeam = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.042, 0.12), keycapDarkMat);
  mouseSeam.position.set(0, 0.036, -0.065);
  mouseGroup.add(mouseSeam);

  const scrollWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.016, 18),
    spoonBrassMat
  );
  scrollWheel.rotation.z = Math.PI / 2;
  scrollWheel.position.set(0, 0.048, -0.068);
  mouseGroup.add(scrollWheel);

  highriseGroup.add(mouseGroup);

  // Loop 23: Lathe-Sculpted Stoneware Coffee Mug, Concave Saucer, Brass Espresso Spoon & Coaster
  const ceramicDarkMat = new THREE.MeshStandardMaterial({
    color: '#26201d',
    roughness: 0.22,
    metalness: 0.18
  });
  const stonewareShaderMat = new THREE.ShaderMaterial({
    vertexShader: STONEWARE_CERAMIC_VERTEX_SHADER,
    fragmentShader: STONEWARE_CERAMIC_FRAGMENT_SHADER
  });
  const ceramicRimGlazeMat = new THREE.MeshStandardMaterial({
    color: '#8c5332',
    roughness: 0.16,
    metalness: 0.28,
    emissive: '#3b1d0c',
    emissiveIntensity: 0.35
  });
  const coffeeLiquidMat = new THREE.MeshStandardMaterial({
    color: '#29150a',
    roughness: 0.06,
    metalness: 0.28
  });
  const cremaRingMat = new THREE.MeshStandardMaterial({
    color: '#9c5a25',
    roughness: 0.32,
    metalness: 0.08
  });
  const steamMat = new THREE.ShaderMaterial({
    vertexShader: HIGHRISE_GLASS_VERTEX_SHADER,
    fragmentShader: COFFEE_STEAM_FRAGMENT_SHADER,
    uniforms: highriseUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  function createCoffeeMugOnSaucer(x, z, scale = 1.0, rotY = 0.0) {
    const g = new THREE.Group();
    g.position.set(x, -0.94, z);
    g.rotation.y = rotY;
    g.scale.setScalar(scale);

    // 1. Cork-inlaid wooden coaster beneath the saucer
    const coasterBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.54, 0.55, 0.022, 36),
      sillMat
    );
    coasterBase.position.y = 0.011;
    g.add(coasterBase);

    // Helper to seamlessly weld/average normals across LatheGeometry column 0 and column N
    function smoothLatheSeamNormals(geo, segments, pointsCount) {
      const norm = geo.attributes.normal;
      for (let i = 0; i < pointsCount; i++) {
        const idx0 = i;
        const idxLast = segments * pointsCount + i;
        const nx = 0.5 * (norm.getX(idx0) + norm.getX(idxLast));
        const ny = 0.5 * (norm.getY(idx0) + norm.getY(idxLast));
        const nz = 0.5 * (norm.getZ(idx0) + norm.getZ(idxLast));
        const len = Math.hypot(nx, ny, nz) || 1.0;
        norm.setXYZ(idx0, nx / len, ny / len, nz / len);
        norm.setXYZ(idxLast, nx / len, ny / len, nz / len);
      }
      norm.needsUpdate = true;
    }

    // 2. Lathe-sculpted concave stoneware saucer with foot ring, sunken cup well & rolled lip
    const saucerPts = [
      new THREE.Vector2(0.00, 0.024),
      new THREE.Vector2(0.24, 0.024),
      new THREE.Vector2(0.27, 0.018),
      new THREE.Vector2(0.30, 0.032),
      new THREE.Vector2(0.40, 0.056),
      new THREE.Vector2(0.49, 0.092),
      new THREE.Vector2(0.515, 0.105),
      new THREE.Vector2(0.502, 0.116),
      new THREE.Vector2(0.475, 0.102),
      new THREE.Vector2(0.38, 0.066),
      new THREE.Vector2(0.26, 0.038),
      new THREE.Vector2(0.00, 0.036)
    ];
    const saucerGeo = new THREE.LatheGeometry(saucerPts, 48);
    saucerGeo.computeVertexNormals();
    smoothLatheSeamNormals(saucerGeo, 48, saucerPts.length);
    const saucer = new THREE.Mesh(saucerGeo, stonewareShaderMat);
    g.add(saucer);

    // Glazed terracotta rim highlight on the saucer lip
    const saucerRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.504, 0.011, 12, 48),
      ceramicRimGlazeMat
    );
    saucerRim.rotation.x = Math.PI / 2;
    saucerRim.position.y = 0.109;
    g.add(saucerRim);

    // 3. Lathe-sculpted stoneware mug with potter's wheel throwing ribs, organic belly & hollow rolled lip
    const mugPts = [];
    mugPts.push(new THREE.Vector2(0.00, 0.038));
    mugPts.push(new THREE.Vector2(0.235, 0.038));
    mugPts.push(new THREE.Vector2(0.252, 0.058));
    const wallSteps = 16;
    for (let i = 0; i <= wallSteps; i++) {
      const t = i / wallSteps;
      const py = 0.065 + t * 0.615;
      // Curved artisanal belly with subtle potter's wheel throwing grooves
      const belly = Math.sin(t * Math.PI * 0.88) * 0.048 + t * 0.022;
      const wheelRib = Math.sin(t * Math.PI * 14.0) * 0.0055;
      const lipFlare = Math.pow(Math.max(0, t - 0.78) / 0.22, 2.0) * 0.018;
      const pr = 0.268 + belly + wheelRib + lipFlare;
      mugPts.push(new THREE.Vector2(pr, py));
    }
    // Rolled top lip & hollow inner cup wall down to liquid level
    mugPts.push(new THREE.Vector2(0.326, 0.696));
    mugPts.push(new THREE.Vector2(0.308, 0.702));
    mugPts.push(new THREE.Vector2(0.292, 0.688));
    mugPts.push(new THREE.Vector2(0.282, 0.590));

    const cupGeo = new THREE.LatheGeometry(mugPts, 48);
    cupGeo.computeVertexNormals();
    smoothLatheSeamNormals(cupGeo, 48, mugPts.length);
    const cup = new THREE.Mesh(cupGeo, stonewareShaderMat);
    cup.rotation.y = Math.PI;
    g.add(cup);

    // Warm bronze-terracotta glazed lip ring around top of mug
    const mugLipRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.315, 0.013, 14, 48),
      ceramicRimGlazeMat
    );
    mugLipRing.rotation.x = Math.PI / 2;
    mugLipRing.position.y = 0.695;
    g.add(mugLipRing);

    // 4. Glossy Espresso Liquid + Crema Meniscus Ring + Heart Latte Art Foam
    const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.286, 32), coffeeLiquidMat);
    liquid.rotation.x = -Math.PI / 2;
    liquid.position.y = 0.635;
    g.add(liquid);

    const cremaMeniscus = new THREE.Mesh(
      new THREE.TorusGeometry(0.276, 0.014, 10, 32),
      cremaRingMat
    );
    cremaMeniscus.rotation.x = Math.PI / 2;
    cremaMeniscus.position.y = 0.638;
    g.add(cremaMeniscus);

    // 5. Sculpted Ergonomic Ear-Loop Handle via CatmullRomCurve3 + TubeGeometry
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.29, 0.56, 0.0),
      new THREE.Vector3(-0.42, 0.59, 0.0),
      new THREE.Vector3(-0.49, 0.48, 0.0),
      new THREE.Vector3(-0.47, 0.31, 0.0),
      new THREE.Vector3(-0.38, 0.18, 0.0),
      new THREE.Vector3(-0.27, 0.15, 0.0)
    ]);
    const handleGeo = new THREE.TubeGeometry(handleCurve, 28, 0.036, 14, false);
    const handle = new THREE.Mesh(handleGeo, stonewareShaderMat);
    g.add(handle);

    // 6. Sculpted 3D Brass Espresso Spoon resting on the saucer rim
    const spoonGroup = new THREE.Group();
    spoonGroup.position.set(0.26, 0.072, 0.18);
    spoonGroup.rotation.y = -0.48;

    const spoonBowlGeo = new THREE.SphereGeometry(0.075, 16, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45);
    spoonBowlGeo.scale(0.78, 0.42, 1.28);
    const spoonBowl = new THREE.Mesh(spoonBowlGeo, spoonBrassMat);
    spoonBowl.position.set(0, 0.012, -0.14);
    spoonGroup.add(spoonBowl);

    const spoonStemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.0, -0.005, -0.06),
      new THREE.Vector3(0.0, 0.018, 0.08),
      new THREE.Vector3(0.0, 0.044, 0.22),
      new THREE.Vector3(0.0, 0.052, 0.34)
    ]);
    const spoonStem = new THREE.Mesh(
      new THREE.TubeGeometry(spoonStemCurve, 18, 0.012, 10, false),
      spoonBrassMat
    );
    spoonGroup.add(spoonStem);
    g.add(spoonGroup);

    // Loop 18: Crossed translucent rising espresso steam plumes
    const steamPlaneGeo = new THREE.PlaneGeometry(0.54, 0.95);
    const steam1 = new THREE.Mesh(steamPlaneGeo, steamMat);
    steam1.position.y = 1.15;
    g.add(steam1);

    const steam2 = new THREE.Mesh(steamPlaneGeo, steamMat);
    steam2.position.y = 1.15;
    steam2.rotation.y = Math.PI / 2;
    g.add(steam2);

    highriseGroup.add(g);
  }

  // Single dark stoneware coffee mug on saucer with rising steam plumes
  createCoffeeMugOnSaucer(-1.14, -0.44, 0.70, 0.35);

  // Small folded cream linen napkin in right foreground
  const linenMat = new THREE.MeshStandardMaterial({ color: '#d6c7bc', roughness: 0.85 });
  const napkin = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.03, 0.34), linenMat);
  napkin.position.set(1.42, -0.925, 0.32);
  napkin.rotation.y = -0.45;
  highriseGroup.add(napkin);

  // Loop 27: 3D Gull-Wing Arching Open Sketchbook Pages, Silk Bookmark Ribbon & 5-Part Sculpted Fountain Pen
  const openBookGroup = new THREE.Group();
  openBookGroup.position.set(-0.52, -0.928, -1.24);
  openBookGroup.rotation.y = 0.24;
  openBookGroup.scale.setScalar(0.60);

  // Overhanging clothbound hardcover boards + spine bridge
  const bookCoverMat = new THREE.MeshStandardMaterial({
    color: '#2b1d16',
    roughness: 0.58,
    emissive: '#1a0f0a',
    emissiveIntensity: 0.25
  });
  const bookCoverL = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.026, 1.20), bookCoverMat);
  bookCoverL.position.set(-0.43, 0.013, 0);
  openBookGroup.add(bookCoverL);

  const bookCoverR = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.026, 1.20), bookCoverMat);
  bookCoverR.position.set(0.43, 0.013, 0);
  openBookGroup.add(bookCoverR);

  // Stepped cream paper page-block thickness underneath the arching top pages
  const pageEdgeMat = new THREE.MeshStandardMaterial({
    color: '#dfd1c0',
    roughness: 0.65,
    emissive: '#3a2b1d',
    emissiveIntensity: 0.24
  });
  const pageBlockL = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.045, 1.12), pageEdgeMat);
  pageBlockL.position.set(-0.40, 0.038, 0);
  pageBlockL.rotation.z = -0.04;
  openBookGroup.add(pageBlockL);

  const pageBlockR = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.045, 1.12), pageEdgeMat);
  pageBlockR.position.set(0.40, 0.038, 0);
  pageBlockR.rotation.z = 0.04;
  openBookGroup.add(pageBlockR);

  // 3D Vertex-Sculpted Gull-Wing Arching Open Pages (parabolic 3D arch on left & right pages + deep center spine valley)
  const bookPagesGeo = new THREE.PlaneGeometry(1.60, 1.12, 36, 12);
  bookPagesGeo.rotateX(-Math.PI / 2);
  const bpPos = bookPagesGeo.attributes.position;
  for (let i = 0; i < bpPos.count; i++) {
    const px = bpPos.getX(i);
    const pz = bpPos.getZ(i);
    const normX = Math.abs(px) / 0.80;
    // Gull-wing page arch peaking midway across each page, dipping into the spine crease at x=0
    const gullArch = Math.sin(Math.pow(normX, 0.78) * Math.PI * 0.92) * 0.068;
    const cornerCurl = Math.pow(normX, 3.0) * Math.pow(Math.abs(pz) / 0.56, 2.0) * 0.018;
    bpPos.setY(i, 0.032 + gullArch + cornerCurl);
  }
  bookPagesGeo.computeVertexNormals();

  const bookPages = new THREE.Mesh(
    bookPagesGeo,
    new THREE.ShaderMaterial({
      vertexShader: HIGHRISE_GLASS_VERTEX_SHADER,
      fragmentShader: BOOK_PAGE_FRAGMENT_SHADER
    })
  );
  openBookGroup.add(bookPages);

  // 3D Curved Crimson Silk Bookmark Ribbon draping out of the center spine over the front of the sketchbook
  const ribbonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.036, -0.15),
    new THREE.Vector3(0.01, 0.040, 0.35),
    new THREE.Vector3(0.06, 0.025, 0.58),
    new THREE.Vector3(0.14, 0.008, 0.74)
  ]);
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: '#991b1b',
    roughness: 0.42,
    emissive: '#450a0a',
    emissiveIntensity: 0.30
  });
  const ribbonMesh = new THREE.Mesh(
    new THREE.TubeGeometry(ribbonCurve, 20, 0.014, 8, false),
    ribbonMat
  );
  ribbonMesh.scale.set(1.6, 0.35, 1.0);
  openBookGroup.add(ribbonMesh);
  highriseGroup.add(openBookGroup);

  // Loop 27: 5-Part Sculpted Walnut & Brass Fountain Pen (Barrel, Cap Ring, Grip Section, 18k Gold Nib & Pocket Clip)
  const brassMat = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    roughness: 0.20,
    metalness: 0.85,
    emissive: '#5c3406',
    emissiveIntensity: 0.35
  });
  const penGroup = new THREE.Group();
  penGroup.position.set(-0.48, -0.922, -0.80);
  penGroup.rotation.y = 0.08;

  // 1. Tapered walnut barrel
  const penBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.021, 0.30, 16),
    sillMat
  );
  penBarrel.rotation.z = Math.PI / 2;
  penBarrel.position.x = -0.06;
  penGroup.add(penBarrel);

  // 2. Brushed brass center cap ring band
  const penRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.0215, 0.004, 10, 20),
    spoonBrassMat
  );
  penRing.rotation.y = Math.PI / 2;
  penRing.position.x = 0.09;
  penGroup.add(penRing);

  // 3. Contoured dark grip section
  const penGrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.019, 0.075, 16),
    darkAnodizedMat
  );
  penGrip.rotation.z = Math.PI / 2;
  penGrip.position.x = 0.13;
  penGroup.add(penGrip);

  // 4. Sculpted conical 18k gold fountain pen nib
  const penNibGeo = new THREE.ConeGeometry(0.013, 0.058, 12);
  penNibGeo.scale(1.0, 1.0, 0.38);
  const penNib = new THREE.Mesh(penNibGeo, spoonBrassMat);
  penNib.rotation.z = -Math.PI / 2;
  penNib.position.x = 0.195;
  penGroup.add(penNib);

  // 5. Brass pocket clip along rear barrel
  const penClip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.005, 0.008), spoonBrassMat);
  penClip.position.set(-0.12, 0.021, 0);
  penGroup.add(penClip);

  highriseGroup.add(penGroup);

  // Loop 28: Sculpted 3-Volume Hardcover Art Book Stack (Overhanging Boards, Rounded Spines, Gold Hub Bands, Recessed Pages & Brass Polyhedron Paperweight)
  const bookStackGroup = new THREE.Group();
  bookStackGroup.position.set(0.46, -0.94, -1.36);
  bookStackGroup.rotation.y = -0.28;
  bookStackGroup.scale.setScalar(0.58);
  const bookStackColors = ['#4a2518', '#1e3a4c', '#5c341e'];
  let stackHeightAccum = 0.0;
  for (let b = 0; b < 3; b++) {
    const bw = 1.24 - b * 0.09;
    const bd = 0.90 - b * 0.06;
    const bh = 0.145;
    const bMat = new THREE.MeshStandardMaterial({
      color: bookStackColors[b],
      roughness: 0.48,
      emissive: bookStackColors[b],
      emissiveIntensity: 0.22
    });

    const singleBook = new THREE.Group();
    singleBook.position.set((b % 2 === 0 ? 1 : -1) * 0.035, stackHeightAccum + bh * 0.5, 0);
    singleBook.rotation.y = (b - 1) * 0.08;

    // 1. Overhanging top & bottom hardcover boards
    const boardBottom = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.022, bd), bMat);
    boardBottom.position.y = -bh * 0.5 + 0.011;
    singleBook.add(boardBottom);

    const boardTop = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.022, bd), bMat);
    boardTop.position.y = bh * 0.5 - 0.011;
    singleBook.add(boardTop);

    // 2. Recessed cream paper page block between the covers
    const pageBlock = new THREE.Mesh(
      new THREE.BoxGeometry(bw - 0.045, bh - 0.044, bd - 0.038),
      pageEdgeMat
    );
    pageBlock.position.set(0.012, 0, 0.008);
    singleBook.add(pageBlock);

    // 3. Sculpted half-cylinder rounded book spine facing forward/left
    const spineCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(bh * 0.5, bh * 0.5, bd, 16),
      bMat
    );
    spineCyl.rotation.x = Math.PI / 2;
    spineCyl.scale.set(0.55, 1.0, 1.0);
    spineCyl.position.set(-bw * 0.5 + 0.01, 0, 0);
    singleBook.add(spineCyl);

    // 4. Four raised 3D gold-foil spine hub bands across the rounded spine
    for (const hz of [-0.30, -0.10, 0.10, 0.30]) {
      const hubBand = new THREE.Mesh(
        new THREE.CylinderGeometry(bh * 0.53, bh * 0.53, 0.018, 14),
        spoonBrassMat
      );
      hubBand.rotation.x = Math.PI / 2;
      hubBand.scale.set(0.58, 1.0, 1.0);
      hubBand.position.set(-bw * 0.5 + 0.01, 0, hz * bd);
      singleBook.add(hubBand);
    }

    bookStackGroup.add(singleBook);
    stackHeightAccum += bh;
  }

  // Sculpted Faceted Brass Dodecahedron Paperweight resting atop the 3-book stack
  const paperweightMesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.115, 0),
    spoonBrassMat
  );
  paperweightMesh.position.set(-0.04, stackHeightAccum + 0.095, 0.04);
  paperweightMesh.rotation.set(0.35, 0.48, 0.18);
  bookStackGroup.add(paperweightMesh);

  highriseGroup.add(bookStackGroup);

  // Loop 27: Hollow Multi-Compartment Dovetail Wooden Desk Caddy with Brass Corner Brackets & 3D Artist Stationery
  const caddyMat = new THREE.MeshStandardMaterial({
    color: '#7c4828',
    roughness: 0.44,
    metalness: 0.08,
    emissive: '#2e1608',
    emissiveIntensity: 0.32
  });
  const caddyGroup = new THREE.Group();
  caddyGroup.position.set(-0.52, -0.94, -1.92);
  caddyGroup.rotation.y = 0.22;

  // Hollow box walls: bottom floor, lower front wall, taller back wall, left/right side walls, and interior divider
  const cFloor = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.03, 0.54), caddyMat);
  cFloor.position.y = 0.015;
  caddyGroup.add(cFloor);

  const cFront = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.28, 0.04), caddyMat);
  cFront.position.set(0, 0.14, 0.25);
  caddyGroup.add(cFront);

  const cBack = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.38, 0.04), caddyMat);
  cBack.position.set(0, 0.19, -0.25);
  caddyGroup.add(cBack);

  for (const sx of [-0.46, 0.46]) {
    const cSide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.34, 0.54), caddyMat);
    cSide.position.set(sx, 0.17, 0);
    caddyGroup.add(cSide);

    // Sculpted brass corner bracket trim on the front corners of the wooden caddy
    const cornerBracket = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.065, 0.052), spoonBrassMat);
    cornerBracket.position.set(sx, 0.25, 0.245);
    caddyGroup.add(cornerBracket);
  }

  const cDivider = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.30, 0.48), caddyMat);
  cDivider.position.set(-0.08, 0.15, 0);
  caddyGroup.add(cDivider);

  // 3D Stationery inside the hollow caddy: brass ruler, wooden artist paintbrush, and 2 sharpened pencils
  const rulerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.56, 0.012), spoonBrassMat);
  rulerMesh.position.set(-0.28, 0.28, -0.05);
  rulerMesh.rotation.set(0.12, 0.08, 0.16);
  caddyGroup.add(rulerMesh);

  for (const pSpec of [
    { x: 0.12, z: 0.04, rz: -0.14, rx: 0.10, col: '#d97706' },
    { x: 0.24, z: -0.06, rz: -0.22, rx: -0.08, col: '#059669' }
  ]) {
    const pGroup = new THREE.Group();
    pGroup.position.set(pSpec.x, 0.26, pSpec.z);
    pGroup.rotation.set(pSpec.rx, 0, pSpec.rz);
    const pShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.44, 6),
      new THREE.MeshStandardMaterial({ color: pSpec.col, roughness: 0.4 })
    );
    pGroup.add(pShaft);
    const pCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.018, 0.055, 12),
      new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.5 })
    );
    pCone.position.y = 0.245;
    pGroup.add(pCone);
    caddyGroup.add(pGroup);
  }

  highriseGroup.add(caddyGroup);

  // Loop 28: 4-Bar Mitered 3D Gallery Picture Frames with Stepped Brass Inner Fillet & Deep-Set Matboard
  const printFrameWoodMat = new THREE.MeshStandardMaterial({
    color: '#855231',
    roughness: 0.40,
    metalness: 0.12,
    emissive: '#381e0d',
    emissiveIntensity: 0.32
  });
  const printMatboardMat = new THREE.MeshStandardMaterial({
    color: '#f5ebd6',
    roughness: 0.65,
    emissive: '#453522',
    emissiveIntensity: 0.25
  });
  const framedPrintMat = new THREE.ShaderMaterial({
    vertexShader: HIGHRISE_GLASS_VERTEX_SHADER,
    fragmentShader: FRAMED_PRINT_FRAGMENT_SHADER
  });
  for (const fp of [
    { x: -0.68, y: -0.26, z: -2.28, w: 0.68, h: 0.86, ry: 0.18 },
    { x: -0.18, y: -0.32, z: -2.18, w: 0.54, h: 0.66, ry: -0.12 }
  ]) {
    const frameGroup = new THREE.Group();
    frameGroup.position.set(fp.x, fp.y, fp.z);
    frameGroup.rotation.set(-0.20, fp.ry, 0);

    // Backing board + recessed cream matboard
    const backBoard = new THREE.Mesh(new THREE.BoxGeometry(fp.w, fp.h, 0.024), printMatboardMat);
    frameGroup.add(backBoard);

    // Deep-set painted mountain sunset artwork
    const fArt = new THREE.Mesh(new THREE.PlaneGeometry(fp.w * 0.82, fp.h * 0.82), framedPrintMat);
    fArt.position.z = 0.014;
    frameGroup.add(fArt);

    // 4-Bar 3D Outer Wooden Molding Rails (top, bottom, left, right) projecting forward in Z
    const railW = 0.052;
    const railD = 0.064;
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(fp.w + 0.02, railW, railD), printFrameWoodMat);
    topRail.position.set(0, fp.h * 0.5 - railW * 0.5, 0.018);
    frameGroup.add(topRail);

    const botRail = new THREE.Mesh(new THREE.BoxGeometry(fp.w + 0.02, railW, railD), printFrameWoodMat);
    botRail.position.set(0, -fp.h * 0.5 + railW * 0.5, 0.018);
    frameGroup.add(botRail);

    const leftRail = new THREE.Mesh(new THREE.BoxGeometry(railW, fp.h, railD), printFrameWoodMat);
    leftRail.position.set(-fp.w * 0.5 + railW * 0.5, 0, 0.018);
    frameGroup.add(leftRail);

    const rightRail = new THREE.Mesh(new THREE.BoxGeometry(railW, fp.h, railD), printFrameWoodMat);
    rightRail.position.set(fp.w * 0.5 - railW * 0.5, 0, 0.018);
    frameGroup.add(rightRail);

    // Stepped inner brushed-brass fillet molding around the artwork aperture
    const filletW = 0.016;
    const filletTop = new THREE.Mesh(new THREE.BoxGeometry(fp.w * 0.84, filletW, 0.036), spoonBrassMat);
    filletTop.position.set(0, fp.h * 0.41, 0.012);
    frameGroup.add(filletTop);

    const filletBot = new THREE.Mesh(new THREE.BoxGeometry(fp.w * 0.84, filletW, 0.036), spoonBrassMat);
    filletBot.position.set(0, -fp.h * 0.41, 0.012);
    frameGroup.add(filletBot);

    highriseGroup.add(frameGroup);
  }

  // Loop 29: Lathe-Sculpted Ceramic Amphora Vases & Stoppered Amber Apothecary Decanters along the Windowsill
  const creamCeramicMat = new THREE.MeshStandardMaterial({
    color: '#e7d8c9',
    roughness: 0.34,
    metalness: 0.08,
    emissive: '#3d2e22',
    emissiveIntensity: 0.26
  });
  const amberBottleMat = new THREE.MeshStandardMaterial({
    color: '#b45309',
    roughness: 0.14,
    metalness: 0.18,
    emissive: '#451a03',
    emissiveIntensity: 0.32,
    transparent: true,
    opacity: 0.90
  });

  // 12-point Lathe profile for curved Amphora / Apothecary Decanter vessels
  const decanterPts = [
    new THREE.Vector2(0.00, 0.00),
    new THREE.Vector2(0.62, 0.00),
    new THREE.Vector2(0.68, 0.06),
    new THREE.Vector2(0.95, 0.28),
    new THREE.Vector2(1.02, 0.52),
    new THREE.Vector2(0.86, 0.72),
    new THREE.Vector2(0.38, 0.84),
    new THREE.Vector2(0.32, 0.96),
    new THREE.Vector2(0.44, 1.02),
    new THREE.Vector2(0.38, 1.04),
    new THREE.Vector2(0.28, 0.96)
  ];
  const decanterLatheGeo = new THREE.LatheGeometry(decanterPts, 32);
  decanterLatheGeo.computeVertexNormals();

  for (const v of [
    { x: -1.18, y: -0.56, z: -3.22, r: 0.22, h: 0.62, apothecary: false },
    { x: 0.24,  y: -0.56, z: -3.28, r: 0.17, h: 0.52, apothecary: true },
    { x: 1.48,  y: -0.56, z: -3.24, r: 0.19, h: 0.56, apothecary: true }
  ]) {
    const bodyMat = v.apothecary ? amberBottleMat : creamCeramicMat;
    const vessel = new THREE.Mesh(decanterLatheGeo, bodyMat);
    vessel.position.set(v.x, v.y, v.z);
    vessel.scale.set(v.r, v.h, v.r);
    highriseGroup.add(vessel);

    // Brushed brass neck collar ring
    const neckCollar = new THREE.Mesh(
      new THREE.TorusGeometry(v.r * 0.36, 0.012, 10, 24),
      spoonBrassMat
    );
    neckCollar.rotation.x = Math.PI / 2;
    neckCollar.position.set(v.x, v.y + v.h * 0.96, v.z);
    highriseGroup.add(neckCollar);

    if (v.apothecary) {
      // Sculpted faceted octahedron crystal/brass decanter stopper
      const stopper = new THREE.Mesh(new THREE.OctahedronGeometry(v.r * 0.42, 1), spoonBrassMat);
      stopper.scale.set(0.85, 1.25, 0.85);
      stopper.position.set(v.x, v.y + v.h * 1.10, v.z);
      highriseGroup.add(stopper);
    } else {
      // 3D curved dried botanical stems arching out of the ceramic amphora mouth
      for (const sDir of [-1.0, 0.2, 1.1]) {
        const stemCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(v.x, v.y + v.h * 0.92, v.z),
          new THREE.Vector3(v.x + sDir * 0.08, v.y + v.h * 1.25, v.z + 0.04),
          new THREE.Vector3(v.x + sDir * 0.22, v.y + v.h * 1.52, v.z + 0.08)
        ]);
        const bStem = new THREE.Mesh(
          new THREE.TubeGeometry(stemCurve, 14, 0.010, 8, false),
          spoonBrassMat
        );
        highriseGroup.add(bStem);
      }
    }
  }

  // Candle Shaders: Translucent Wax Pillars, Sparkling Cut-Glass Votives & Loop 20 Pleated Lamp Shade
  const candleWaxMat = new THREE.ShaderMaterial({
    vertexShader: CANDLE_WAX_VERTEX_SHADER,
    fragmentShader: CANDLE_WAX_FRAGMENT_SHADER,
    uniforms: highriseUniforms,
    transparent: true
  });
  const glassVotiveMat = new THREE.ShaderMaterial({
    vertexShader: CANDLE_WAX_VERTEX_SHADER,
    fragmentShader: GLASS_VOTIVE_FRAGMENT_SHADER,
    uniforms: highriseUniforms,
    transparent: true
  });
  const pleatedLampMat = new THREE.ShaderMaterial({
    vertexShader: CANDLE_WAX_VERTEX_SHADER,
    fragmentShader: PLEATED_LAMP_FRAGMENT_SHADER,
    uniforms: highriseUniforms,
    transparent: true,
    side: THREE.DoubleSide
  });

  // Loop 30: Sculpted Mid-Century Pleated Table Lamp (Lathe-turned walnut & brass base + 36-pleat 3D zig-zag vertex-corrugated shade)
  const pleatedLampGroup = new THREE.Group();
  pleatedLampGroup.position.set(-1.68, -0.56, -2.85);

  const lampBasePts = [
    new THREE.Vector2(0.00, 0.00),
    new THREE.Vector2(0.18, 0.00),
    new THREE.Vector2(0.19, 0.03),
    new THREE.Vector2(0.14, 0.05),
    new THREE.Vector2(0.20, 0.16),
    new THREE.Vector2(0.16, 0.28),
    new THREE.Vector2(0.06, 0.34),
    new THREE.Vector2(0.03, 0.46)
  ];
  const lampBaseGeo = new THREE.LatheGeometry(lampBasePts, 32);
  lampBaseGeo.computeVertexNormals();
  const lampBaseMesh = new THREE.Mesh(lampBaseGeo, stonewareShaderMat);
  pleatedLampGroup.add(lampBaseMesh);

  const lampBrassStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.028, 0.18, 16),
    spoonBrassMat
  );
  lampBrassStem.position.y = 0.42;
  pleatedLampGroup.add(lampBrassStem);

  // 36-pleat 3D zig-zag vertex-corrugated conical lampshade
  const pleatedShadeGeo = new THREE.CylinderGeometry(0.20, 0.34, 0.38, 72, 12, true);
  pleatedShadeGeo.translate(0, 0.5, 0);
  const psPos = pleatedShadeGeo.attributes.position;
  for (let i = 0; i < psPos.count; i++) {
    let sx = psPos.getX(i);
    const sy = psPos.getY(i);
    let sz = psPos.getZ(i);
    const sAng = Math.atan2(sz, sx);
    // Crisp accordion zig-zag pleat wave in 3D vertex space
    const pleatZigZag = Math.cos(sAng * 36.0) * 0.022;
    const sRad = Math.hypot(sx, sz);
    if (sRad > 0.01) {
      const factor = (sRad + pleatZigZag) / sRad;
      sx *= factor;
      sz *= factor;
    }
    psPos.setXYZ(i, sx, sy, sz);
  }
  pleatedShadeGeo.computeVertexNormals();

  const pleatedShadeMesh = new THREE.Mesh(pleatedShadeGeo, pleatedLampMat);
  pleatedShadeMesh.position.y = 0.38;
  pleatedLampGroup.add(pleatedShadeMesh);

  const shadeTopRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.20, 0.008, 10, 36),
    spoonBrassMat
  );
  shadeTopRing.rotation.x = Math.PI / 2;
  shadeTopRing.position.y = 0.76;
  pleatedLampGroup.add(shadeTopRing);

  highriseGroup.add(pleatedLampGroup);

  // Loop 20: Animated swaying teardrop candle flame shader
  const flameMat = new THREE.ShaderMaterial({
    vertexShader: CANDLE_FLAME_VERTEX_SHADER,
    fragmentShader: CANDLE_FLAME_FRAGMENT_SHADER,
    uniforms: highriseUniforms,
    transparent: true
  });

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 128;
  glowCanvas.height = 128;
  const gCtx = glowCanvas.getContext('2d');
  const gGrad = gCtx.createRadialGradient(64, 64, 2, 64, 64, 62);
  gGrad.addColorStop(0.0, 'rgba(255, 248, 215, 0.96)');
  gGrad.addColorStop(0.30, 'rgba(251, 146, 60, 0.52)');
  gGrad.addColorStop(0.68, 'rgba(234, 88, 12, 0.16)');
  gGrad.addColorStop(1.0, 'rgba(234, 88, 12, 0.0)');
  gCtx.fillStyle = gGrad;
  gCtx.fillRect(0, 0, 128, 128);
  const candleGlowTex = new THREE.CanvasTexture(glowCanvas);
  const candleSpriteMat = new THREE.SpriteMaterial({
    map: candleGlowTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  // Loop 24: 3D Sculpted Melted-Wax Pillar Candle, Radially Fluted Cut-Glass Votives, Brass Coaster Trays & 3D Wicks
  // Position all 3 candles inside the open viewport (clear of the right UI panel) framing Mochi-Puff
  const candleSpecs = [
    { x: 0.82,  y: -0.94, z: -1.08, r: 0.165, h: 0.54, votive: false, pleated: false },
    { x: 0.38,  y: -0.94, z: -1.02, r: 0.135, h: 0.32, votive: true,  pleated: false },
    { x: -1.62, y: -0.94, z: -0.82, r: 0.155, h: 0.42, votive: true,  pleated: false }
  ];

  // 1. Sculpted Organic Melted-Wax Pillar Geometry (concave wax pool, asymmetric wavy lip & 3D vertical wax drip rivulets)
  const sculptedWaxPillarGeo = new THREE.CylinderGeometry(1.0, 1.02, 1.0, 56, 32, false);
  sculptedWaxPillarGeo.translate(0, 0.5, 0);
  const waxPos = sculptedWaxPillarGeo.attributes.position;
  for (let i = 0; i < waxPos.count; i++) {
    let vx = waxPos.getX(i);
    let vy = waxPos.getY(i);
    let vz = waxPos.getZ(i);
    const rad = Math.hypot(vx, vz);
    const ang = Math.atan2(vz, vx);

    // Organic wavy crater rim & sunken concave melted wax pool on the top cap
    if (vy > 0.88) {
      const topFactor = Math.max(0.0, (vy - 0.88) / 0.12);
      const craterWave =
        (Math.sin(ang * 3.0 + 0.6) * 0.055 +
          Math.cos(ang * 5.0 - 1.1) * 0.032 +
          Math.sin(ang * 8.0 + 2.0) * 0.015) *
        Math.pow(Math.min(1.0, rad), 1.5);
      const sunkenPool = -0.095 * Math.max(0.0, 1.0 - rad * rad * 1.15);
      vy += topFactor * (craterWave + sunkenPool);
    }

    // 3D frozen wax drip rivulets running down the outer cylindrical wall
    if (rad > 0.75) {
      const drip1 = Math.exp(-Math.pow(((ang - 0.45) * 4.5), 2.0)) * Math.max(0.0, Math.sin((vy - 0.32) * 3.14159));
      const drip2 = Math.exp(-Math.pow(((ang + 1.25) * 5.2), 2.0)) * Math.max(0.0, Math.sin((vy - 0.48) * 3.8));
      const drip3 = Math.exp(-Math.pow(((ang - 2.15) * 4.8), 2.0)) * Math.max(0.0, Math.sin((vy - 0.22) * 2.9));
      const dripBead =
        Math.exp(-Math.pow(ang - 0.45, 2.0) * 22.0) * Math.exp(-Math.pow(vy - 0.36, 2.0) * 180.0) * 0.09 +
        Math.exp(-Math.pow(ang + 1.25, 2.0) * 24.0) * Math.exp(-Math.pow(vy - 0.52, 2.0) * 180.0) * 0.08;
      const radialBulge = 1.0 + (drip1 * 0.065 + drip2 * 0.055 + drip3 * 0.050 + dripBead);
      vx *= radialBulge;
      vz *= radialBulge;
    }

    waxPos.setXYZ(i, vx, vy, vz);
  }
  sculptedWaxPillarGeo.computeVertexNormals();

  // 2. Sculpted 3D Radially Fluted Cut-Glass Votive Jar Geometry (22 vertical 3D crystal flutes + diamond facets)
  const flutedVotiveGlassGeo = new THREE.CylinderGeometry(1.02, 0.88, 1.0, 64, 24, false);
  flutedVotiveGlassGeo.translate(0, 0.5, 0);
  const votPos = flutedVotiveGlassGeo.attributes.position;
  for (let i = 0; i < votPos.count; i++) {
    let vx = votPos.getX(i);
    let vy = votPos.getY(i);
    let vz = votPos.getZ(i);
    const rad = Math.hypot(vx, vz);
    const ang = Math.atan2(vz, vx);
    if (rad > 0.55) {
      const flute = Math.cos(ang * 22.0) * 0.052 + Math.sin(vy * 28.0) * 0.018;
      const scaleR = 1.0 + flute;
      vx *= scaleR;
      vz *= scaleR;
    } else if (vy > 0.95) {
      // Hollow recessed interior of the glass votive jar
      vy = 0.62;
    }
    votPos.setXYZ(i, vx, vy, vz);
  }
  flutedVotiveGlassGeo.computeVertexNormals();

  // 3. Lathe-Sculpted Brushed Brass Coaster Tray Geometry beneath each candle
  const coasterTrayPts = [
    new THREE.Vector2(0.00, 0.000),
    new THREE.Vector2(1.08, 0.000),
    new THREE.Vector2(1.22, 0.025),
    new THREE.Vector2(1.26, 0.068),
    new THREE.Vector2(1.20, 0.076),
    new THREE.Vector2(1.12, 0.036),
    new THREE.Vector2(0.00, 0.032)
  ];
  const brassCoasterGeo = new THREE.LatheGeometry(coasterTrayPts, 36);
  brassCoasterGeo.computeVertexNormals();

  // 4. 3D Curved Braided Wick, Glowing Ember Tip & Dual-Layer Flame Geometry
  const wickCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, -0.04, 0.0),
    new THREE.Vector3(0.004, 0.015, 0.002),
    new THREE.Vector3(0.012, 0.055, -0.004)
  ]);
  const wickGeo = new THREE.TubeGeometry(wickCurve, 12, 0.0075, 8, false);
  const wickMat = new THREE.MeshStandardMaterial({ color: '#1c1512', roughness: 0.9 });
  const emberMat = new THREE.MeshBasicMaterial({ color: '#ff5500' });

  const flameGeo = new THREE.SphereGeometry(0.058, 16, 14);
  flameGeo.scale(0.56, 2.15, 0.56);
  const innerFlameGeo = new THREE.SphereGeometry(0.032, 12, 10);
  innerFlameGeo.scale(0.52, 1.65, 0.52);
  const innerFlameMat = new THREE.MeshBasicMaterial({ color: '#fffbeb' });

  for (const c of candleSpecs) {
    // A. Lathe-sculpted brushed brass candle coaster tray on the walnut desk
    const tray = new THREE.Mesh(brassCoasterGeo, spoonBrassMat);
    tray.position.set(c.x, c.y, c.z);
    tray.scale.set(c.r, 1.0, c.r);
    highriseGroup.add(tray);

    // B. Sculpted Candle Body (either 3D Melted-Wax Pillar or 3D Fluted Glass Votive + Inner Wax Tea-Light Core)
    const baseY = c.y + 0.028;
    if (c.votive) {
      const innerWax = new THREE.Mesh(sculptedWaxPillarGeo, candleWaxMat);
      innerWax.position.set(c.x, baseY + 0.02, c.z);
      innerWax.scale.set(c.r * 0.82, c.h * 0.68, c.r * 0.82);
      highriseGroup.add(innerWax);

      const glassJar = new THREE.Mesh(flutedVotiveGlassGeo, glassVotiveMat);
      glassJar.position.set(c.x, baseY, c.z);
      glassJar.scale.set(c.r, c.h, c.r);
      highriseGroup.add(glassJar);

      // Thick rolled glass lip torus at top of the votive holder
      const glassLip = new THREE.Mesh(
        new THREE.TorusGeometry(c.r * 1.01, c.r * 0.065, 12, 40),
        glassVotiveMat
      );
      glassLip.rotation.x = Math.PI / 2;
      glassLip.position.set(c.x, baseY + c.h, c.z);
      highriseGroup.add(glassLip);
    } else {
      const pillarMesh = new THREE.Mesh(sculptedWaxPillarGeo, candleWaxMat);
      pillarMesh.position.set(c.x, baseY, c.z);
      pillarMesh.scale.set(c.r, c.h, c.r);
      highriseGroup.add(pillarMesh);
    }

    // C. 3D Curved Braided Cotton Wick + Glowing Ember Tip + Inner & Outer Teardrop Flames
    if (!c.pleated) {
      const wickBaseY = c.votive ? baseY + c.h * 0.68 : baseY + c.h * 0.94;
      const wickMesh = new THREE.Mesh(wickGeo, wickMat);
      wickMesh.position.set(c.x, wickBaseY, c.z);
      highriseGroup.add(wickMesh);

      const emberTip = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), emberMat);
      emberTip.position.set(c.x + 0.011, wickBaseY + 0.052, c.z - 0.003);
      highriseGroup.add(emberTip);

      const innerFlame = new THREE.Mesh(innerFlameGeo, innerFlameMat);
      innerFlame.position.set(c.x + 0.008, wickBaseY + 0.082, c.z);
      highriseGroup.add(innerFlame);

      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(c.x + 0.008, wickBaseY + 0.105, c.z);
      highriseGroup.add(flame);
    }

    const glowSprite = new THREE.Sprite(candleSpriteMat);
    glowSprite.position.set(c.x, baseY + c.h * 0.85, c.z);
    const gScale = c.r * 5.8;
    glowSprite.scale.set(gScale, gScale, 1.0);
    highriseGroup.add(glowSprite);
  }

  // Loop 19: Ribbed Wire-Cage Floor Lantern surrounding the bottom-left floor candle
  const lanternWireMat = new THREE.MeshStandardMaterial({
    color: '#1a120b',
    roughness: 0.35,
    metalness: 0.75,
    wireframe: true
  });
  const floorLanternCage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.44, 1.05, 12, 4),
    lanternWireMat
  );
  floorLanternCage.position.set(-4.25, -1.95, -0.85);
  highriseGroup.add(floorLanternCage);

  // Loop 19: Woven Rattan Under-Desk Basket tucked in the desk kneehole
  const rattanMat = new THREE.MeshStandardMaterial({
    color: '#784b2a',
    roughness: 0.82
  });
  const rattanBasket = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.56, 1.15, 18), rattanMat);
  rattanBasket.position.set(-0.25, -2.55, -0.85);
  highriseGroup.add(rattanBasket);

  // 6. Loop 17 & 19: Cozy Tufted Lounge Armchair with Chunky Waffle-Knit Throw Blanket & Fringed Shawl
  const cushionMat = new THREE.MeshStandardMaterial({
    color: '#8c7a6b',
    roughness: 0.78,
    metalness: 0.02
  });
  const chairWoodMat = new THREE.MeshStandardMaterial({
    color: '#28150c',
    roughness: 0.45
  });
  const knitThrowMat = new THREE.ShaderMaterial({
    vertexShader: HIGHRISE_GLASS_VERTEX_SHADER,
    fragmentShader: KNIT_THROW_FRAGMENT_SHADER
  });

  const chairGroup = new THREE.Group();
  chairGroup.position.set(-3.95, -1.65, 0.65);
  chairGroup.rotation.y = 0.52;

  // Tufted backrest cushion & seat cushion
  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(1.85, 2.55, 0.52), cushionMat);
  chairBack.position.set(0, 1.15, -0.55);
  chairBack.rotation.x = -0.22;
  chairGroup.add(chairBack);

  // Loop 19: Button-tuft indentations across the plush backrest
  const tuftButtonGeo = new THREE.SphereGeometry(0.055, 10, 10);
  for (const ty of [0.65, 1.25, 1.85]) {
    for (const tx of [-0.42, 0.42]) {
      const btn = new THREE.Mesh(tuftButtonGeo, chairWoodMat);
      btn.position.set(tx, ty, -0.28 + (ty - 1.15) * 0.22);
      chairGroup.add(btn);
    }
  }

  const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.48, 1.65), cushionMat);
  chairSeat.position.set(0, 0.0, 0.15);
  chairGroup.add(chairSeat);

  // Loop 19: Chunky Waffle-Knit Cream Throw Blanket draped across the chair seat cushion
  const knitBlanketGeo = new THREE.BoxGeometry(1.42, 0.22, 1.38, 12, 4, 12);
  const kbPos = knitBlanketGeo.attributes.position;
  for (let i = 0; i < kbPos.count; i++) {
    const vx = kbPos.getX(i);
    const vy = kbPos.getY(i);
    const vz = kbPos.getZ(i);
    const foldWave = Math.sin(vx * 5.5 + vz * 4.2) * 0.045 + Math.cos(vz * 7.0) * 0.025;
    kbPos.setY(i, vy + foldWave);
  }
  knitBlanketGeo.computeVertexNormals();
  const knitBlanketMesh = new THREE.Mesh(knitBlanketGeo, knitThrowMat);
  knitBlanketMesh.position.set(0.12, 0.28, 0.22);
  knitBlanketMesh.rotation.y = 0.24;
  chairGroup.add(knitBlanketMesh);

  // Loop 19: Draped Shawl over the top-left corner of the backrest
  const backShawlMesh = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.15, 0.62), knitThrowMat);
  backShawlMesh.position.set(-0.52, 1.92, -0.78);
  backShawlMesh.rotation.set(-0.22, 0.12, 0.18);
  chairGroup.add(backShawlMesh);

  // Curved dark wood armrest & angled mid-century support strut
  const chairArm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 1.65), chairWoodMat);
  chairArm.position.set(0.92, 0.62, 0.10);
  chairGroup.add(chairArm);

  const chairArmStrut = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.22), chairWoodMat);
  chairArmStrut.position.set(0.92, 0.28, 0.42);
  chairArmStrut.rotation.x = -0.38;
  chairGroup.add(chairArmStrut);

  highriseGroup.add(chairGroup);

  // Loop 29: Lathe-Sculpted Stoneware Planter Pot, Drainage Saucer, Soil Mound & 3D Tube-Stemmed Botanical Leaves
  const planterGroup = new THREE.Group();
  planterGroup.position.set(-1.75, -0.94, -1.48);

  const potPts = [
    new THREE.Vector2(0.00, 0.00),
    new THREE.Vector2(0.25, 0.00),
    new THREE.Vector2(0.28, 0.03),
    new THREE.Vector2(0.22, 0.04),
    new THREE.Vector2(0.28, 0.22),
    new THREE.Vector2(0.32, 0.42),
    new THREE.Vector2(0.34, 0.46),
    new THREE.Vector2(0.30, 0.48),
    new THREE.Vector2(0.27, 0.40)
  ];
  const potLatheGeo = new THREE.LatheGeometry(potPts, 32);
  potLatheGeo.computeVertexNormals();
  const plantPotMesh = new THREE.Mesh(potLatheGeo, stonewareShaderMat);
  planterGroup.add(plantPotMesh);

  // Domed dark organic potting soil mound inside the planter pot
  const soilMat = new THREE.MeshStandardMaterial({ color: '#1f140e', roughness: 0.92 });
  const soilMound = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    soilMat
  );
  soilMound.scale.set(1.0, 0.32, 1.0);
  soilMound.position.y = 0.38;
  planterGroup.add(soilMound);

  const foliageLeafMat = new THREE.ShaderMaterial({
    vertexShader: FOLIAGE_LEAF_VERTEX_SHADER,
    fragmentShader: FOLIAGE_LEAF_FRAGMENT_SHADER,
    side: THREE.DoubleSide
  });

  // 3D Vertex-Cupped Botanical Leaf Geometry (arched midrib + drooping tip + scalloped edge)
  const leafGeo = new THREE.SphereGeometry(0.24, 16, 12);
  leafGeo.scale(1.55, 0.08, 0.78);
  const lfPos = leafGeo.attributes.position;
  for (let i = 0; i < lfPos.count; i++) {
    const lx = lfPos.getX(i);
    const ly = lfPos.getY(i);
    const lz = lfPos.getZ(i);
    // Arch along length (lx) and cup upward away from central midrib (lz)
    const archY = -Math.pow(lx / 0.37, 2.0) * 0.055 + Math.abs(lz) * 0.14;
    lfPos.setY(i, ly + archY);
  }
  leafGeo.computeVertexNormals();

  const stemMat = new THREE.MeshStandardMaterial({
    color: '#1e3a23',
    roughness: 0.55,
    emissive: '#0d1f12',
    emissiveIntensity: 0.30
  });

  // 14 3D Curved Tubular Petiole Stems growing out of the soil mound to 3D cupped leaves
  for (let s = 0; s < 14; s++) {
    const ang = (s / 14) * Math.PI * 2.0 + (rand() - 0.5) * 0.25;
    const reach = 0.20 + (s % 3) * 0.10 + rand() * 0.08;
    const height = 0.58 + (2 - (s % 3)) * 0.15 + rand() * 0.10;
    const ex = Math.cos(ang) * reach;
    const ez = Math.sin(ang) * reach;

    const pCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(ang) * 0.05, 0.40, Math.sin(ang) * 0.05),
      new THREE.Vector3(ex * 0.55, height + 0.06, ez * 0.55),
      new THREE.Vector3(ex, height, ez)
    ]);
    const stemMesh = new THREE.Mesh(
      new THREE.TubeGeometry(pCurve, 14, 0.011, 8, false),
      stemMat
    );
    planterGroup.add(stemMesh);

    const pLeaf = new THREE.Mesh(leafGeo, foliageLeafMat);
    pLeaf.position.set(ex * 1.08, height - 0.01, ez * 1.08);
    pLeaf.rotation.set((rand() - 0.5) * 0.45, -ang, -0.35 - (s % 3) * 0.12);
    pLeaf.scale.setScalar(0.48 + rand() * 0.24);
    planterGroup.add(pLeaf);
  }

  highriseGroup.add(planterGroup);

  for (let i = 0; i < 28; i++) {
    const leaf = new THREE.Mesh(leafGeo, foliageLeafMat);
    let lx = 0;
    let ly = 0;
    let lz = 0;
    if (i < 16) {
      // Upper-left overhanging window tree branch
      lx = -1.6 - rand() * 1.8;
      ly = 0.65 + rand() * 1.4;
      lz = -2.2 - rand() * 1.0;
    } else {
      // Lower-right foreground monstera/houseplant leaves
      lx = 1.45 + rand() * 1.2;
      ly = -1.25 + rand() * 0.75;
      lz = 0.35 + rand() * 0.75;
    }
    leaf.position.set(lx, ly, lz);
    leaf.rotation.set((rand() - 0.5) * 0.95, rand() * Math.PI, (rand() - 0.5) * 0.85);
    leaf.scale.setScalar(0.55 + rand() * 0.75);
    highriseGroup.add(leaf);
  }

  // Floating Warm Golden Candle-Mote Bokeh Orbs in the Cozy Room Air
  const deskMoteCount = 65;
  const deskMoteGeo = new THREE.BufferGeometry();
  const deskMotePos = new Float32Array(deskMoteCount * 3);
  for (let i = 0; i < deskMoteCount; i++) {
    deskMotePos[i * 3] = (rand() - 0.5) * 6.5;
    deskMotePos[i * 3 + 1] = (rand() - 0.25) * 3.4;
    deskMotePos[i * 3 + 2] = (rand() - 0.5) * 3.8 - 0.8;
  }
  deskMoteGeo.setAttribute('position', new THREE.BufferAttribute(deskMotePos, 3));
  const deskWarmMotes = new THREE.Points(
    deskMoteGeo,
    new THREE.PointsMaterial({
      color: '#fde68a',
      map: moteCircleTex,
      size: 0.048,
      transparent: true,
      opacity: 0.62,
      alphaTest: 0.01,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  highriseGroup.add(deskWarmMotes);

  // Warm interior candle PointLights (right desk cluster + left/window sill cluster)
  const cozyLampLight = new THREE.PointLight('#fb923c', 2.25, 14.0, 1.35);
  cozyLampLight.position.set(2.6, 0.85, -0.85);
  highriseGroup.add(cozyLampLight);

  const leftCandleLight = new THREE.PointLight('#fdba74', 1.65, 12.0, 1.4);
  leftCandleLight.position.set(-2.2, 0.75, -1.65);
  highriseGroup.add(leftCandleLight);

  // --------------------------------------------------------------------------
  // D. AR CAMERA GROUP (Live Webcam Pass-Through + 3D AR Spatial Anchor Ring)
  // --------------------------------------------------------------------------
  const arGroup = new THREE.Group();
  arGroup.name = 'EnvAR';
  arGroup.visible = false;
  scene.add(arGroup);

  const arUniforms = {
    uTime: { value: 0.0 },
    uShadowScale: { value: 1.0 },
    uKeyLightDir: furSystem.sharedUniforms.uKeyLightDir,
    uKeyLightIntensity: furSystem.sharedUniforms.uKeyLightIntensity
  };

  const arReticleGeo = new THREE.PlaneGeometry(2.8, 2.8);
  arReticleGeo.rotateX(-Math.PI / 2);
  const arReticleMesh = new THREE.Mesh(
    arReticleGeo,
    new THREE.ShaderMaterial({
      vertexShader: AR_RETICLE_VERTEX_SHADER,
      fragmentShader: AR_RETICLE_FRAGMENT_SHADER,
      uniforms: arUniforms,
      transparent: true,
      depthWrite: false
    })
  );
  arReticleMesh.position.y = -0.94;
  arGroup.add(arReticleMesh);

  // 1. AR Interactive Placement Cursor (glides along detected surface plane)
  const arCursorUniforms = {
    uTime: arUniforms.uTime,
    uPulse: { value: 0.0 }
  };
  const arCursorGeo = new THREE.PlaneGeometry(1.6, 1.6);
  arCursorGeo.rotateX(-Math.PI / 2);
  const arCursorMesh = new THREE.Mesh(
    arCursorGeo,
    new THREE.ShaderMaterial({
      vertexShader: AR_CURSOR_VERTEX_SHADER,
      fragmentShader: AR_CURSOR_FRAGMENT_SHADER,
      uniforms: arCursorUniforms,
      transparent: true,
      depthWrite: false
    })
  );
  arCursorMesh.position.y = -0.94;
  arCursorMesh.visible = false;
  arGroup.add(arCursorMesh);

  // 2. AR Video-Tracked Feature Points (LiDAR / Point Cloud)
  const MAX_AR_FEATURES = 48;
  const featurePositions = new Float32Array(MAX_AR_FEATURES * 3);
  const featureConfidences = new Float32Array(MAX_AR_FEATURES);
  for (let i = 0; i < MAX_AR_FEATURES; i++) {
    featurePositions[i * 3 + 1] = -50.0; // parked out of view
    featureConfidences[i] = 0.0;
  }
  const featureGeo = new THREE.BufferGeometry();
  featureGeo.setAttribute('position', new THREE.BufferAttribute(featurePositions, 3));
  featureGeo.setAttribute('aConfidence', new THREE.BufferAttribute(featureConfidences, 1));

  const arPointsMat = new THREE.ShaderMaterial({
    vertexShader: AR_POINTS_VERTEX_SHADER,
    fragmentShader: AR_POINTS_FRAGMENT_SHADER,
    uniforms: { uTime: arUniforms.uTime },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const arFeaturePointsMesh = new THREE.Points(featureGeo, arPointsMat);
  arGroup.add(arFeaturePointsMesh);

  const arVideo = document.createElement('video');
  arVideo.id = 'ar-camera-video';
  arVideo.setAttribute('autoplay', '');
  arVideo.setAttribute('playsinline', '');
  arVideo.setAttribute('muted', '');
  arVideo.muted = true;
  arVideo.style.display = 'none';
  document.body.insertBefore(arVideo, container);

  const arFallbackCanvas = document.createElement('canvas');
  arFallbackCanvas.id = 'ar-fallback-canvas';
  arFallbackCanvas.width = 640;
  arFallbackCanvas.height = 360;
  arFallbackCanvas.style.display = 'none';
  document.body.insertBefore(arFallbackCanvas, container);
  const arFallbackCtx = arFallbackCanvas.getContext('2d');

  let activeStream = null;
  let isCameraLive = false;
  let isMirrored = true;
  let facingMode = 'user';
  let statusCallback = null;
  let planeDetectedCallback = null;

  let estimatedPlaneHeight = -0.94;
  let estimatedSurfaceType = 'Floor / Ground';
  let estimatedPlaneConfidence = 0.94;
  let detectedFeatureCount = 0;
  let currentAnchorPlaneY = -0.94;
  let cursorPulse = 0.0;
  let lastAnalysisTime = 0.0;

  // Real-Time AR Light Estimation state (active by default in AR scene)
  let lightEstimationEnabled = true;
  let lightEstimatedCallback = null;
  let lastLightEstTime = 0.0;
  let estLightAngle = -32;
  let estKeyIntensity = 1.42;
  let estRimIntensity = 1.25;
  let estAmbientIntensity = 0.68;
  let estExposure = 1.08;
  let estKeyR = 255;
  let estKeyG = 253;
  let estKeyB = 247;
  let estSkyR = 224;
  let estSkyG = 242;
  let estSkyB = 254;
  let estGndR = 71;
  let estGndG = 85;
  let estGndB = 105;
  let estKelvin = 5200;
  let estLuminancePct = 100;

  function rgbToHex(r, g, b) {
    const cr = Math.max(0, Math.min(255, Math.round(r))).toString(16).padStart(2, '0');
    const cg = Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, '0');
    const cb = Math.max(0, Math.min(255, Math.round(b))).toString(16).padStart(2, '0');
    return `#${cr}${cg}${cb}`;
  }

  // Offscreen canvas for lightweight computer vision plane & light estimation from video
  const cvCanvas = document.createElement('canvas');
  cvCanvas.width = 160;
  cvCanvas.height = 90;
  const cvCtx = cvCanvas.getContext('2d', { willReadFrequently: true });

  const tempRaycastPoint = new THREE.Vector3();
  const tempNormal = new THREE.Vector3(0, 1, 0);
  const cvRay = new THREE.Ray();
  const cvNdc = new THREE.Vector2();
  const arRaycaster = new THREE.Raycaster();

  function runARLightEstimation(time, forceImmediate = false) {
    if (!lightEstimationEnabled) return;
    if (!forceImmediate && time - lastLightEstTime < 0.10) return;
    lastLightEstTime = time;

    const source = isCameraLive && arVideo.readyState >= 2 ? arVideo : arFallbackCanvas;
    if (!source) return;

    try {
      cvCtx.drawImage(source, 0, 0, 160, 90);
      const imgData = cvCtx.getImageData(0, 0, 160, 90);
      const data = imgData.data;

      let totalLum = 0;
      let sampleCount = 0;
      let leftLum = 0;
      let rightLum = 0;
      let leftCount = 0;
      let rightCount = 0;
      let sumWX = 0;
      let sumWY = 0;
      let sumDirW = 0;
      let sumWR = 0;
      let sumWG = 0;
      let sumWB = 0;
      let sumColorW = 0;

      let skyR = 0;
      let skyG = 0;
      let skyB = 0;
      let skyW = 0;

      let gndR = 0;
      let gndG = 0;
      let gndB = 0;
      let gndW = 0;

      for (let y = 4; y < 86; y += 2) {
        for (let x = 4; x < 156; x += 3) {
          const idx = (y * 160 + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const lum = (r * 299 + g * 587 + b * 114) / 1000;

          totalLum += lum;
          sampleCount++;

          const screenX = isMirrored ? (160 - x) : x;
          if (screenX < 80) {
            leftLum += lum;
            leftCount++;
          } else {
            rightLum += lum;
            rightCount++;
          }

          // Exclude central portrait skin/hair tones from biasing room illuminant color toward red/orange
          const inPortraitZone = x > 38 && x < 122 && y > 12 && y < 84;
          const isSkinOrHairTone = r > g * 1.07 && g >= b * 0.96 && lum < 218;
          const nonSkinWeight = (inPortraitZone && isSkinOrHairTone) ? 0.03 : (isSkinOrHairTone ? 0.15 : 1.0);

          if (y < 45) {
            const sw = nonSkinWeight * (0.3 + 0.7 * Math.max(0.0, (lum - 80) / 175));
            skyR += r * sw;
            skyG += g * sw;
            skyB += b * sw;
            skyW += sw;
          } else {
            const gw = nonSkinWeight * 0.5;
            gndR += r * gw;
            gndG += g * gw;
            gndB += b * gw;
            gndW += gw;
          }

          if (y < 76) {
            const highL = Math.max(0.01, (lum - 45.0) / 210.0);
            const dirW = highL * highL * highL * highL;
            sumWX += ((screenX / 160.0) * 2.0 - 1.0) * dirW;
            sumWY += (1.0 - y / 90.0) * dirW;
            sumDirW += dirW;

            const colW = dirW * nonSkinWeight;
            sumWR += r * colW;
            sumWG += g * colW;
            sumWB += b * colW;
            sumColorW += colW;
          }
        }
      }

      const avgLum = sampleCount > 0 ? totalLum / sampleCount : 128;
      const normLum = Math.max(0.12, Math.min(1.30, avgLum / 155.0));

      const avgLeft = leftCount > 0 ? leftLum / leftCount : avgLum;
      const avgRight = rightCount > 0 ? rightLum / rightCount : avgLum;
      const sideBias = (avgRight - avgLeft) / Math.max(18.0, avgLum);
      const centX = sumDirW > 0 ? sumWX / sumDirW : 0.0;
      const combinedDirX = Math.max(-1.0, Math.min(1.0, centX * 1.45 + sideBias * 1.65));
      const targetAngle = Math.max(-165, Math.min(165, combinedDirX * 155.0));

      const targetKeyInt = Math.max(0.35, Math.min(2.35, 0.28 + Math.pow(normLum, 1.3) * 1.55));
      const targetRimInt = Math.max(0.22, Math.min(1.85, 0.20 + normLum * 1.15));
      const targetAmbInt = Math.max(0.32, Math.min(0.95, 0.30 + normLum * 0.48));
      const targetExposure = Math.max(0.75, Math.min(1.26, 0.75 + normLum * 0.38));

      const rawR = sumColorW > 0.001 ? sumWR / sumColorW : 254;
      const rawG = sumColorW > 0.001 ? sumWG / sumColorW : 251;
      const rawB = sumColorW > 0.001 ? sumWB / sumColorW : 246;

      // Natural white-balanced illuminant curve (keeps RGB in realistic 212..255 daylight/indoor range)
      const cMean = (rawR + rawG + rawB) / 3.0;
      const balR = cMean + (rawR - cMean) * 1.15;
      const balG = cMean + (rawG - cMean) * 1.15;
      const balB = cMean + (rawB - cMean) * 1.15;
      const maxC = Math.max(1, balR, balG, balB);
      const normR = (balR / maxC) * 255;
      const normG = (balG / maxC) * 255;
      const normB = (balB / maxC) * 255;

      // Blend with clean daylight reference so indoor wall paint never forces a red/orange key light
      const targetKeyR = Math.max(212, Math.min(255, normR * 0.48 + 255 * 0.52));
      const targetKeyG = Math.max(212, Math.min(255, normG * 0.48 + 252 * 0.52));
      const targetKeyB = Math.max(208, Math.min(255, normB * 0.48 + 248 * 0.52));

      const bRatio = (normB + 40) / (normR + 40);
      const targetKelvin = Math.round(Math.max(2700, Math.min(8500, 2600 + bRatio * 2900)) / 50) * 50;

      const alpha = forceImmediate ? 1.0 : 0.38;
      estLightAngle += (targetAngle - estLightAngle) * alpha;
      estKeyIntensity += (targetKeyInt - estKeyIntensity) * alpha;
      estRimIntensity += (targetRimInt - estRimIntensity) * alpha;
      estAmbientIntensity += (targetAmbInt - estAmbientIntensity) * alpha;
      estExposure += (targetExposure - estExposure) * alpha;
      estKeyR += (targetKeyR - estKeyR) * alpha;
      estKeyG += (targetKeyG - estKeyG) * alpha;
      estKeyB += (targetKeyB - estKeyB) * alpha;
      estKelvin = Math.round((estKelvin * (1.0 - alpha) + targetKelvin * alpha) / 50) * 50;
      estLuminancePct = Math.round(normLum * 100);

      if (skyW > 0.001) {
        const sR = skyR / skyW;
        const sG = skyG / skyW;
        const sB = skyB / skyW;
        estSkyR += (Math.max(195, Math.min(255, sR * 0.45 + 235 * 0.55)) - estSkyR) * alpha;
        estSkyG += (Math.max(195, Math.min(255, sG * 0.45 + 242 * 0.55)) - estSkyG) * alpha;
        estSkyB += (Math.max(195, Math.min(255, sB * 0.45 + 250 * 0.55)) - estSkyB) * alpha;
      }
      if (gndW > 0.001) {
        const gR = gndR / gndW;
        const gG = gndG / gndW;
        const gB = gndB / gndW;
        estGndR += (Math.max(95, Math.min(210, gR * 0.45 + 115 * 0.55)) - estGndR) * alpha;
        estGndG += (Math.max(95, Math.min(210, gG * 0.45 + 120 * 0.55)) - estGndG) * alpha;
        estGndB += (Math.max(95, Math.min(210, gB * 0.45 + 135 * 0.55)) - estGndB) * alpha;
      }

      const keyColorHex = rgbToHex(estKeyR, estKeyG, estKeyB);
      const skyColorHex = rgbToHex(estSkyR, estSkyG, estSkyB);
      const gndColorHex = rgbToHex(estGndR, estGndG, estGndB);

      hemiLight.color.set(skyColorHex);
      hemiLight.groundColor.set(gndColorHex);
      hemiLight.intensity = estAmbientIntensity * 1.35;
      rimLight.color.set(skyColorHex);
      renderer.toneMappingExposure = estExposure;

      const u = furSystem.sharedUniforms;
      u.uAmbientIntensity.value = estAmbientIntensity;
      u.uRimLightColor.value.set(skyColorHex);
      u.uEnvSkyColor.value.set(skyColorHex);
      u.uEnvGroundColor.value.set(gndColorHex);
      u.uEnvTintStrength.value = 0.20;

      if (typeof lightEstimatedCallback === 'function') {
        lightEstimatedCallback({
          isManualReset: false,
          keyColor: keyColorHex,
          lightAngle: Math.round(estLightAngle),
          lightIntensity: Number(estKeyIntensity.toFixed(2)),
          rimIntensity: Number(estRimIntensity.toFixed(2)),
          ambientIntensity: Number(estAmbientIntensity.toFixed(2)),
          exposure: Number(estExposure.toFixed(2)),
          kelvin: estKelvin,
          luminancePct: estLuminancePct
        });
      }
    } catch (_e) {
      // Ignore video read exception during startup
    }
  }

  function runVideoPlaneEstimation(time) {
    if (time - lastAnalysisTime < 1.5) return; // 1.5s interval: zero lag, maximum 60fps performance
    lastAnalysisTime = time;

    const source = isCameraLive && arVideo.readyState >= 2 ? arVideo : arFallbackCanvas;
    if (!source) return;

    try {
      cvCtx.drawImage(source, 0, 0, 160, 90);
      const imgData = cvCtx.getImageData(0, 0, 160, 90);
      const data = imgData.data;

      // 1. Luminance & Edge Horizon Analysis across lower 2/3 of camera feed
      let maxGrad = 0;
      let dominantY = 55;
      let lowerTextureSum = 0;
      let lowerCount = 0;

      for (let y = 25; y < 80; y++) {
        let rowGrad = 0;
        for (let x = 15; x < 145; x += 3) {
          const idx = (y * 160 + x) * 4;
          const idxUp = ((y - 2) * 160 + x) * 4;
          const idxDown = ((y + 2) * 160 + x) * 4;

          const lum = (data[idx] * 299 + data[idx + 1] * 587 + data[idx + 2] * 114) / 1000;
          const lumUp = (data[idxUp] * 299 + data[idxUp + 1] * 587 + data[idxUp + 2] * 114) / 1000;
          const lumDown = (data[idxDown] * 299 + data[idxDown + 1] * 587 + data[idxDown + 2] * 114) / 1000;

          const dy = Math.abs(lumDown - lumUp);
          rowGrad += dy;

          if (y > 45) {
            lowerTextureSum += dy;
            lowerCount++;
          }
        }
        if (rowGrad > maxGrad) {
          maxGrad = rowGrad;
          dominantY = y;
        }
      }

      const avgLowerTexture = lowerCount > 0 ? lowerTextureSum / lowerCount : 0;
      if (dominantY >= 32 && dominantY <= 65 && avgLowerTexture > 8.0) {
        estimatedPlaneHeight = -0.52; // elevated desk / tabletop
        estimatedSurfaceType = 'Tabletop / Desk';
        estimatedPlaneConfidence = Math.min(0.97, 0.84 + avgLowerTexture * 0.005);
      } else {
        estimatedPlaneHeight = -0.94; // floor / ground plane
        estimatedSurfaceType = 'Floor / Ground';
        estimatedPlaneConfidence = Math.min(0.96, 0.86 + avgLowerTexture * 0.003);
      }

      // 2. Feature Keypoint Extraction (Harris/FAST gradient corners on input video)
      const candFeatures = [];
      for (let y = 26; y < 85; y += 4) {
        for (let x = 12; x < 148; x += 5) {
          const idx = (y * 160 + x) * 4;
          const idxL = (y * 160 + (x - 2)) * 4;
          const idxR = (y * 160 + (x + 2)) * 4;
          const idxU = ((y - 2) * 160 + x) * 4;
          const idxD = ((y + 2) * 160 + x) * 4;

          const lum = (data[idx] * 299 + data[idx + 1] * 587 + data[idx + 2] * 114) / 1000;
          const lumL = (data[idxL] * 299 + data[idxL + 1] * 587 + data[idxL + 2] * 114) / 1000;
          const lumR = (data[idxR] * 299 + data[idxR + 1] * 587 + data[idxR + 2] * 114) / 1000;
          const lumU = (data[idxU] * 299 + data[idxU + 1] * 587 + data[idxU + 2] * 114) / 1000;
          const lumD = (data[idxD] * 299 + data[idxD + 1] * 587 + data[idxD + 2] * 114) / 1000;

          const gx = Math.abs(lumR - lumL);
          const gy = Math.abs(lumD - lumU);
          const score = gx + gy;

          if (score > 16.0) {
            candFeatures.push({ x, y, score, lum });
          }
        }
      }

      candFeatures.sort((a, b) => b.score - a.score);
      const chosen = candFeatures.slice(0, MAX_AR_FEATURES);
      detectedFeatureCount = chosen.length;

      // 3. Project 2D Video Features into 3D World Space on Estimated Surface Plane
      if (camera) {
        const posAttr = featureGeo.attributes.position;
        const confAttr = featureGeo.attributes.aConfidence;

        for (let i = 0; i < MAX_AR_FEATURES; i++) {
          if (i < chosen.length) {
            const f = chosen[i];
            const px = isMirrored ? (160 - f.x) : f.x;
            cvNdc.x = (px / 160) * 2.0 - 1.0;
            cvNdc.y = -(f.y / 90) * 2.0 + 1.0;

            arRaycaster.setFromCamera(cvNdc, camera);
            cvRay.copy(arRaycaster.ray);

            if (cvRay.direction.y < -0.01) {
              const t = (estimatedPlaneHeight - cvRay.origin.y) / cvRay.direction.y;
              const wx = cvRay.origin.x + cvRay.direction.x * t;
              const wy = estimatedPlaneHeight + (f.lum / 255.0 - 0.5) * 0.04;
              const wz = cvRay.origin.z + cvRay.direction.z * t;
              posAttr.setXYZ(i, wx, wy, wz);
              confAttr.setX(i, Math.min(1.0, f.score / 75.0));
            } else {
              posAttr.setXYZ(i, 0, -50, 0);
              confAttr.setX(i, 0);
            }
          } else {
            posAttr.setXYZ(i, 0, -50, 0);
            confAttr.setX(i, 0);
          }
        }
        posAttr.needsUpdate = true;
        confAttr.needsUpdate = true;
      }

      if (typeof planeDetectedCallback === 'function') {
        planeDetectedCallback({
          surfaceType: estimatedSurfaceType,
          planeY: estimatedPlaneHeight,
          confidence: estimatedPlaneConfidence,
          featureCount: detectedFeatureCount
        });
      }
    } catch (_e) {
      // Ignore video read exception during startup
    }
  }

  function estimatePlaneAt(ndcX, ndcY) {
    if (!camera) return null;
    cvNdc.set(ndcX, ndcY);
    arRaycaster.setFromCamera(cvNdc, camera);
    const ray = arRaycaster.ray;

    // Responsive plane estimation based on tap horizon:
    // Upper region (ndcY > -0.15) targets table/desk surface (-0.52)
    // Lower region (ndcY <= -0.15) targets floor/ground surface (-0.94)
    const isTable = ndcY > -0.15;
    const planeY = isTable ? -0.52 : -0.94;
    const surfaceType = isTable ? 'Tabletop / Desk' : 'Floor / Ground';
    const confidence = isTable ? 0.94 : 0.96;

    let t = 4.0;
    if (ray.direction.y < -0.01) {
      t = (planeY - ray.origin.y) / ray.direction.y;
      t = Math.max(0.2, t);
    }

    tempRaycastPoint.copy(ray.origin).addScaledVector(ray.direction, t);
    const dist = ray.origin.distanceTo(tempRaycastPoint);
    const depthMeters = dist * 0.42;

    estimatedPlaneHeight = planeY;
    estimatedSurfaceType = surfaceType;
    estimatedPlaneConfidence = confidence;

    if (typeof planeDetectedCallback === 'function') {
      planeDetectedCallback({
        surfaceType,
        planeY,
        confidence,
        featureCount: detectedFeatureCount
      });
    }

    return {
      point: tempRaycastPoint.clone(),
      normal: tempNormal,
      depth: depthMeters,
      planeY: planeY,
      surfaceType: surfaceType,
      confidence: confidence
    };
  }

  function triggerPlacementPulse(point) {
    cursorPulse = 1.0;
    arCursorUniforms.uPulse.value = 1.0;
    if (point) {
      currentAnchorPlaneY = point.y;
      arReticleMesh.position.set(point.x, point.y, point.z);
    }
  }

  function setARAnchor(point) {
    if (point) {
      currentAnchorPlaneY = point.y;
      arReticleMesh.position.set(point.x, point.y, point.z);
    }
  }

  function resetARAnchor() {
    currentAnchorPlaneY = -0.94;
    arReticleMesh.position.set(0, -0.94, 0);
    isSurfaceLocked = false;
  }

  function updateARCursor(ndcX, ndcY, isVisible) {
    if (!isVisible || currentEnvId !== 'ar') {
      arCursorMesh.visible = false;
      return;
    }
    const hit = estimatePlaneAt(ndcX, ndcY);
    if (hit) {
      arCursorMesh.position.set(hit.point.x, hit.planeY + 0.005, hit.point.z);
      arCursorMesh.visible = true;
    } else {
      arCursorMesh.visible = false;
    }
  }

  function onPlaneDetected(cb) {
    planeDetectedCallback = cb;
  }

  function notifyARStatus(text, isLive) {
    if (typeof statusCallback === 'function') {
      statusCallback(text, isLive);
    }
  }

  function applyMirrorStyle() {
    const transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
    arVideo.style.transform = transform;
  }
  applyMirrorStyle();

  async function startARCamera() {
    stopARCamera();
    arFallbackCanvas.style.display = 'block';

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      isCameraLive = false;
      arVideo.style.display = 'none';
      arFallbackCanvas.style.display = 'block';
      notifyARStatus('Simulated AR Room Feed (Camera API unavailable)', false);
      return;
    }

    notifyARStatus('Requesting camera access...', false);
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Camera request timed out')), 1200);
      });

      let stream = null;
      try {
        stream = await Promise.race([
          navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false
          }),
          timeoutPromise
        ]);
      } catch (_innerErr) {
        stream = await Promise.race([
          navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          }),
          timeoutPromise
        ]);
      }

      if (currentEnvId !== 'ar') {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      activeStream = stream;
      arVideo.srcObject = stream;
      await arVideo.play();
      isCameraLive = true;
      arFallbackCanvas.style.display = 'none';
      arVideo.style.display = 'block';
      notifyARStatus('Live Camera Active', true);
    } catch (_err) {
      if (currentEnvId !== 'ar') return;
      isCameraLive = false;
      arVideo.style.display = 'none';
      arFallbackCanvas.style.display = 'block';
      notifyARStatus('Simulated AR Room Feed (Camera permission declined)', false);
    }
  }

  function stopARCamera() {
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      activeStream = null;
    }
    arVideo.srcObject = null;
    arVideo.style.display = 'none';
    arFallbackCanvas.style.display = 'none';
    isCameraLive = false;
  }

  function renderSimulatedARFeed(elapsedTime) {
    if (!arFallbackCtx) return;
    const w = arFallbackCanvas.width;
    const h = arFallbackCanvas.height;

    const g = arFallbackCtx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, '#cbd5e1');
    g.addColorStop(0.48, '#94a3b8');
    g.addColorStop(0.52, '#64748b');
    g.addColorStop(1.0, '#334155');
    arFallbackCtx.fillStyle = g;
    arFallbackCtx.fillRect(0, 0, w, h);

    const panX = Math.sin(elapsedTime * 0.4) * 28;
    const panY = Math.cos(elapsedTime * 0.3) * 14;
    const sunGrad = arFallbackCtx.createRadialGradient(
      w * 0.65 + panX,
      h * 0.32 + panY,
      20,
      w * 0.65 + panX,
      h * 0.32 + panY,
      240
    );
    sunGrad.addColorStop(0.0, 'rgba(254, 249, 195, 0.45)');
    sunGrad.addColorStop(1.0, 'rgba(254, 249, 195, 0.0)');
    arFallbackCtx.fillStyle = sunGrad;
    arFallbackCtx.fillRect(0, 0, w, h);

    arFallbackCtx.strokeStyle = 'rgba(103, 232, 249, 0.45)';
    arFallbackCtx.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) {
      const fx = ((i * 97 + 50) % (w - 80)) + 40 + panX * (0.4 + (i % 3) * 0.25);
      const fy = ((i * 67 + 120) % (h - 90)) + 60 + panY * 0.5;
      arFallbackCtx.beginPath();
      arFallbackCtx.moveTo(fx - 5, fy);
      arFallbackCtx.lineTo(fx + 5, fy);
      arFallbackCtx.moveTo(fx, fy - 5);
      arFallbackCtx.lineTo(fx, fy + 5);
      arFallbackCtx.stroke();
    }
  }

  // --------------------------------------------------------------------------
  // APPLY ENVIRONMENT PRESET & SYNCHRONIZE 3D LIGHTING
  // --------------------------------------------------------------------------
  function setEnvironment(envId) {
    const safeId = sanitizeEnvId(envId, 'studio');
    currentEnvId = safeId;

    document.body.setAttribute('data-env', safeId);

    studioGroup.visible = safeId === 'studio';
    meadowGroup.visible = safeId === 'meadow';
    highriseGroup.visible = safeId === 'highrise';
    arGroup.visible = safeId === 'ar';

    tiltShiftOverlay.style.display = safeId === 'highrise' ? 'block' : 'none';

    if (safeId === 'ar') {
      arReticleMesh.scale.set(0.35, 0.35, 0.35);
      arCursorMesh.scale.set(0.35, 0.35, 0.35);
      if (!isCameraLive) {
        renderSimulatedARFeed(0);
      }
      startARCamera();
    } else {
      arReticleMesh.scale.set(1.0, 1.0, 1.0);
      arCursorMesh.scale.set(1.0, 1.0, 1.0);
      stopARCamera();
    }

    const preset = ENVIRONMENT_PRESETS.find((p) => p.id === safeId) || ENVIRONMENT_PRESETS[0];

    keyLight.color.set(preset.keyColor);
    rimLight.color.set(preset.rimColor);
    if (preset.rimLightPos) {
      rimLight.position.set(preset.rimLightPos[0], preset.rimLightPos[1], preset.rimLightPos[2]);
    }
    hemiLight.color.set(preset.hemiSkyColor);
    hemiLight.groundColor.set(preset.hemiGroundColor);
    hemiLight.intensity = preset.hemiIntensity;
    renderer.toneMappingExposure = preset.exposure;

    const u = furSystem.sharedUniforms;
    u.uKeyLightColor.value.set(preset.keyColor);
    u.uRimLightColor.value.set(preset.rimColor);
    if (preset.rimLightPos) {
      u.uRimLightDir.value.set(preset.rimLightPos[0], preset.rimLightPos[1], preset.rimLightPos[2]).normalize();
    }
    u.uAmbientIntensity.value = preset.ambientIntensity;
    u.uEnvSkyColor.value.set(preset.envSkyColor);
    u.uEnvGroundColor.value.set(preset.envGroundColor);
    u.uEnvTintStrength.value = preset.envTintStrength;

    if (safeId === 'ar' && lightEstimationEnabled) {
      runARLightEstimation(performance.now() * 0.001, true);
    }

    return preset;
  }

  function applyNeutralARLighting() {
    const arPreset = ENVIRONMENT_PRESETS.find((p) => p.id === 'ar') || ENVIRONMENT_PRESETS[3];
    keyLight.color.set(arPreset.keyColor);
    rimLight.color.set(arPreset.rimColor);
    if (arPreset.rimLightPos) {
      rimLight.position.set(arPreset.rimLightPos[0], arPreset.rimLightPos[1], arPreset.rimLightPos[2]);
    }
    hemiLight.color.set(arPreset.hemiSkyColor);
    hemiLight.groundColor.set(arPreset.hemiGroundColor);
    hemiLight.intensity = arPreset.hemiIntensity;
    renderer.toneMappingExposure = arPreset.exposure;

    const u = furSystem.sharedUniforms;
    u.uKeyLightColor.value.set(arPreset.keyColor);
    u.uRimLightColor.value.set(arPreset.rimColor);
    if (arPreset.rimLightPos) {
      u.uRimLightDir.value.set(arPreset.rimLightPos[0], arPreset.rimLightPos[1], arPreset.rimLightPos[2]).normalize();
    }
    u.uAmbientIntensity.value = arPreset.ambientIntensity;
    u.uEnvSkyColor.value.set(arPreset.envSkyColor);
    u.uEnvGroundColor.value.set(arPreset.envGroundColor);
    u.uEnvTintStrength.value = arPreset.envTintStrength;

    if (typeof lightEstimatedCallback === 'function') {
      lightEstimatedCallback({
        isManualReset: true,
        keyColor: arPreset.keyColor,
        lightAngle: arPreset.lightAngle,
        lightIntensity: arPreset.lightIntensity,
        rimIntensity: arPreset.rimIntensity,
        ambientIntensity: arPreset.ambientIntensity,
        exposure: arPreset.exposure,
        kelvin: 5500,
        luminancePct: 100
      });
    }
  }

  function toggleMirror() {
    isMirrored = !isMirrored;
    applyMirrorStyle();
    return isMirrored;
  }

  function flipCamera() {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    if (currentEnvId === 'ar') {
      startARCamera();
    }
    return facingMode;
  }

  function onARStatusChange(cb) {
    statusCallback = cb;
  }

  // --------------------------------------------------------------------------
  // ZERO-GC PER-FRAME UPDATE
  // --------------------------------------------------------------------------
  function update(elapsedTime, windStrength, creatureRoot) {
    const shadowScale = 1.0 - creatureRoot.position.y * 0.45;
    const cx = creatureRoot.position.x * 0.7;

    if (currentEnvId === 'studio') {
      studioShadowMesh.scale.set(shadowScale, shadowScale, 1.0);
      studioShadowMesh.position.x = cx;
      studioMotes.rotation.y = elapsedTime * 0.04;
    } else if (currentEnvId === 'meadow') {
      meadowUniforms.uTime.value = elapsedTime;
      meadowUniforms.uWindStrength.value = windStrength;
      const kd = furSystem.sharedUniforms.uKeyLightDir.value;
      meadowUniforms.uSunDir.value.set(kd.x, 0.24, kd.z).normalize();
      meadowPollen.rotation.y = elapsedTime * 0.045;
      meadowPollen.position.y = Math.sin(elapsedTime * 0.85) * 0.10;
    } else if (currentEnvId === 'highrise') {
      const liftY = Math.max(0.0, creatureRoot.position.y + 0.705);
      highriseUniforms.uTime.value = elapsedTime;
      highriseUniforms.uCreatureXZ.value.set(creatureRoot.position.x, creatureRoot.position.z);
      highriseUniforms.uCreatureLift.value = liftY;
      highriseUniforms.uCreatureSquash.value.set(
        creatureRoot.scale.x / 0.25,
        creatureRoot.scale.y / 0.25
      );
      highriseUniforms.uCreatureRot.value.set(
        creatureRoot.rotation.y,
        creatureRoot.rotation.z
      );
      highriseUniforms.uShadowScale.value = 0.25 * Math.max(0.4, 1.0 - liftY * 1.5);
      cozyLampLight.intensity = 2.25 + Math.sin(elapsedTime * 5.8) * 0.12;
      leftCandleLight.intensity = 1.65 + Math.cos(elapsedTime * 4.9 + 1.3) * 0.09;
      deskWarmMotes.rotation.y = elapsedTime * 0.03;
      deskWarmMotes.position.y = Math.sin(elapsedTime * 0.9) * 0.06;
    } else if (currentEnvId === 'ar') {
      arUniforms.uTime.value = elapsedTime;
      arUniforms.uShadowScale.value = shadowScale;
      arReticleMesh.position.x = creatureRoot.position.x;
      arReticleMesh.position.z = creatureRoot.position.z;
      arReticleMesh.position.y = currentAnchorPlaneY;

      // Placement pulse animation decay
      if (cursorPulse > 0.001) {
        cursorPulse *= 0.92;
        arCursorUniforms.uPulse.value = 1.0 - cursorPulse;
      } else {
        cursorPulse = 0.0;
        arCursorUniforms.uPulse.value = 0.0;
      }

      if (!isCameraLive) {
        renderSimulatedARFeed(elapsedTime);
      }

      runVideoPlaneEstimation(elapsedTime);
      runARLightEstimation(elapsedTime);
    }
  }

  return {
    setEnvironment,
    getEnvironment: () => currentEnvId,
    toggleMirror,
    flipCamera,
    retryCamera: startARCamera,
    onARStatusChange,
    onPlaneDetected,
    onLightEstimated: (cb) => {
      lightEstimatedCallback = cb;
    },
    setLightEstimationEnabled: (enabled) => {
      lightEstimationEnabled = Boolean(enabled);
      if (currentEnvId === 'ar') {
        if (lightEstimationEnabled) {
          runARLightEstimation(performance.now() * 0.001, true);
        } else {
          applyNeutralARLighting();
        }
      }
    },
    isLightEstimationEnabled: () => lightEstimationEnabled,
    onSurfaceTracked: () => {},
    setSurfaceTrackingEnabled: () => {},
    isSurfaceLocked: () => false,
    estimatePlaneAt,
    triggerPlacementPulse,
    setARAnchor,
    resetARAnchor,
    updateARCursor,
    getPlaneInfo: () => ({
      surfaceType: estimatedSurfaceType,
      planeY: estimatedPlaneHeight,
      confidence: estimatedPlaneConfidence,
      featureCount: detectedFeatureCount
    }),
    update
  };
}
