// GPU Shaders for Interactive Dirt Terrain + Brush Ring Projection + 100,000 GPU-Instanced Grass Blades

export const DIRT_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vLocalPos;

  void main() {
    vUv = uv;
    vLocalPos = position;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const DIRT_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uGrowthMap;
  uniform sampler2D uSoilAlbedoTex;
  uniform sampler2D uSoilNormalTex;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform vec2 uBrushUV;
  uniform float uBrushRadiusUV;
  uniform float uBrushSoftness;
  uniform float uBrushActive;
  uniform vec3 uBrushColor;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vLocalPos;

  void main() {
    vec3 baseN = normalize(vWorldNormal);
    vec3 L = normalize(uSunDir);
    vec3 V = normalize(cameraPosition - vWorldPos);

    vec4 growthData = texture2D(uGrowthMap, vUv);
    float grassAmount = growthData.r;

    // Sample seamless tiled soil textures at two scales (primary 8x8 tile + rotated 3x3 macro blend)
    vec2 tileUV1 = vUv * 8.0;
    mat2 rotMat = mat2(0.866, -0.5, 0.5, 0.866);
    vec2 tileUV2 = (rotMat * (vUv - 0.5)) * 3.2 + 0.5;

    vec4 albedoSample1 = texture2D(uSoilAlbedoTex, tileUV1);
    vec4 albedoSample2 = texture2D(uSoilAlbedoTex, tileUV2);

    vec4 normSample1 = texture2D(uSoilNormalTex, tileUV1);
    vec4 normSample2 = texture2D(uSoilNormalTex, tileUV2);

    // Blend fine tiled soil crumbs with macro tonal variation
    vec3 soilAlbedo = mix(albedoSample1.rgb, albedoSample2.rgb, 0.32);
    float microAO = mix(albedoSample1.a, albedoSample2.a, 0.3);

    // Unpack tangent-space normal perturbation from the tiled normal texture
    vec2 nXY1 = normSample1.rg * 2.0 - 1.0;
    vec2 nXY2 = normSample2.rg * 2.0 - 1.0;
    vec2 combinedNXY = nXY1 * 0.85 + nXY2 * 0.45;

    vec3 N = normalize(baseN + vec3(combinedNXY.x, 0.0, combinedNXY.y) * 0.48);

    // Rich moist garden topsoil & subtle mossy under-turf where grass is painted
    vec3 lushHumus = soilAlbedo * vec3(0.58, 0.62, 0.52);
    vec3 mossyTint = mix(lushHumus, vec3(0.14, 0.27, 0.12), 0.38);
    float moistureMask = smoothstep(0.02, 0.55, grassAmount);
    vec3 albedo = mix(soilAlbedo, mossyTint, moistureMask);

    // Subtle diorama edge vignette
    float edgeDist = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0;
    float edgeVignette = 1.0 - smoothstep(0.90, 1.0, edgeDist) * 0.35;
    albedo *= edgeVignette;

    // Soft diffuse wrap + fine soil granule micro-specular
    float NdotL = max(0.0, dot(N, L));
    float wrapDiffuse = clamp((dot(N, L) + 0.22) / 1.22, 0.0, 1.0);
    float shadowFromGrass = 1.0 - grassAmount * 0.38;

    vec3 H = normalize(L + V + vec3(1e-6));
    float roughnessVal = normSample1.b;
    float specPower = mix(28.0, 10.0, roughnessVal);
    float spec = pow(max(0.0, dot(N, H)), specPower) * 0.07 * NdotL * (1.0 - grassAmount * 0.5);

    vec3 skyAmb = mix(vec3(0.38, 0.33, 0.29), vec3(0.54, 0.58, 0.65), N.y * 0.5 + 0.5);
    vec3 ambient = albedo * skyAmb * 0.82 * microAO;
    vec3 direct = (albedo * wrapDiffuse * shadowFromGrass * microAO + spec) * uSunColor * uSunIntensity;
    vec3 finalColor = ambient + direct;

    // Project interactive 3D Brush Ring + soft inner falloff preview onto the dirt
    if (uBrushActive > 0.5) {
      float dUV = distance(vUv, uBrushUV);
      if (dUV <= uBrushRadiusUV * 1.06) {
        float ringDist = abs(dUV - uBrushRadiusUV);
        float ringAlpha = 1.0 - smoothstep(0.0, 0.0045, ringDist);
        float innerRadius = uBrushRadiusUV * (1.0 - uBrushSoftness * 0.75);
        float innerRing = (1.0 - smoothstep(0.0, 0.003, abs(dUV - innerRadius))) * 0.45;
        float fillAlpha = (1.0 - smoothstep(innerRadius, uBrushRadiusUV, dUV)) * 0.18;

        float totalOverlay = clamp(ringAlpha * 0.9 + innerRing + fillAlpha, 0.0, 1.0);
        finalColor = mix(finalColor, uBrushColor, totalOverlay);
      }
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export const GRASS_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aRootPos;
  attribute vec2 aRootUV;
  attribute float aBladeSeed;
  attribute float aYawAngle;

  uniform sampler2D uGrowthMap;
  uniform float uBladeHeight;
  uniform float uBladeDensity;
  uniform float uBladeBend;
  uniform float uTime;
  uniform float uWindStrength;
  uniform vec2 uBrushUV;
  uniform float uBrushRadiusUV;
  uniform float uBrushActive;

  varying float vHeight;
  varying float vRibbonU;
  varying float vBladeSeed;
  varying float vGrowthVal;
  varying float vColorVar;
  varying vec3 vWorldPos;
  varying vec3 vBladeTangent;
  varying vec3 vBladeNormal;

  void main() {
    float h = position.y;      // [0..1] along the 14-segment curved grass blade
    vHeight = h;
    vRibbonU = position.x;     // [-1..1] across the grass blade width
    vBladeSeed = aBladeSeed;

    // Sample live painted Growth & Combing Map
    vec4 growthSample = texture2D(uGrowthMap, aRootUV);
    float growth = growthSample.r;
    vec2 paintedComb = (growthSample.gb - 0.5) * 2.0;
    vGrowthVal = growth;
    vColorVar = growthSample.a;

    // Cull unpainted or density-filtered blades in vertex shader
    if (growth < 0.02 || aBladeSeed > uBladeDensity) {
      gl_Position = vec4(2.0, 2.0, 2.0, 0.0);
      return;
    }

    // Natural blade height with per-blade variation and smooth sprouting curve
    float seedVar = 0.75 + 0.52 * fract(aBladeSeed * 19.37);
    float sproutScale = smoothstep(0.02, 0.25, growth) * (0.25 + 0.75 * growth);
    float totalLen = uBladeHeight * sproutScale * seedVar;

    // Base blade orientation (random yaw combined with painted brush stroke combing direction)
    vec2 randDir = vec2(cos(aYawAngle), sin(aYawAngle));
    float combStrength = length(paintedComb);
    vec2 leanDir2D = normalize(mix(randDir, paintedComb / max(0.001, combStrength), clamp(combStrength * 1.4, 0.0, 0.92)));
    vec3 leanDir = vec3(leanDir2D.x, 0.0, leanDir2D.y);
    vec3 sideDir = vec3(-leanDir.z, 0.0, leanDir.x);

    // Traveling multi-wave wind gusts across the meadow
    float windPhase = aRootPos.x * 0.75 + aRootPos.z * 0.55 - uTime * 2.6 + aBladeSeed * 2.5;
    float gust = (sin(windPhase) + 0.45 * sin(windPhase * 2.3 + 1.2) + 0.25) * uWindStrength * 0.26;
    vec3 windVec = vec3(cos(0.35), 0.0, sin(0.35)) * gust;

    // Interactive brush parting when hovering/painting over existing grass
    vec3 brushPush = vec3(0.0);
    if (uBrushActive > 0.5) {
      vec2 deltaUV = aRootUV - uBrushUV;
      float dUV = length(deltaUV);
      if (dUV < uBrushRadiusUV && dUV > 1e-5) {
        vec2 push2D = (deltaUV / dUV) * pow(1.0 - dUV / uBrushRadiusUV, 1.5) * 0.38;
        brushPush = vec3(push2D.x, 0.0, push2D.y);
      }
    }

    // Botanical cantilever arch along h
    float arch = pow(h, 1.55);
    float bendAmount = (0.22 + 0.68 * uBladeBend) * totalLen;
    vec3 horizontalOffset = (leanDir * bendAmount + (windVec + brushPush) * totalLen) * arch;

    // Conserve approximate arc-length so bending lowers the tip slightly instead of stretching
    float horizDist = length(horizontalOffset);
    float verticalRise = max(0.02, h * totalLen - 0.28 * (horizDist * horizDist) / max(0.1, totalLen));

    vec3 spineLocal = aRootPos + vec3(horizontalOffset.x, verticalRise, horizontalOffset.z);

    // Instantaneous blade tangent d(spineLocal)/dh
    vec3 dHoriz = (leanDir * bendAmount + (windVec + brushPush) * totalLen) * (1.55 * pow(max(0.04, h), 0.55));
    vec3 localTangent = normalize(vec3(dHoriz.x, totalLen, dHoriz.z));

    // Taper blade width smoothly from base through mid-blade to sharp botanical point
    float baseWidth = 0.024 * (0.85 + 0.35 * sproutScale);
    float widthProfile = sin(h * 3.14159265 * 0.78) * (1.0 - pow(h, 1.65)) + 0.35 * (1.0 - h);
    float width = baseWidth * widthProfile;

    // V-shaped mid-rib fold across the blade width for crisp 3D botanical lighting
    float vFold = abs(position.x) * 0.28 * width;
    vec3 finalLocal = spineLocal + sideDir * (position.x * width) - leanDir * vFold;

    vec4 worldPosition = modelMatrix * vec4(finalLocal, 1.0);
    vWorldPos = worldPosition.xyz;
    vBladeTangent = normalize(mat3(modelMatrix) * localTangent);

    //Perturb blade normal left/right across the mid-rib V-crease
    vec3 faceNormal = normalize(cross(sideDir, localTangent) + sideDir * (position.x * 0.55));
    vBladeNormal = normalize(mat3(modelMatrix) * faceNormal);

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const GRASS_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uTipColor;
  uniform float uRoughness;
  uniform float uSpecular;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform float uRimIntensity;

  varying float vHeight;
  varying float vRibbonU;
  varying float vBladeSeed;
  varying float vGrowthVal;
  varying float vColorVar;
  varying vec3 vWorldPos;
  varying vec3 vBladeTangent;
  varying vec3 vBladeNormal;

  void main() {
    vec3 T = normalize(vBladeTangent);
    vec3 N = normalize(vBladeNormal);
    vec3 L = normalize(uSunDir);
    vec3 V = normalize(cameraPosition - vWorldPos);

    // 1. Botanical Root-to-Tip Chlorophyll Gradient + subtle warm/cool patch variation
    float hCurve = smoothstep(0.04, 0.95, pow(vHeight, 0.85));
    vec3 lushShift = mix(vec3(0.92, 0.96, 0.85), vec3(1.08, 1.03, 0.92), fract(vBladeSeed * 11.7 + vColorVar));
    vec3 albedo = mix(uBaseColor, uTipColor, hCurve) * lushShift;

    // Subtle mid-rib vein highlight along the center of the blade (vRibbonU == 0)
    float midRib = 1.0 - smoothstep(0.0, 0.22, abs(vRibbonU));
    albedo = mix(albedo, uTipColor * 1.15, midRib * 0.18 * vHeight);

    // 2. Soil Root Ambient Occlusion & Self-Shadowing
    float rootAO = mix(0.24, 1.0, pow(clamp(vHeight, 0.0, 1.0), 0.68));
    float NdotL = dot(N, L);
    float wrapDiffuse = clamp((abs(NdotL) * 0.65 + max(0.0, L.y) * 0.55), 0.0, 1.0);

    // 3. Anisotropic Kajiya-Kay / Marschner Blade Specular Sheen
    vec3 tShifted = normalize(T - N * 0.14);
    vec3 H = normalize(L + V + vec3(1e-6));
    float dotTH = clamp(dot(tShifted, H), -1.0, 1.0);
    float sinTH = sqrt(max(1e-5, 1.0 - dotTH * dotTH));
    float exponent = mix(180.0, 12.0, clamp(uRoughness * uRoughness, 0.0, 1.0));
    float normFactor = (exponent + 2.0) / 8.0;
    float specLobe = pow(sinTH, exponent) * normFactor * 0.085 * uSpecular * (0.2 + 0.8 * vHeight);
    vec3 specColor = specLobe * uSunColor * mix(vec3(1.0), uTipColor, 0.35);

    // 4. Subsurface Chlorophyll Sun Translucency (TT Backlight Glow)
    float backScatter = pow(clamp(dot(V, -L + N * 0.35), 0.0, 1.0), 2.6);
    float edgeTranslucency = pow(1.0 - abs(dot(N, V)), 2.0);
    vec3 subSurface = (backScatter * 0.85 + edgeTranslucency * 0.45) *
      uRimIntensity * uTipColor * uSunColor * (0.3 + 0.7 * vHeight);

    // 5. Sky & Ground Hemisphere Ambient
    vec3 skyAmb = mix(vec3(0.28, 0.38, 0.32), vec3(0.65, 0.82, 0.92), 0.5 + 0.5 * N.y);
    vec3 ambient = albedo * skyAmb * 0.62 * rootAO;
    vec3 direct = (albedo * wrapDiffuse + specColor) * uSunColor * uSunIntensity * rootAO;

    gl_FragColor = vec4(ambient + direct + subSurface, 1.0);
  }
`;
