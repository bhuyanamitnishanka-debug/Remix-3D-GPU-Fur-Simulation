import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

const SIM_SIZE = 128; // 128x128 = 16,384 parallel GPU spring-verlet hair patches

const VELOCITY_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uDelta;
  uniform float uStiffness;
  uniform float uDamping;
  uniform float uGravity;
  uniform float uWindStrength;
  uniform vec3 uCreatureVelocity;
  uniform vec3 uCreatureAngularVel;
  uniform vec3 uPointerLocalPos;
  uniform vec3 uPointerVelocity;
  uniform float uPointerActive;
  uniform float uBoopShockwave;

  // Compact 3D pseudo-curl turbulence for organic wind gusts
  vec3 windField(vec3 p, float t) {
    float wx = sin(p.y * 3.1 + t * 2.4) * cos(p.z * 2.7 + t * 1.9)
             + 0.5 * sin(p.z * 6.3 - t * 4.1);
    float wy = 0.35 * cos(p.x * 3.5 + t * 2.1) * sin(p.z * 2.9 + t * 1.7);
    float wz = cos(p.x * 2.8 - t * 2.2) * sin(p.y * 3.4 + t * 2.0);
    return vec3(wx, wy, wz);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Reconstruct spherical surface direction for this simulation texel
    float theta = (uv.x * 2.0 - 1.0) * 3.14159265;
    float phi = (1.0 - uv.y) * 3.14159265;
    vec3 surfNormal = normalize(vec3(
      sin(phi) * sin(theta),
      cos(phi),
      sin(phi) * cos(theta)
    ));

    vec4 posData = texture2D(texturePosition, uv);
    vec4 velData = texture2D(textureVelocity, uv);
    vec3 disp = posData.xyz;
    float combMemory = posData.w;
    vec3 vel = velData.xyz;

    float dt = clamp(uDelta, 0.001, 0.033);

    // 1. Hookean angular spring restoring force toward rest pose
    vec3 force = -uStiffness * disp;

    // 2. Tangential gravity droop (prevents hair from collapsing inward into the body)
    vec3 gravVec = vec3(0.0, -uGravity, 0.0);
    vec3 tangentGravity = gravVec - surfNormal * min(0.0, dot(gravVec, surfNormal));
    force += tangentGravity;

    // 3. Creature movement & rotational inertia (secondary motion follow-through)
    vec3 linearInertia = -uCreatureVelocity * 1.85;
    vec3 rotationalInertia = -cross(uCreatureAngularVel, surfNormal) * 2.2;
    force += linearInertia + rotationalInertia;

    // 4. Turbulent wind gusts
    vec3 wind = windField(surfNormal * 1.4, uTime) * uWindStrength;
    force += wind;

    // 5. Interactive pointer petting, parting, and combing
    if (uPointerActive > 0.5) {
      float dist = distance(surfNormal, normalize(uPointerLocalPos + vec3(0.0, 0.0, 1e-5)));
      if (dist < 0.55) {
        float falloff = pow(1.0 - dist / 0.55, 2.0);
        vec3 partDir = normalize(surfNormal - normalize(uPointerLocalPos) + vec3(0.0, 1e-4, 0.0));
        // Project parting & cursor velocity onto tangent plane
        vec3 strokeImpulse = uPointerVelocity * 2.8 + partDir * 3.4;
        strokeImpulse -= surfNormal * dot(strokeImpulse, surfNormal);
        force += strokeImpulse * falloff * 18.0;
      }
    }

    // 6. Click-to-boop radial shockwave ripple
    if (uBoopShockwave > 0.01) {
      float waveFront = (1.0 - uBoopShockwave) * 2.2;
      float dFront = abs(distance(surfNormal, vec3(0.0, 0.1, 0.98)) - waveFront);
      if (dFront < 0.35) {
        float ripple = (1.0 - dFront / 0.35) * uBoopShockwave;
        vec3 radial = normalize(surfNormal - vec3(0.0, 0.1, 0.98) + vec3(0.0, 1e-4, 0.0));
        force += radial * ripple * 22.0;
      }
    }

    // Semi-implicit Euler / Verlet velocity integration with exponential damping
    vel = (vel + force * dt) * exp(-uDamping * dt);

    // Clamp max velocity for guaranteed numerical stability
    float speed = length(vel);
    if (speed > 6.0) {
      vel = (vel / speed) * 6.0;
    }

    gl_FragColor = vec4(vel, combMemory);
  }
`;

const POSITION_FRAGMENT_SHADER = /* glsl */ `
  uniform float uDelta;
  uniform vec3 uPointerLocalPos;
  uniform float uPointerActive;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    float theta = (uv.x * 2.0 - 1.0) * 3.14159265;
    float phi = (1.0 - uv.y) * 3.14159265;
    vec3 surfNormal = normalize(vec3(
      sin(phi) * sin(theta),
      cos(phi),
      sin(phi) * cos(theta)
    ));

    vec4 posData = texture2D(texturePosition, uv);
    vec4 velData = texture2D(textureVelocity, uv);
    vec3 disp = posData.xyz;
    float combMemory = posData.w;
    vec3 vel = velData.xyz;

    float dt = clamp(uDelta, 0.001, 0.033);
    disp += vel * dt;

    // Prevent hair from penetrating inward along the surface normal
    float inward = dot(disp, surfNormal);
    if (inward < -0.15) {
      disp -= surfNormal * (inward + 0.15);
    }

    // Elastic length constraint (prevents infinite stretching under extreme forces)
    float maxDisp = 0.85;
    float dLen = length(disp);
    if (dLen > maxDisp) {
      disp = (disp / dLen) * maxDisp;
    }

    // Track recently petted/groomed regions in alpha channel for subtle sheen boost
    combMemory *= exp(-dt * 1.2);
    if (uPointerActive > 0.5) {
      float dist = distance(surfNormal, normalize(uPointerLocalPos + vec3(0.0, 0.0, 1e-5)));
      if (dist < 0.45) {
        combMemory = min(1.0, combMemory + (1.0 - dist / 0.45) * dt * 8.0);
      }
    }

    gl_FragColor = vec4(disp, combMemory);
  }
`;

export function createGPUFurPhysics(renderer) {
  let gpuCompute = null;
  let posVariable = null;
  let velVariable = null;
  let fallbackTexture = null;
  let isGPGPUActive = false;

  // Create a safe 4x4 fallback float texture in case a software WebGL context lacks float RTT
  const fallbackData = new Float32Array(4 * 4 * 4);
  fallbackTexture = new THREE.DataTexture(
    fallbackData,
    4,
    4,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  fallbackTexture.needsUpdate = true;

  try {
    gpuCompute = new GPUComputationRenderer(SIM_SIZE, SIM_SIZE, renderer);
    if (!renderer.capabilities.isWebGL2) {
      gpuCompute.setDataType(THREE.HalfFloatType);
    } else {
      gpuCompute.setDataType(THREE.HalfFloatType);
    }

    const dtPosition = gpuCompute.createTexture();
    const dtVelocity = gpuCompute.createTexture();

    posVariable = gpuCompute.addVariable('texturePosition', POSITION_FRAGMENT_SHADER, dtPosition);
    velVariable = gpuCompute.addVariable('textureVelocity', VELOCITY_FRAGMENT_SHADER, dtVelocity);

    gpuCompute.setVariableDependencies(velVariable, [posVariable, velVariable]);
    gpuCompute.setVariableDependencies(posVariable, [posVariable, velVariable]);

    // Initialize velocity uniforms
    velVariable.material.uniforms.uTime = { value: 0.0 };
    velVariable.material.uniforms.uDelta = { value: 0.016 };
    velVariable.material.uniforms.uStiffness = { value: 26.0 };
    velVariable.material.uniforms.uDamping = { value: 5.2 };
    velVariable.material.uniforms.uGravity = { value: 2.8 };
    velVariable.material.uniforms.uWindStrength = { value: 1.4 };
    velVariable.material.uniforms.uCreatureVelocity = { value: new THREE.Vector3() };
    velVariable.material.uniforms.uCreatureAngularVel = { value: new THREE.Vector3() };
    velVariable.material.uniforms.uPointerLocalPos = { value: new THREE.Vector3(0, 0, 1) };
    velVariable.material.uniforms.uPointerVelocity = { value: new THREE.Vector3() };
    velVariable.material.uniforms.uPointerActive = { value: 0.0 };
    velVariable.material.uniforms.uBoopShockwave = { value: 0.0 };

    // Initialize position uniforms
    posVariable.material.uniforms.uDelta = { value: 0.016 };
    posVariable.material.uniforms.uPointerLocalPos = { value: new THREE.Vector3(0, 0, 1) };
    posVariable.material.uniforms.uPointerActive = { value: 0.0 };

    const error = gpuCompute.init();
    if (error === null) {
      isGPGPUActive = true;
    } else {
      console.warn('GPGPU fallback mode enabled:', error);
    }
  } catch (e) {
    console.warn('GPGPU initialization fell back to analytical shader physics');
  }

  function step({
    time,
    dt,
    windStrength,
    creatureVelocity,
    creatureAngularVel,
    pointerLocalPos,
    pointerVelocity,
    pointerActive,
    boopShockwave
  }) {
    if (!isGPGPUActive || !gpuCompute) {
      return fallbackTexture;
    }

    const vUni = velVariable.material.uniforms;
    const pUni = posVariable.material.uniforms;

    vUni.uTime.value = time;
    vUni.uDelta.value = dt;
    vUni.uWindStrength.value = windStrength;
    vUni.uCreatureVelocity.value.copy(creatureVelocity);
    vUni.uCreatureAngularVel.value.copy(creatureAngularVel);
    vUni.uPointerLocalPos.value.copy(pointerLocalPos);
    vUni.uPointerVelocity.value.copy(pointerVelocity);
    vUni.uPointerActive.value = pointerActive ? 1.0 : 0.0;
    vUni.uBoopShockwave.value = boopShockwave;

    pUni.uDelta.value = dt;
    pUni.uPointerLocalPos.value.copy(pointerLocalPos);
    pUni.uPointerActive.value = pointerActive ? 1.0 : 0.0;

    gpuCompute.compute();
    return gpuCompute.getCurrentRenderTarget(posVariable).texture;
  }

  return {
    step,
    get isGPGPUActive() {
      return isGPGPUActive;
    },
    get fallbackTexture() {
      return fallbackTexture;
    }
  };
}


