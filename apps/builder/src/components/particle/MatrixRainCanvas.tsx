/**
 * MatrixRainCanvas - Matrix Digital Rain Effect (Enhanced)
 *
 * 영화 《매트릭스》의 인트로에서 등장하는 디지털 비(Digital Rain) 효과
 * - InstancedMesh + PlaneGeometry로 선명한 문자 렌더링
 * - 실제 3D 깊이감과 원근감
 * - 호버 시 문자들이 형태 위에서 충돌하여 흘러내리는 효과
 * - Three.js InstancedMesh 기반 고성능 렌더링
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { useParticleBackground } from "./useParticleBackground";
import { generatePointsFromContent, releaseWebGL } from "./canvasUtils";
import { PARTICLE_COUNT, MORPH_IN_SPEED, MORPH_OUT_SPEED } from "./constants";

// ==================== Constants ====================
const CHAR_COUNT = Math.min(PARTICLE_COUNT, 20000); // 100열을 위해 20000개로 증가
const COLUMN_COUNT = 100;
const CHARS_PER_COLUMN_MIN = 168; // 한 열당 최소 문자 개수
const CHARS_PER_COLUMN_MAX = 200; // 한 열당 최대 문자 개수
const CHAR_SIZE_MIN = 0.6; // 최소 크기
const CHAR_SIZE_MAX = 2.0; // 최대 크기
const TEXTURE_CHAR_SIZE = 128; // 텍스처 해상도
const DEPTH_RANGE = 150; // Z축 깊이 범위
const DEPTH_SPEED_MULTIPLIER = 2.0; // 가까운 것(작은 depth)이 더 빨리 내려오는 배율
const CHAR_SPAWN_INTERVAL = 0.05; // 문자 생성 간격 (초)
const TAIL_LENGTH_MIN = 168; // 꼬리 최소 길이
const TAIL_LENGTH_MAX = 198; // 꼬리 최대 길이

// 매트릭스 문자셋 (Code 모드와 동일)
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

const MATRIX_CHARS =
  "0123456789" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "abcdefghijklmnopqrstuvwxyz" +
  "{}[]()<>+-*/=!?;:.,@#$%^&|~`_\\\"'" +
  HIRAGANA + KATAKANA +
  KOREAN_CONSONANTS + KOREAN_VOWELS + KOREAN_SYLLABLES +
  GREEK + CYRILLIC + MATH_SYMBOLS;

// ==================== Character Texture Atlas ====================
function createCharacterAtlas(): THREE.CanvasTexture {
  const charsPerRow = 12;
  const rows = Math.ceil(MATRIX_CHARS.length / charsPerRow);
  const atlasWidth = charsPerRow * TEXTURE_CHAR_SIZE;
  const atlasHeight = rows * TEXTURE_CHAR_SIZE;

  const canvas = document.createElement("canvas");
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext("2d")!;

  // 배경 투명
  ctx.clearRect(0, 0, atlasWidth, atlasHeight);

  // 폰트 설정 - 선명한 렌더링
  ctx.font = `bold ${
    TEXTURE_CHAR_SIZE * 0.75
  }px "MS Gothic", "Meiryo", "Hiragino Kaku Gothic Pro", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < MATRIX_CHARS.length; i++) {
    const col = i % charsPerRow;
    const row = Math.floor(i / charsPerRow);
    const x = col * TEXTURE_CHAR_SIZE + TEXTURE_CHAR_SIZE / 2;
    const y = row * TEXTURE_CHAR_SIZE + TEXTURE_CHAR_SIZE / 2;

    // 글로우 효과
    ctx.shadowColor = "rgba(0, 255, 100, 1)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#00ff66";
    ctx.fillText(MATRIX_CHARS[i], x, y);

    // 더 선명하게 한번 더
    ctx.shadowBlur = 0;
    ctx.fillText(MATRIX_CHARS[i], x, y);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

// ==================== Vertex Shader for Instanced Mesh ====================
const MATRIX_INSTANCE_VERTEX = `
  attribute vec3 instancePosition;
  attribute float instanceCharIndex;
  attribute float instanceBrightness;
  attribute float instanceDepth;
  attribute float instanceSpeed;
  attribute float instanceSize;
  attribute float instanceSpawnTime;

  uniform float time;
  uniform float morphProgress;
  uniform sampler2D targetPositions;
  uniform vec2 targetSize;
  uniform float screenHeight;
  uniform float depthSpeedMultiplier;
  uniform float mouseWorldX;
  uniform float mouseWorldY;
  uniform float mouseActive;

  // 회피 상수 (범위 1/2로 축소)
  const float AVOID_RADIUS = 18.0;      // 회피 시작 반경
  const float AVOID_STRENGTH = 15.0;    // 최대 밀림 거리
  const float RETURN_DISTANCE = 30.0;   // 복귀 시작 거리

  varying vec2 vUv;
  varying float vBrightness;
  varying float vCharIndex;
  varying float vDepth;
  varying float vCollision;
  varying float vVisible;

  void main() {
    vUv = uv;
    vCharIndex = instanceCharIndex;
    vDepth = instanceDepth;

    // 스폰 시간 체크: 아직 생성되지 않은 문자는 숨김
    float spawnProgress = step(instanceSpawnTime, time);
    vVisible = spawnProgress;

    // 아직 스폰되지 않은 경우 화면 밖으로 이동
    if (spawnProgress < 0.5) {
      gl_Position = vec4(0.0, 0.0, -1000.0, 1.0);
      vBrightness = 0.0;
      vCollision = 0.0;
      return;
    }

    vec3 pos = instancePosition;

    // Matrix 모드: 회오리 효과 비활성화
    float vortexEffect = 0.0;

    // 타겟 위치 가져오기 (충돌 검사용)
    float instanceId = float(gl_InstanceID);
    vec2 targetUV = vec2(mod(instanceId, targetSize.x) / targetSize.x,
                         floor(instanceId / targetSize.x) / targetSize.y);
    vec4 targetData = texture2D(targetPositions, targetUV);
    vec3 targetPos = targetData.xyz;

    // 충돌 검사: 문자가 타겟 형태 근처에 있는지
    float distToTarget = length(pos.xy - targetPos.xy);
    float collisionRadius = 8.0;
    float collision = smoothstep(collisionRadius, 0.0, distToTarget) * morphProgress;
    vCollision = max(collision, vortexEffect); // 회오리 효과도 collision으로 전달

    // 충돌 시: 타겟 위치에서 잠시 머물다가 옆으로 흘러내림
    if (collision > 0.1) {
      // 타겟 위치로 끌어당김
      pos.xy = mix(pos.xy, targetPos.xy, collision * 0.8);
      // 깊이 기반 속도 조정: 가까운 것(작은 depth)이 더 빨리 내려옴
      float depthSpeedFactor = 1.0 + (1.0 - instanceDepth) * depthSpeedMultiplier;
      pos.y -= collision * time * instanceSpeed * depthSpeedFactor * 0.3;
      // 약간 옆으로 흘러내림
      pos.x += sin(time * 2.0 + float(gl_InstanceID) * 0.1) * collision * 2.0;
    }

    // 깊이에 따른 스케일 (원근감)
    float depthScale = 1.0 - instanceDepth * 0.4;

    // ========== 마우스 회피 효과 ==========
    // 마우스와의 거리 계산
    float distToMouseX = pos.x - mouseWorldX;
    float distToMouseY = pos.y - mouseWorldY;
    float distToMouse = length(vec2(distToMouseX, distToMouseY));

    // 회피 효과 계산 (마우스 활성화 시에만)
    float avoidOffset = 0.0;
    if (mouseActive > 0.5) {
      // X 방향 회피 강도 (마우스에 가까울수록 강함)
      float xProximity = 1.0 - smoothstep(0.0, AVOID_RADIUS, abs(distToMouseX));

      // Y 위치에 따른 회피 강도 조절
      float yFactor = 0.0;
      if (distToMouseY > 0.0) {
        // 마우스 위: 접근하면서 회피 시작 (부드럽게)
        yFactor = smoothstep(AVOID_RADIUS * 2.0, 0.0, distToMouseY);
      } else {
        // 마우스 아래: 점진적 복귀
        yFactor = smoothstep(-RETURN_DISTANCE, 0.0, distToMouseY);
      }

      // 밀림 방향 결정 (마우스 반대 방향)
      float pushDir = sign(distToMouseX);
      // 마우스 바로 위/아래면 인스턴스 ID 기반 방향
      if (abs(distToMouseX) < 3.0) {
        pushDir = (mod(float(gl_InstanceID), 2.0) * 2.0 - 1.0);
      }

      // 최종 회피량 계산
      avoidOffset = pushDir * xProximity * yFactor * AVOID_STRENGTH;
    }

    // 회피 오프셋 적용
    pos.x += avoidOffset;

    // 마우스 근처 문자 밝기 증가 효과 (회피 중인 문자)
    float mouseGlow = smoothstep(AVOID_RADIUS * 1.5, 0.0, distToMouse) * mouseActive * 0.3;

    // 랜덤 크기 적용 (마우스 크기 효과 제거, 회피로 대체)
    float finalSize = instanceSize * depthScale;

    // 스폰된 이후 경과 시간 기반 밝기 계산
    // 방금 스폰됨 = 1.0 (머리, 가장 밝음)
    // 시간이 지남 = 점점 어두워짐 (꼬리)
    float age = time - instanceSpawnTime;
    float fadeTime = 8.0; // 완전히 어두워지는데 걸리는 시간 (초)
    float ageBrightness = max(0.05, 1.0 - age / fadeTime);

    // 밝기: 스폰 경과 시간 + 깊이 보정
    vBrightness = ageBrightness * (1.0 - instanceDepth * 0.3);

    // 충돌/회오리 시 더 밝게
    vBrightness += vCollision * 0.5;

    // 마우스 근처 회피 중인 문자 밝기 증가
    vBrightness += mouseGlow;

    // 인스턴스 위치에 로컬 버텍스 추가 (랜덤 크기 적용)
    vec3 transformed = position * finalSize + pos;

    // Billboard: 항상 카메라를 향하도록
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    mvPosition.xyz += position * finalSize;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

// ==================== Fragment Shader ====================
const MATRIX_INSTANCE_FRAGMENT = `
  uniform sampler2D charAtlas;
  uniform float charsPerRow;
  uniform float charRows;
  uniform float time;

  varying vec2 vUv;
  varying float vBrightness;
  varying float vCharIndex;
  varying float vDepth;
  varying float vCollision;
  varying float vVisible;

  void main() {
    // 아직 스폰되지 않은 문자는 렌더링하지 않음
    if (vVisible < 0.5) discard;
    // 아틀라스에서 문자 UV 계산
    float charIdx = floor(vCharIndex);
    float col = mod(charIdx, charsPerRow);
    float row = floor(charIdx / charsPerRow);

    vec2 charUV = vec2(
      (col + vUv.x) / charsPerRow,
      (row + (1.0 - vUv.y)) / charRows
    );

    vec4 texColor = texture2D(charAtlas, charUV);

    // 녹색 색상
    vec3 baseGreen = vec3(0.0, 1.0, 0.4);
    vec3 brightGreen = vec3(0.5, 1.0, 0.6);
    vec3 headWhite = vec3(0.9, 1.0, 0.95);

    // 밝기에 따른 색상
    vec3 color;
    if (vBrightness > 0.9) {
      // 머리: 흰색
      color = mix(brightGreen, headWhite, (vBrightness - 0.9) * 10.0);
    } else {
      // 꼬리: 녹색 그라데이션
      color = mix(baseGreen * 0.3, brightGreen, vBrightness);
    }

    // 충돌 시 더 밝은 색상
    color = mix(color, headWhite, vCollision * 0.5);

    // 깜빡임 효과
    float flicker = 0.9 + 0.1 * sin(time * 10.0 + vCharIndex * 2.5);
    color *= flicker;

    // 깊이에 따른 안개 효과
    float fog = 1.0 - vDepth * 0.3;
    color *= fog;

    // 알파
    float alpha = texColor.a * vBrightness;

    // 충돌 시 더 강한 알파
    alpha = mix(alpha, min(alpha * 1.5, 1.0), vCollision);

    if (alpha < 0.05) discard;

    gl_FragColor = vec4(color, alpha);
  }
`;

// ==================== Component Props ====================
interface MatrixRainCanvasProps {
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  speedMultiplier?: number;
}

// ==================== Component ====================
export function MatrixRainCanvas({
  bloomStrength = 1.2,
  bloomRadius = 0.8,
  bloomThreshold = 0.1,
  speedMultiplier = 1.0,
}: MatrixRainCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const { targetMorphRef, contentRef, contentVersion } =
    useParticleBackground();
  const morphProgressRef = useRef(0);
  const targetTextureRef = useRef<THREE.DataTexture | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  // 타겟 위치 업데이트
  useEffect(() => {
    if (!targetTextureRef.current) return;

    const targetPoints = generatePointsFromContent(contentRef.current);
    const textureSize = Math.ceil(Math.sqrt(CHAR_COUNT));
    const data = new Float32Array(textureSize * textureSize * 4);

    for (let i = 0; i < CHAR_COUNT; i++) {
      const i3 = i * 3;
      const i4 = i * 4;
      data[i4] = targetPoints[i3] || 0;
      data[i4 + 1] = targetPoints[i3 + 1] || 0;
      data[i4 + 2] = targetPoints[i3 + 2] || 0;
      data[i4 + 3] = 1;
    }

    const imageData = targetTextureRef.current.image?.data;
    if (imageData) {
      imageData.set(data);
      targetTextureRef.current.needsUpdate = true;
    }
  }, [contentVersion, contentRef]);

  useEffect(() => {
    if (!mountRef.current) return;

    const mountElement = mountRef.current;

    // ========== Scene Setup ==========
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    // 안개 효과로 깊이감 강화
    scene.fog = new THREE.Fog(0x000000, 100, 400);

    const camera = new THREE.PerspectiveCamera(
      75, // 넓은 FOV로 원근감 강화
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 100);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountElement.appendChild(renderer.domElement);

    // ========== Character Atlas ==========
    const charAtlas = createCharacterAtlas();
    const charsPerRow = 12;
    const charRows = Math.ceil(MATRIX_CHARS.length / charsPerRow);

    // ========== Target Positions Texture ==========
    const textureSize = Math.ceil(Math.sqrt(CHAR_COUNT));
    const targetData = new Float32Array(textureSize * textureSize * 4);
    const targetTexture = new THREE.DataTexture(
      targetData,
      textureSize,
      textureSize,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    targetTexture.needsUpdate = true;
    targetTextureRef.current = targetTexture;

    // ========== Calculate Layout ==========
    const aspect = window.innerWidth / window.innerHeight;
    const frustumHeight = 2 * Math.tan((75 * Math.PI) / 360) * 100;
    const frustumWidth = frustumHeight * aspect;
    const halfWidth = frustumWidth / 2;
    const halfHeight = frustumHeight / 2;

    // ========== Instanced Geometry ==========
    const planeGeo = new THREE.PlaneGeometry(1, 1);

    // 인스턴스 속성
    const instancePositions = new Float32Array(CHAR_COUNT * 3);
    const instanceCharIndices = new Float32Array(CHAR_COUNT);
    const instanceBrightnesses = new Float32Array(CHAR_COUNT);
    const instanceDepths = new Float32Array(CHAR_COUNT);
    const instanceSpeeds = new Float32Array(CHAR_COUNT);
    const instanceSizes = new Float32Array(CHAR_COUNT); // 랜덤 크기
    const instanceSpawnTimes = new Float32Array(CHAR_COUNT); // 스폰 시간

    // 열 설정
    const columnWidth = (frustumWidth * 1.2) / COLUMN_COUNT;

    // 열별 데이터
    const columnData: {
      speed: number;
      length: number;
      depth: number;
      headY: number;
      charCount: number; // 각 열의 문자 개수 (48-86)
      startDelay: number; // 열 시작 지연 시간
      spawnedCount: number; // 현재까지 스폰된 문자 개수
      lastSpawnTime: number; // 마지막 스폰 시간
    }[] = [];

    for (let col = 0; col < COLUMN_COUNT; col++) {
      columnData.push({
        speed: (0.3 + Math.random() * 0.7) * speedMultiplier,
        length:
          TAIL_LENGTH_MIN +
          Math.floor(Math.random() * (TAIL_LENGTH_MAX - TAIL_LENGTH_MIN + 1)),
        depth: Math.random(), // 0~1 깊이
        headY: halfHeight + Math.random() * halfHeight * 2,
        charCount:
          CHARS_PER_COLUMN_MIN +
          Math.floor(
            Math.random() * (CHARS_PER_COLUMN_MAX - CHARS_PER_COLUMN_MIN + 1)
          ),
        startDelay: Math.random() * 2.0, // 0~2초 랜덤 시작 지연
        spawnedCount: 0,
        lastSpawnTime: 0,
      });
    }

    // 인스턴스 초기화
    let instanceIndex = 0;
    for (let col = 0; col < COLUMN_COUNT && instanceIndex < CHAR_COUNT; col++) {
      const colData = columnData[col];
      const columnX = -halfWidth * 1.1 + col * columnWidth + columnWidth / 2;

      // 열의 고정 X 위치 (모든 문자가 같은 X)
      const columnFixedX = columnX + (Math.random() - 0.5) * 0.3;
      // 문자 간격 (크기 기반)
      const charSpacing = (CHAR_SIZE_MIN + CHAR_SIZE_MAX) / 2 * 1.2;

      for (
        let row = 0;
        row < colData.charCount && instanceIndex < CHAR_COUNT;
        row++
      ) {
        const i3 = instanceIndex * 3;

        // 위치: 모든 문자가 같은 X, row에 따라 Y가 아래로 오프셋
        instancePositions[i3] = columnFixedX;
        // 랜덤 크기를 먼저 생성하여 간격 계산과 렌더링에 동일하게 사용
        const randomSize =
          CHAR_SIZE_MIN + Math.random() * (CHAR_SIZE_MAX - CHAR_SIZE_MIN);
        // row 0 = 머리(가장 위, 밝음), row 1, 2, ... = 꼬리(아래쪽으로 연결, 어두움)
        instancePositions[i3 + 1] = colData.headY - row * charSpacing;
        instancePositions[i3 + 2] = -colData.depth * DEPTH_RANGE;

        // 문자 인덱스
        instanceCharIndices[instanceIndex] = Math.floor(
          Math.random() * MATRIX_CHARS.length
        );

        // 밝기: 머리는 1.0, 꼬리로 갈수록 감소
        const brightness =
          row === 0
            ? 1.0
            : row < colData.length
            ? Math.max(0.1, 1.0 - (row / colData.length) * 0.9)
            : 0.05;
        instanceBrightnesses[instanceIndex] = brightness;

        // 깊이
        instanceDepths[instanceIndex] = colData.depth;

        // 속도 (깊이 기반 조정: 가까운 것(작은 depth)이 더 빠름)
        const depthSpeedFactor =
          1.0 + (1.0 - colData.depth) * DEPTH_SPEED_MULTIPLIER;
        instanceSpeeds[instanceIndex] = colData.speed * depthSpeedFactor;

        // 랜덤 크기 (위치 계산에 사용한 것과 동일한 값 사용)
        instanceSizes[instanceIndex] = randomSize;

        // 스폰 시간: 열 시작 지연 + row * 간격 (머리가 먼저, 꼬리가 순차적으로)
        instanceSpawnTimes[instanceIndex] = colData.startDelay + row * CHAR_SPAWN_INTERVAL;

        instanceIndex++;
      }
    }

    // ========== Instanced Mesh ==========
    const instancedGeo = planeGeo.clone();
    instancedGeo.setAttribute(
      "instancePosition",
      new THREE.InstancedBufferAttribute(instancePositions, 3)
    );
    instancedGeo.setAttribute(
      "instanceCharIndex",
      new THREE.InstancedBufferAttribute(instanceCharIndices, 1)
    );
    instancedGeo.setAttribute(
      "instanceBrightness",
      new THREE.InstancedBufferAttribute(instanceBrightnesses, 1)
    );
    instancedGeo.setAttribute(
      "instanceDepth",
      new THREE.InstancedBufferAttribute(instanceDepths, 1)
    );
    instancedGeo.setAttribute(
      "instanceSpeed",
      new THREE.InstancedBufferAttribute(instanceSpeeds, 1)
    );
    instancedGeo.setAttribute(
      "instanceSize",
      new THREE.InstancedBufferAttribute(instanceSizes, 1)
    );
    instancedGeo.setAttribute(
      "instanceSpawnTime",
      new THREE.InstancedBufferAttribute(instanceSpawnTimes, 1)
    );

    const material = new THREE.ShaderMaterial({
      uniforms: {
        charAtlas: { value: charAtlas },
        charsPerRow: { value: charsPerRow },
        charRows: { value: charRows },
        time: { value: 0 },
        morphProgress: { value: 0 },
        targetPositions: { value: targetTexture },
        targetSize: { value: new THREE.Vector2(textureSize, textureSize) },
        screenHeight: { value: frustumHeight },
        depthSpeedMultiplier: { value: DEPTH_SPEED_MULTIPLIER },
        mouseWorldX: { value: 0 },
        mouseWorldY: { value: 0 },
        mouseActive: { value: 0 },
      },
      vertexShader: MATRIX_INSTANCE_VERTEX,
      fragmentShader: MATRIX_INSTANCE_FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    materialRef.current = material;

    const mesh = new THREE.InstancedMesh(instancedGeo, material, CHAR_COUNT);
    mesh.frustumCulled = false;

    // 각 인스턴스의 변환 행렬 (기본값)
    const dummy = new THREE.Object3D();
    for (let i = 0; i < CHAR_COUNT; i++) {
      dummy.position.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    scene.add(mesh);

    // ========== Post-processing ==========
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloomStrength,
      bloomRadius,
      bloomThreshold
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    // ========== Animation ==========
    const timer = new THREE.Timer();
    let animationFrameId: number;

    // 문자 변경 타이머
    const charChangeTimers = new Float32Array(CHAR_COUNT);
    for (let i = 0; i < CHAR_COUNT; i++) {
      charChangeTimers[i] = Math.random() * 30;
    }

    // 마우스 위치 추적 (lerp를 위한 타겟과 현재값 분리)
    let mouseTargetX = 0;
    let mouseTargetY = 0;
    let mouseWorldX = 0;
    let mouseWorldY = 0;
    let mouseActive = 0;
    const MOUSE_LERP_SPEED = 0.08; // lerp 속도 (낮을수록 부드러움)

    const handleMouseMove = (e: MouseEvent) => {
      // 화면 좌표를 월드 좌표로 변환 (타겟 위치로 저장)
      const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
      const ndcY = -((e.clientY / window.innerHeight) * 2 - 1);
      mouseTargetX = ndcX * halfWidth;
      mouseTargetY = ndcY * halfHeight;
      mouseActive = 1;
    };

    const handleMouseLeave = () => {
      mouseActive = 0;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const animate = () => {
      timer.update();
      const delta = timer.getDelta();
      const time = timer.getElapsed();
      material.uniforms.time.value = time;

      // 마우스 위치 lerp 적용 (부드러운 추적)
      mouseWorldX += (mouseTargetX - mouseWorldX) * MOUSE_LERP_SPEED;
      mouseWorldY += (mouseTargetY - mouseWorldY) * MOUSE_LERP_SPEED;

      // 마우스 위치 uniform 업데이트
      material.uniforms.mouseWorldX.value = mouseWorldX;
      material.uniforms.mouseWorldY.value = mouseWorldY;
      material.uniforms.mouseActive.value = mouseActive;

      // 버튼 hover 시 (morphProgress > 0.1) 속도를 1/10로 감소
      const isSlowMode = morphProgressRef.current > 0.1;
      const slowFactor = isSlowMode ? 0.1 : 1.0;

      // 모핑 진행도
      const morphSpeed =
        targetMorphRef.current > morphProgressRef.current
          ? MORPH_IN_SPEED
          : MORPH_OUT_SPEED;
      morphProgressRef.current +=
        (targetMorphRef.current - morphProgressRef.current) * morphSpeed;
      material.uniforms.morphProgress.value = morphProgressRef.current;

      // 인스턴스 속성 업데이트
      const posAttr = instancedGeo.getAttribute(
        "instancePosition"
      ) as THREE.InstancedBufferAttribute;
      const charAttr = instancedGeo.getAttribute(
        "instanceCharIndex"
      ) as THREE.InstancedBufferAttribute;
      const brightAttr = instancedGeo.getAttribute(
        "instanceBrightness"
      ) as THREE.InstancedBufferAttribute;
      const depthAttr = instancedGeo.getAttribute(
        "instanceDepth"
      ) as THREE.InstancedBufferAttribute;
      const sizeAttr = instancedGeo.getAttribute(
        "instanceSize"
      ) as THREE.InstancedBufferAttribute;
      const speedAttr = instancedGeo.getAttribute(
        "instanceSpeed"
      ) as THREE.InstancedBufferAttribute;
      const spawnAttr = instancedGeo.getAttribute(
        "instanceSpawnTime"
      ) as THREE.InstancedBufferAttribute;

      // 각 열의 시작 인덱스 계산
      const columnStartIndices: number[] = [];
      let currentIndex = 0;
      for (let col = 0; col < COLUMN_COUNT; col++) {
        columnStartIndices[col] = currentIndex;
        currentIndex += columnData[col].charCount;
      }

      for (let col = 0; col < COLUMN_COUNT; col++) {
        const colData = columnData[col];
        const columnX = -halfWidth * 1.1 + col * columnWidth + columnWidth / 2;
        const startIdx = columnStartIndices[col];

        // 깊이에 따른 속도 조절: 가까운 것(작은 depth)이 더 빠르게
        // slowFactor 적용: hover 시 1/10 속도
        const depthSpeedFactor =
          1.0 + (1.0 - colData.depth) * DEPTH_SPEED_MULTIPLIER;
        const moveAmount = colData.speed * depthSpeedFactor * delta * 30 * slowFactor;

        let tailY = Infinity; // 꼬리(가장 아래 스폰된 문자)의 Y 위치
        let lastSpawnedY = colData.headY; // 마지막으로 스폰된 문자의 Y 위치 추적

        for (
          let row = 0;
          row < colData.charCount && startIdx + row < CHAR_COUNT;
          row++
        ) {
          const idx = startIdx + row;
          const i3 = idx * 3;
          const spawnTime = spawnAttr.array[idx];
          const isSpawned = time >= spawnTime;

          if (isSpawned) {
            // 스폰된 문자만 Y 이동
            const newY = posAttr.array[i3 + 1] - moveAmount;
            posAttr.array[i3 + 1] = newY;

            // 스폰된 문자 중 가장 아래(가장 작은 Y)를 tailY로 추적
            tailY = newY;
            lastSpawnedY = newY;

            // 문자 변경 (머리는 더 빈번)
            const isHead = row === 0;
            charChangeTimers[idx] -= delta * 60 * (isHead ? 4 : 1);
            if (charChangeTimers[idx] <= 0) {
              charAttr.array[idx] = Math.floor(
                Math.random() * MATRIX_CHARS.length
              );
              charChangeTimers[idx] = isHead
                ? 2 + Math.random() * 5
                : 8 + Math.random() * 25;
            }
          } else {
            // 아직 스폰되지 않은 문자는 마지막 스폰된 문자 바로 위에 대기
            // 스폰될 때 자연스럽게 연결되도록
            const charSize = sizeAttr.array[idx];
            posAttr.array[i3 + 1] = lastSpawnedY + charSize * 1.5;
          }
        }

        // 리셋: 꼬리의 끝(tailY)이 화면 하단을 벗어나면 리셋
        // tailY가 Infinity면 아직 스폰된 문자 없음 - 리셋하지 않음
        if (tailY !== Infinity && tailY < -halfHeight - 30) {
          const newHeadY = halfHeight + 30 + Math.random() * 60;
          const newLength =
            TAIL_LENGTH_MIN +
            Math.floor(Math.random() * (TAIL_LENGTH_MAX - TAIL_LENGTH_MIN + 1));
          const newDepth = Math.random();

          colData.headY = newHeadY;
          colData.length = newLength;
          colData.depth = newDepth;
          colData.speed = (0.3 + Math.random() * 0.7) * speedMultiplier;
          // charCount는 초기화 시에만 설정하고 리셋 시에는 변경하지 않음 (인덱스 범위 유지)

          // 열의 고정 X 위치 (모든 문자가 같은 X)
          const resetColumnFixedX = columnX + (Math.random() - 0.5) * 0.3;
          // 문자 간격
          const charSpacing = (CHAR_SIZE_MIN + CHAR_SIZE_MAX) / 2 * 1.2;

          for (
            let row = 0;
            row < colData.charCount && startIdx + row < CHAR_COUNT;
            row++
          ) {
            const idx = startIdx + row;
            const i3 = idx * 3;

            // 모든 문자가 같은 X
            posAttr.array[i3] = resetColumnFixedX;
            // 랜덤 크기를 생성하여 간격 계산과 렌더링에 동일하게 사용
            const randomSize =
              CHAR_SIZE_MIN + Math.random() * (CHAR_SIZE_MAX - CHAR_SIZE_MIN);
            // row 0 = 머리(가장 위, 밝음), row 1, 2, ... = 꼬리(아래쪽으로 연결, 어두움)
            posAttr.array[i3 + 1] = newHeadY - row * charSpacing;
            posAttr.array[i3 + 2] = -newDepth * DEPTH_RANGE;

            charAttr.array[idx] = Math.floor(
              Math.random() * MATRIX_CHARS.length
            );

            const brightness =
              row === 0
                ? 1.0
                : row < newLength
                ? Math.max(0.1, 1.0 - (row / newLength) * 0.9)
                : 0.05;
            brightAttr.array[idx] = brightness;

            depthAttr.array[idx] = newDepth;

            // 속도도 깊이 기반으로 재조정
            const depthSpeedFactor =
              1.0 + (1.0 - newDepth) * DEPTH_SPEED_MULTIPLIER;
            speedAttr.array[idx] = colData.speed * depthSpeedFactor;

            // 랜덤 크기 (위치 계산에 사용한 것과 동일한 값 사용)
            sizeAttr.array[idx] = randomSize;

            // 스폰 시간: 현재 시간 + row * 간격 (머리가 먼저, 꼬리가 순차적으로)
            spawnAttr.array[idx] = time + row * CHAR_SPAWN_INTERVAL;
          }

          // 속성 업데이트 플래그 설정
          speedAttr.needsUpdate = true;
          spawnAttr.needsUpdate = true;
        }
      }

      posAttr.needsUpdate = true;
      charAttr.needsUpdate = true;
      brightAttr.needsUpdate = true;
      depthAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;

      composer.render();
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    // ========== Resize ==========
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
      bloomPass.resolution.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // ========== Cleanup ==========
    return () => {
      targetTextureRef.current = null;
      materialRef.current = null;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      mountElement.removeChild(renderer.domElement);
      instancedGeo.dispose();
      planeGeo.dispose();
      material.dispose();
      charAtlas.dispose();
      targetTexture.dispose();
      releaseWebGL(renderer, composer);
    };
  }, [
    targetMorphRef,
    contentRef,
    bloomStrength,
    bloomRadius,
    bloomThreshold,
    speedMultiplier,
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
