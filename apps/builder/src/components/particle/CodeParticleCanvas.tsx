/**
 * CodeParticleCanvas - Code Text Particle Effect
 *
 * Sand 모드를 기반으로 파티클을 랜덤한 코드 문자로 렌더링합니다.
 * - 각 파티클이 랜덤한 코드 문자(숫자, 영문, 기호)로 표시됨
 * - Sand 모드의 물리적 움직임과 모핑 효과 유지
 * - Three.js InstancedMesh + 문자 텍스처 아틀라스 사용
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { useParticleBackground } from "./useParticleBackground";
import { generatePointsFromContent, releaseWebGL } from "./canvasUtils";
import {
  PARTICLE_COUNT,
  MORPH_IN_SPEED,
  MORPH_OUT_SPEED,
  TRANSITION_SPEED,
  VORTEX_FADE_SPEED,
} from "./constants";
import { sandPreset } from "./presets";

// ==================== Constants ====================
const CODE_PARTICLE_COUNT = Math.min(PARTICLE_COUNT, 15000);
const TEXTURE_CHAR_SIZE = 24; // 텍스처 해상도

// 코드 문자셋 (프로그래밍 + 카타카나 + 한글 - Matrix 스타일)
// 한글: 자음(14) + 모음(10) + 조합글자
const KOREAN_CONSONANTS = "ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ";
const KOREAN_VOWELS = "ㅏㅓㅗㅜㅡㅣㅐㅔㅑㅕ";
const KOREAN_SYLLABLES = (() => {
  let result = "";
  for (const c of KOREAN_CONSONANTS) {
    for (const v of KOREAN_VOWELS) {
      // 초성(자음) + 중성(모음) 조합으로 한글 음절 생성
      const code = 0xac00 + (c.charCodeAt(0) - 0x3131) * 588 + (v.charCodeAt(0) - 0x314f) * 28;
      if (code >= 0xac00 && code <= 0xd7a3) {
        result += String.fromCharCode(code);
      }
    }
  }
  return result;
})();

// 일본어: 히라가나 + 카타카나
const HIRAGANA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";
const KATAKANA = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";

// 그리스 문자
const GREEK = "αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ";

// 키릴 문자 (러시아어)
const CYRILLIC = "абвгдежзийклмнопрстуфхцчшщъыьэюяАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";

// 수학 기호
const MATH_SYMBOLS = "∀∂∃∅∇∈∉∋∏∑√∝∞∠∧∨∩∪∫≈≠≡≤≥⊂⊃⊆⊇⊕⊗";

const CODE_CHARS =
  "0123456789" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "abcdefghijklmnopqrstuvwxyz" +
  "{}[]()<>+-*/=!?;:.,@#$%^&|~`_\\\"'" +
  HIRAGANA + KATAKANA +
  KOREAN_CONSONANTS + KOREAN_VOWELS + KOREAN_SYLLABLES +
  GREEK + CYRILLIC + MATH_SYMBOLS;

// ==================== Character Texture Atlas ====================
function createCodeCharacterAtlas(): THREE.CanvasTexture {
  const charsPerRow = 12;
  const rows = Math.ceil(CODE_CHARS.length / charsPerRow);
  const atlasWidth = charsPerRow * TEXTURE_CHAR_SIZE;
  const atlasHeight = rows * TEXTURE_CHAR_SIZE;

  const canvas = document.createElement("canvas");
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext("2d")!;

  // 배경 투명
  ctx.clearRect(0, 0, atlasWidth, atlasHeight);

  // 폰트 설정 - 코드 스타일 monospace
  ctx.font = `bold ${TEXTURE_CHAR_SIZE * 0.7}px "Fira Code", "Source Code Pro", "Consolas", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < CODE_CHARS.length; i++) {
    const col = i % charsPerRow;
    const row = Math.floor(i / charsPerRow);
    const x = col * TEXTURE_CHAR_SIZE + TEXTURE_CHAR_SIZE / 2;
    const y = row * TEXTURE_CHAR_SIZE + TEXTURE_CHAR_SIZE / 2;

    // 글로우 효과 (녹색/청록색 코드 느낌)
    ctx.shadowColor = "rgba(0, 255, 180, 0.8)";
    ctx.shadowBlur = 4;
    ctx.fillStyle = "#00ffaa";
    ctx.fillText(CODE_CHARS[i], x, y);

    // 더 선명하게 한번 더
    ctx.shadowBlur = 0;
    ctx.fillText(CODE_CHARS[i], x, y);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

// ==================== Vertex Shader ====================
const CODE_VERTEX_SHADER = `
  attribute float charIndex;
  attribute float random;
  attribute float heightLayer;
  attribute float particleSize;
  attribute float glowIntensity;
  attribute vec3 targetPos;
  attribute vec3 prevTargetPos;

  uniform float time;
  uniform float morphProgress;
  uniform float transitionProgress;

  // 부유/바람 설정
  uniform float primarySpeed;
  uniform float primaryDirection;
  uniform float lowLayerEffect;
  uniform float midLayerEffect;
  uniform float highLayerEffect;
  uniform float waveSpeed;
  uniform float waveScale;
  uniform float clusterStrength;
  uniform float clusterScale;

  // 형성 설정
  uniform float turbulence;
  uniform float gustStrength;
  uniform float gustFrequency;
  uniform float convergenceForce;
  uniform float formIntensityMultiplier;
  uniform float aliveBreathScale;
  uniform float vibrationScale;

  // 회오리 설정
  uniform float vortexActive;
  uniform vec2 vortexCenter;
  uniform float vortexStrength;
  uniform float vortexRadius;
  uniform float vortexHeight;
  uniform float rotationSpeed;
  uniform float spiralTightness;
  uniform float suctionStrength;
  uniform float liftForce;
  uniform float coreDensity;
  uniform float edgeDensity;
  uniform float tiltAmount;
  uniform float tiltDirection;
  uniform float maxVortexHeight;

  varying vec2 vUv;
  varying float vCharIndex;
  varying float vAlpha;
  varying float vMorphProgress;
  varying float vGlowIntensity;

  // 심플렉스 노이즈 함수
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vUv = uv;
    vCharIndex = charIndex;
    vMorphProgress = morphProgress;

    // 타겟 포지션 전환
    vec3 currentTarget = mix(prevTargetPos, targetPos, transitionProgress);
    vec3 pos = position;

    // ===== Curl Noise 스타일 플로우 효과 (sin/cos 근사 - 퍼포먼스 최적화) =====
    // CurlNoiseCanvas와 유사한 역동적인 움직임

    float layerEffect = mix(
      mix(lowLayerEffect, midLayerEffect, heightLayer),
      highLayerEffect,
      heightLayer * heightLayer
    );

    // Curl noise 근사: 발산 없는 벡터장 시뮬레이션
    // curl(f) = (df/dy, -df/dx) 패턴을 sin/cos로 근사
    float noiseScale = 0.008; // 노이즈 스케일
    float flowSpeed = time * 0.4; // 플로우 속도

    // 다층 curl 노이즈 근사 (3개 옥타브)
    float px1 = pos.x * noiseScale + flowSpeed;
    float py1 = pos.y * noiseScale + flowSpeed * 0.7;
    float pz1 = pos.z * noiseScale * 0.5;

    // 첫 번째 옥타브 (가장 큰 움직임)
    float curl1x = sin(py1 * 2.0 + pz1) * cos(px1 * 1.3) - sin(pz1 * 1.5 + px1) * cos(py1 * 0.8);
    float curl1y = sin(pz1 * 2.0 + px1) * cos(py1 * 1.3) - sin(px1 * 1.5 + py1) * cos(pz1 * 0.8);
    float curl1z = sin(px1 * 2.0 + py1) * cos(pz1 * 1.3) - sin(py1 * 1.5 + pz1) * cos(px1 * 0.8);

    // 두 번째 옥타브 (중간 디테일)
    float px2 = pos.x * noiseScale * 2.0 + flowSpeed * 1.3;
    float py2 = pos.y * noiseScale * 2.0 + flowSpeed * 0.9;
    float curl2x = sin(py2 * 2.5 + random * 3.0) * cos(px2 * 1.8) * 0.5;
    float curl2y = sin(px2 * 2.5 + random * 2.0) * cos(py2 * 1.8) * 0.5;

    // 세 번째 옥타브 (미세 디테일)
    float px3 = pos.x * noiseScale * 4.0 + flowSpeed * 2.0;
    float py3 = pos.y * noiseScale * 4.0 + flowSpeed * 1.5;
    float curl3x = sin(py3 * 3.0) * cos(px3 * 2.5) * 0.25;
    float curl3y = sin(px3 * 3.0) * cos(py3 * 2.5) * 0.25;

    // 합성된 curl 벡터
    vec3 curlFlow = vec3(
      curl1x + curl2x + curl3x,
      curl1y + curl2y + curl3y,
      curl1z * 0.3 // z축은 약하게
    );

    // 플로우 강도 (CurlNoiseCanvas의 flowStrength = 25.0 참고)
    float flowStrength = 20.0 * (0.6 + heightLayer * 0.4); // 높이에 따라 다르게
    vec3 flowOffset = normalize(curlFlow + vec3(0.001)) * flowStrength;

    // Float 움직임 (CurlNoiseCanvas 스타일 - 더 강한 amplitude)
    float floatPhase = time * 0.3 + random * 6.28;
    float floatY = sin(floatPhase) * 8.0; // Y축 amplitude 8.0
    float floatX = cos(time * 0.2 + random * 4.0) * 6.0; // X축 amplitude 6.0
    float floatZ = sin(time * 0.15 + random * 5.0) * 4.0; // Z축 amplitude 4.0
    vec3 floatOffset = vec3(floatX, floatY, floatZ);

    // 큰 파동 (추가적인 물결 효과)
    float wavePhase = pos.x * waveScale * 50.0 + pos.y * waveScale * 30.0 + time * waveSpeed;
    float wave = (sin(wavePhase) + cos(wavePhase * 0.7)) * 0.5 * layerEffect * 5.0;

    // 군집 효과 (파티클 그룹핑)
    float clusterPhase = pos.x * clusterScale * 80.0 + pos.y * clusterScale * 60.0 + time * 0.15 + random * 10.0;
    float cluster = sin(clusterPhase) * clusterStrength * 1.5;

    // 모핑 시 drift 효과 감소 (형태 정확도 유지)
    float driftReduction = 1.0 - morphProgress * morphProgress * 0.95; // 모핑 시 95% 감소

    // 최종 드리프트: curl flow + float + wave + cluster (모핑 시 약화)
    vec3 driftOffset = (flowOffset + floatOffset + vec3(wave, cluster, 0.0)) * driftReduction;

    // ===== 형성/모핑 효과 =====
    float formIntensity = morphProgress * formIntensityMultiplier;

    vec3 toTarget = currentTarget - pos;
    float dist = length(toTarget);
    vec3 dir = normalize(toTarget + vec3(0.001));

    // 거리 기반 수렴 (강화: 더 강한 수렴력)
    float pullStrength = convergenceForce * formIntensity * (1.0 + dist * 0.02);
    vec3 convergence = dir * pullStrength * 25.0; // 15.0 → 25.0 증가

    // 형태 정확도를 위한 추가 보정력 (morphProgress가 높을수록 타겟에 강하게 끌림)
    float accuracyBoost = morphProgress * morphProgress * morphProgress; // 3차 곡선
    vec3 accuracyCorrection = toTarget * accuracyBoost * 0.15;

    // 난류 (sin 기반 근사 - 퍼포먼스 최적화) - 형태 유지 시 약화
    float turbReduction = 1.0 - morphProgress * 0.8; // 모핑 시 80% 감소
    float turbPhase = pos.x * 0.02 + pos.y * 0.015 + time * 0.3 + random * 6.28;
    float turbNoise = sin(turbPhase) * cos(turbPhase * 1.3) * turbulence * formIntensity * turbReduction;
    vec3 turbulenceOffset = vec3(turbNoise, turbNoise * 0.8, turbNoise * 0.5);

    // 돌풍 - 형태 유지 시 약화
    float gustPhase = time * gustFrequency + random * 6.28;
    float gustMask = smoothstep(0.7, 1.0, sin(gustPhase));
    vec3 gustOffset = vec3(
      sin(gustPhase * 2.3) * gustStrength,
      cos(gustPhase * 1.7) * gustStrength * 0.6,
      0.0
    ) * gustMask * formIntensity * 0.3 * turbReduction;

    // 숨쉬는 효과 - 형태 유지 시 약화
    float breath = sin(time * 1.5 + random * 6.28) * aliveBreathScale * morphProgress * (1.0 - morphProgress * 0.7);
    vec3 breathOffset = dir * breath;

    // 미세 진동 (sin 기반 근사 - 퍼포먼스 최적화) - 형태 유지 시 약화
    float vibPhaseX = pos.x * 0.1 + pos.y * 0.08 + time * 3.0;
    float vibPhaseY = pos.x * 0.08 + pos.y * 0.1 + time * 3.0 + 1.57;
    vec3 vibration = vec3(
      sin(vibPhaseX) * cos(vibPhaseX * 0.5),
      sin(vibPhaseY) * cos(vibPhaseY * 0.5),
      0.0
    ) * vibrationScale * morphProgress * turbReduction;

    // ===== 회오리 효과 =====
    vec3 vortexOffset = vec3(0.0);
    if (vortexActive > 0.5 && vortexStrength > 0.01) {
      vec2 toVortex = pos.xy - vortexCenter;
      float vDist = length(toVortex);

      float influence = smoothstep(vortexRadius * 1.5, 0.0, vDist);
      influence *= vortexStrength;

      float angle = atan(toVortex.y, toVortex.x);
      float rotAngle = angle + time * rotationSpeed * (1.0 + (1.0 - vDist / vortexRadius) * 2.0);

      float spiralR = vDist * (1.0 - influence * spiralTightness);
      vec2 rotatedPos = vec2(cos(rotAngle), sin(rotAngle)) * spiralR;

      vec2 suctionDir = -normalize(toVortex + vec2(0.001));
      float suctionForce = suctionStrength * influence * (1.0 - vDist / vortexRadius);

      float heightProgress = vDist / vortexRadius;
      float targetHeight = vortexHeight * (1.0 - heightProgress * heightProgress);
      float currentLift = (targetHeight - pos.z) * liftForce * influence;

      float tiltOffset = sin(angle + tiltDirection) * tiltAmount * vortexHeight * influence;

      vortexOffset = vec3(
        (rotatedPos.x - toVortex.x) * influence + suctionDir.x * suctionForce,
        (rotatedPos.y - toVortex.y) * influence + suctionDir.y * suctionForce,
        currentLift + tiltOffset
      );
    }

    // ===== 최종 위치 =====
    vec3 alivePos = pos + driftOffset;

    // 형태 유지: morphProgress가 높을수록 정확히 타겟 위치로
    // 살아있는 느낌의 미세 진동 (형태 유지하면서 움직임 부여)
    float vibX = sin(time * 2.5 + random * 6.28) * 1.5;
    float vibY = cos(time * 2.0 + random * 5.0) * 1.2;
    float vibZ = sin(time * 1.5 + random * 4.0) * 0.8;
    vec3 formedPos = currentTarget + vec3(vibX, vibY, vibZ);

    // 단순 블렌딩: morphProgress에 따라 alivePos → formedPos
    vec3 blendedPos = mix(alivePos, formedPos, morphProgress);

    // 회오리 효과만 추가 (모핑 중에도 적용)
    blendedPos += vortexOffset;

    // ===== 알파 계산 =====
    float baseAlpha = mix(0.7, 0.4, heightLayer);
    float morphAlpha = 1.0 - morphProgress * 0.2;
    float distAlpha = smoothstep(300.0, 0.0, dist) * morphProgress + (1.0 - morphProgress);
    vAlpha = baseAlpha * morphAlpha * distAlpha;

    // ===== 포인트 크기 =====
    vec4 mvPosition = modelViewMatrix * vec4(blendedPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // 문자 크기 조정
    float sizeMod = 1.0 + morphProgress * 0.3;
    gl_PointSize = particleSize * sizeMod * (200.0 / -mvPosition.z);

    // ===== 실시간 원근감 기반 발광 강도 =====
    // 카메라 거리 기반: 가까울수록 밝게 (mvPosition.z가 작을수록 가까움)
    // mvPosition.z 범위: 약 -250 ~ -150 (카메라 z=200 기준)
    float depthNormalized = clamp((-mvPosition.z - 150.0) / 100.0, 0.0, 1.0); // 0(가까이) ~ 1(멀리)
    float depthFactor = 1.0 - depthNormalized; // 0(멀리) ~ 1(가까이)

    // ===== 시간 기반 랜덤 발광 (sin 기반 근사 - 퍼포먼스 최적화) =====
    // 각 파티클마다 다른 타이밍으로 발광 (random 값을 시드로 사용)
    float glowPhase1 = random * 50.0 + time * 0.5;
    float glowPhase2 = random * 30.0 + time * 0.3;
    float glowNoise = sin(glowPhase1) * cos(glowPhase2) + sin(glowPhase1 * 0.7) * 0.5; // -1.5 ~ 1.5
    float glowThreshold = 0.9; // 상위 20% 발광 (glowNoise 범위 -1.5~1.5, 총 3.0 중 0.6)

    // 발광 여부 결정 (시간에 따라 변함)
    bool isGlowing = glowNoise > glowThreshold;

    if (isGlowing) {
      // 발광 파티클: 가까우면 더 밝게 (1.5 ~ 3.0)
      float glowStrength = (glowNoise - glowThreshold) / (1.5 - glowThreshold); // 0 ~ 1
      vGlowIntensity = (1.5 + depthFactor * 1.5) * (0.7 + glowStrength * 0.3);
    } else {
      // 일반 파티클: 가까우면 0.5, 멀면 0.15
      vGlowIntensity = 0.15 + depthFactor * 0.35;
    }
  }
`;

// ==================== Fragment Shader ====================
const CODE_FRAGMENT_SHADER = `
  uniform sampler2D charAtlas;
  uniform float charsPerRow;
  uniform float charRows;
  uniform float time;

  uniform vec3 colorPrimary;
  uniform vec3 colorSecondary;
  uniform vec3 morphColorTint;

  varying vec2 vUv;
  varying float vCharIndex;
  varying float vAlpha;
  varying float vMorphProgress;
  varying float vGlowIntensity;

  void main() {
    // 포인트 UV 계산
    vec2 pointUV = gl_PointCoord;

    // 아틀라스에서 문자 UV 계산
    float charIdx = floor(vCharIndex);
    float col = mod(charIdx, charsPerRow);
    float row = floor(charIdx / charsPerRow);

    vec2 charUV = vec2(
      (col + pointUV.x) / charsPerRow,
      (row + (1.0 - pointUV.y)) / charRows
    );

    vec4 texColor = texture2D(charAtlas, charUV);

    // 색상 계산 - 녹색/청록색 코드 느낌
    vec3 baseColor = mix(colorPrimary, colorSecondary, pointUV.y * 0.5 + 0.25);

    // 모핑 시 색상 틴트
    baseColor = mix(baseColor, baseColor + morphColorTint, vMorphProgress * 0.5);

    // 깜빡임 효과
    float flicker = 0.9 + 0.1 * sin(time * 8.0 + vCharIndex * 1.5);
    baseColor *= flicker;

    // 발광 파티클: 밝기 증폭 (bloom threshold를 넘어 발광 효과 발생)
    // vGlowIntensity가 높을수록 더 밝게 (1.0 = 일반, 2.0+ = 발광)
    baseColor *= vGlowIntensity;

    // 최종 알파
    float alpha = texColor.a * vAlpha;

    if (alpha < 0.05) discard;

    gl_FragColor = vec4(baseColor, alpha);
  }
`;

// ==================== Component Props ====================
interface CodeParticleCanvasProps {
  afterImageDamp?: number;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
}

// ==================== Component ====================
export function CodeParticleCanvas({
  afterImageDamp = 0.5,
  bloomStrength = 0.6,
  bloomRadius = 0.5,
  bloomThreshold = 0.4,
}: CodeParticleCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const { targetMorphRef, contentRef, contentVersion, vortexRef } =
    useParticleBackground();
  // 마운트 시 현재 targetMorphRef 값으로 초기화 (효과 모드 전환 시 형태 유지)
  const morphProgressRef = useRef(0);
  const transitionProgressRef = useRef(1);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);

  // 마운트 시 targetMorphRef 값으로 morphProgressRef 동기화
  useEffect(() => {
    morphProgressRef.current = targetMorphRef.current;
  }, [targetMorphRef]);

  const preset = sandPreset; // Sand 모드 기반

  // Content 변경 시 타겟 포지션 업데이트
  useEffect(() => {
    const geometry = geometryRef.current;
    if (!geometry) return;

    const currentTargetPos = geometry.getAttribute("targetPos");
    if (currentTargetPos) {
      geometry.setAttribute(
        "prevTargetPos",
        new THREE.BufferAttribute(new Float32Array(currentTargetPos.array), 3)
      );
    }

    geometry.setAttribute(
      "targetPos",
      new THREE.BufferAttribute(
        generatePointsFromContent(contentRef.current),
        3
      )
    );

    // 형태 간 전환: transitionProgress를 0으로 리셋하여 부드러운 이동 애니메이션
    // (prevTargetPos에서 새 targetPos로 자연스럽게 전환)
    transitionProgressRef.current = 0;
  }, [contentVersion, contentRef]);

  // Three.js 초기화 및 애니메이션
  useEffect(() => {
    if (!mountRef.current) return;

    const mountElement = mountRef.current;

    // Scene 설정
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 200);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountElement.appendChild(renderer.domElement);

    // 문자 아틀라스 생성
    const charAtlas = createCodeCharacterAtlas();
    const charsPerRow = 12;
    const charRows = Math.ceil(CODE_CHARS.length / charsPerRow);

    // Geometry 생성
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(CODE_PARTICLE_COUNT * 3);
    const charIndices = new Float32Array(CODE_PARTICLE_COUNT);
    const randoms = new Float32Array(CODE_PARTICLE_COUNT);
    const heightLayers = new Float32Array(CODE_PARTICLE_COUNT);
    const particleSizes = new Float32Array(CODE_PARTICLE_COUNT);
    const glowIntensities = new Float32Array(CODE_PARTICLE_COUNT);

    // 발광 파티클 비율 (15%)
    const GLOW_PROBABILITY = 0.15;

    for (let i = 0; i < CODE_PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      positions[i3] = (Math.random() - 0.5) * 550;
      positions[i3 + 1] = (Math.random() - 0.5) * 380;
      positions[i3 + 2] = (Math.random() - 0.5) * 100;

      // 랜덤 문자 인덱스
      charIndices[i] = Math.floor(Math.random() * CODE_CHARS.length);

      randoms[i] = Math.random();

      const heightRandom = Math.random();
      heightLayers[i] = heightRandom * heightRandom;

      const baseSize = 12 + Math.random() * 8; // 목표: 8px~24px, 평균 16px
      particleSizes[i] = baseSize * (1.0 - heightLayers[i] * 0.3);

      // 발광 여부 플래그: 15% 확률로 발광 파티클 (1.0 이상), 나머지는 일반 (1.0 미만)
      // 실제 밝기는 Vertex Shader에서 실시간 원근감 기반으로 계산
      if (Math.random() < GLOW_PROBABILITY) {
        glowIntensities[i] = 1.0; // 발광 파티클 플래그
      } else {
        glowIntensities[i] = 0.0; // 일반 파티클 플래그
      }
    }

    const initialPoints = generatePointsFromContent(contentRef.current);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("charIndex", new THREE.BufferAttribute(charIndices, 1));
    geometry.setAttribute("random", new THREE.BufferAttribute(randoms, 1));
    geometry.setAttribute("heightLayer", new THREE.BufferAttribute(heightLayers, 1));
    geometry.setAttribute("particleSize", new THREE.BufferAttribute(particleSizes, 1));
    geometry.setAttribute("glowIntensity", new THREE.BufferAttribute(glowIntensities, 1));
    geometry.setAttribute("targetPos", new THREE.BufferAttribute(initialPoints, 3));
    geometry.setAttribute(
      "prevTargetPos",
      new THREE.BufferAttribute(new Float32Array(initialPoints), 3)
    );
    geometryRef.current = geometry;

    // 코드 스타일 색상 (녹색/청록색)
    const colorPrimary = new THREE.Vector3(0.0, 1.0, 0.7); // 청록색
    const colorSecondary = new THREE.Vector3(0.0, 0.8, 0.5); // 진한 청록
    const morphColorTint = new THREE.Vector3(0.1, 0.2, 0.1); // 녹색 틴트

    const tweaks = preset.shaderTweaks ?? {};

    // Material 생성
    const material = new THREE.ShaderMaterial({
      uniforms: {
        charAtlas: { value: charAtlas },
        charsPerRow: { value: charsPerRow },
        charRows: { value: charRows },
        time: { value: 0 },
        morphProgress: { value: morphProgressRef.current }, // 현재 값으로 초기화 (모드 전환 시 형태 유지)
        transitionProgress: { value: transitionProgressRef.current },

        // 색상
        colorPrimary: { value: colorPrimary },
        colorSecondary: { value: colorSecondary },
        morphColorTint: { value: morphColorTint },

        // 회오리 상태
        vortexActive: { value: 0 },
        vortexCenter: { value: new THREE.Vector2(0, 0) },
        vortexStrength: { value: 0 },
        vortexRadius: { value: preset.vortex.minRadius },
        vortexHeight: { value: 0 },

        // 부유/바람 설정
        primarySpeed: { value: preset.drift.primarySpeed },
        primaryDirection: { value: preset.drift.primaryDirection },
        lowLayerEffect: { value: preset.drift.lowLayerEffect },
        midLayerEffect: { value: preset.drift.midLayerEffect },
        highLayerEffect: { value: preset.drift.highLayerEffect },
        waveSpeed: { value: preset.drift.waveSpeed },
        waveScale: { value: preset.drift.waveScale },
        clusterStrength: { value: preset.drift.clusterStrength },
        clusterScale: { value: preset.drift.clusterScale },

        // 형성 설정
        turbulence: { value: preset.form.turbulence },
        gustStrength: { value: preset.form.gustStrength },
        gustFrequency: { value: preset.form.gustFrequency },
        convergenceForce: { value: preset.form.convergenceForce },

        // 회오리 설정
        rotationSpeed: { value: preset.vortex.rotationSpeed },
        spiralTightness: { value: preset.vortex.spiralTightness },
        suctionStrength: { value: preset.vortex.suctionStrength },
        liftForce: { value: preset.vortex.liftForce },
        coreDensity: { value: preset.vortex.coreDensity },
        edgeDensity: { value: preset.vortex.edgeDensity },
        tiltAmount: { value: preset.vortex.tiltAmount },
        tiltDirection: { value: preset.vortex.tiltDirection },
        maxVortexHeight: { value: preset.vortex.maxHeight },

        // 테마별 조정
        formIntensityMultiplier: { value: tweaks.formIntensityMultiplier ?? 4.0 },
        aliveBreathScale: { value: tweaks.aliveBreathScale ?? 2.5 },
        vibrationScale: { value: tweaks.vibrationScale ?? 0.7 },
      },
      vertexShader: CODE_VERTEX_SHADER,
      fragmentShader: CODE_FRAGMENT_SHADER,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    scene.add(new THREE.Points(geometry, material));

    // ==================== Post-processing ====================
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new AfterimagePass(afterImageDamp));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloomStrength,
      bloomRadius,
      bloomThreshold
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    // 문자 변경 타이머 (주기 늘림 - 퍼포먼스 최적화)
    const charChangeTimers = new Float32Array(CODE_PARTICLE_COUNT);
    for (let i = 0; i < CODE_PARTICLE_COUNT; i++) {
      charChangeTimers[i] = Math.random() * 180; // 초기 지연 분산
    }

    // 애니메이션 루프
    const timer = new THREE.Timer();
    let animationFrameId: number;

    const vortexFadeMultiplier = tweaks.vortexFadeMultiplier ?? 160;

    const animate = () => {
      timer.update();
      const delta = timer.getDelta();
      material.uniforms.time.value += delta;

      // 모핑 진행도
      const morphSpeed =
        targetMorphRef.current > morphProgressRef.current
          ? MORPH_IN_SPEED
          : MORPH_OUT_SPEED;
      morphProgressRef.current +=
        (targetMorphRef.current - morphProgressRef.current) * morphSpeed;
      material.uniforms.morphProgress.value = morphProgressRef.current;

      // 전환 진행도
      transitionProgressRef.current +=
        (1 - transitionProgressRef.current) * TRANSITION_SPEED;
      material.uniforms.transitionProgress.value = transitionProgressRef.current;

      // 회오리 상태 업데이트
      const vortex = vortexRef.current;

      if (!vortex.active && vortex.strength > 0) {
        vortex.strength = Math.max(0, vortex.strength - VORTEX_FADE_SPEED);
        vortex.radius = preset.vortex.minRadius + vortex.strength * vortexFadeMultiplier;
        vortex.height = vortex.strength * preset.vortex.maxHeight;
      }

      material.uniforms.vortexActive.value = vortex.strength > 0.01 ? 1 : 0;
      material.uniforms.vortexCenter.value.set(vortex.x, vortex.y);
      material.uniforms.vortexStrength.value = vortex.strength;
      material.uniforms.vortexRadius.value = vortex.radius;
      material.uniforms.vortexHeight.value = vortex.height;

      // 문자 랜덤 변경 (코드 깜빡임 효과) - 주기 늘림 & 배치 처리로 퍼포먼스 최적화
      const charAttr = geometry.getAttribute("charIndex") as THREE.BufferAttribute;
      let needsUpdate = false;
      const batchSize = Math.ceil(CODE_PARTICLE_COUNT / 10); // 10% 씩만 체크
      const startIdx = Math.floor(Math.random() * CODE_PARTICLE_COUNT);

      for (let j = 0; j < batchSize; j++) {
        const i = (startIdx + j) % CODE_PARTICLE_COUNT;
        charChangeTimers[i] -= delta * 60 * 10; // 10배 빠르게 감소 (배치 보정)
        if (charChangeTimers[i] <= 0) {
          charAttr.array[i] = Math.floor(Math.random() * CODE_CHARS.length);
          charChangeTimers[i] = 120 + Math.random() * 180; // 2~5초마다 변경 (기존 0.5~1.5초)
          needsUpdate = true;
        }
      }
      if (needsUpdate) {
        charAttr.needsUpdate = true;
      }

      composer.render();
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    // 리사이즈 핸들러
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
      bloomPass.resolution.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // Cleanup
    return () => {
      geometryRef.current = null;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
      mountElement.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      charAtlas.dispose();
      releaseWebGL(renderer, composer);
    };
  }, [
    targetMorphRef,
    contentRef,
    vortexRef,
    preset,
    afterImageDamp,
    bloomStrength,
    bloomRadius,
    bloomThreshold,
  ]);

  return (
    <div
      ref={mountRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
      }}
    />
  );
}
