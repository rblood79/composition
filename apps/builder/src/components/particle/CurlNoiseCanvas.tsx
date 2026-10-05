/**
 * CurlNoiseCanvas - Curl Noise Flow Field Effect
 *
 * 유체처럼 흐르는 파티클 효과
 * - Curl Noise 기반 속도장 (발산 없는 자연스러운 흐름)
 * - GPU에서 파티클 위치 계산
 * - 텍스트/SVG 모핑 지원
 * - 형태 간 부드러운 전환
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { useParticleBackground } from "./useParticleBackground";
import { generatePointsFromContent, releaseWebGL } from "./canvasUtils";
import {
  PARTICLE_COUNT,
  MORPH_IN_SPEED,
  MORPH_OUT_SPEED,
  VORTEX_FADE_SPEED,
} from "./constants";

// 전환 속도 (느리고 자연스럽게)
const TRANSITION_SPEED = 0.012;

// ==================== Curl Noise Vertex Shader ====================
const CURL_VERTEX_SHADER = `
  attribute float size;
  attribute float life;
  attribute vec3 velocity;
  attribute vec3 targetPos;
  attribute vec3 prevTargetPos;

  uniform float time;
  uniform float morphProgress;
  uniform float transitionProgress;
  uniform float vortexActive;
  uniform vec2 vortexCenter;
  uniform float vortexStrength;

  varying float vLife;
  varying float vMorph;
  varying float vSpeed;
  varying float vTransition;

  // Simplex noise functions
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
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
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

  // Curl Noise - 발산 없는 벡터장 (유체 흐름)
  vec3 curlNoise(vec3 p) {
    float e = 0.1;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);

    float n1 = snoise(p + dy) - snoise(p - dy);
    float n2 = snoise(p + dz) - snoise(p - dz);
    float n3 = snoise(p + dx) - snoise(p - dx);
    float n4 = snoise(p + dz) - snoise(p - dz);
    float n5 = snoise(p + dx) - snoise(p - dx);
    float n6 = snoise(p + dy) - snoise(p - dy);

    return normalize(vec3(
      n1 - n2,
      n3 - n4,
      n5 - n6
    )) / (2.0 * e);
  }

  // Smooth easing function
  float easeInOutCubic(float t) {
    return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
  }

  void main() {
    // 이전/현재 타겟 (easing 적용)
    float easedTransition = easeInOutCubic(transitionProgress);
    vec3 currentTarget = mix(prevTargetPos, targetPos, easedTransition);

    // 기본 위치
    vec3 pos = position;

    // 전환 중인지 감지 (0~1 범위에서 중간값일 때)
    float isTransitioning = 1.0 - abs(transitionProgress * 2.0 - 1.0);
    isTransitioning = smoothstep(0.0, 0.3, isTransitioning);

    // Curl Noise 흐름 (전환 중에는 더 강하게)
    float noiseScale = 0.008;
    float noiseSpeed = time * 0.15;
    vec3 noisePos = pos * noiseScale + vec3(0.0, 0.0, noiseSpeed);
    vec3 curl = curlNoise(noisePos);

    // 전환 중에는 타겟 방향으로 흐름 추가
    vec3 toTarget = normalize(currentTarget - pos);
    float distToTarget = length(currentTarget - pos);

    // 전환 흐름: 타겟 방향 + curl noise 혼합
    vec3 transitionFlow = mix(curl, toTarget, 0.3) * isTransitioning * 40.0;

    // 기본 흐름 강도 (life에 따라 변화, 전환 중에는 감소)
    float baseFlowStrength = 25.0 * (0.5 + life * 0.5);
    float flowStrength = baseFlowStrength * (1.0 - isTransitioning * 0.5);
    vec3 flowOffset = curl * flowStrength + transitionFlow;

    // 기본 부유 움직임 (전환 중에는 감소)
    float floatIntensity = 1.0 - isTransitioning * 0.7;
    float floatY = sin(time * 0.3 + life * 6.28) * 8.0 * floatIntensity;
    float floatX = cos(time * 0.2 + life * 4.0) * 6.0 * floatIntensity;

    // 회오리 효과
    vec3 vortexOffset = vec3(0.0);
    if (vortexActive > 0.5 && vortexStrength > 0.01) {
      vec2 toVortex = pos.xy - vortexCenter;
      float dist = length(toVortex);
      float influence = smoothstep(200.0, 0.0, dist) * vortexStrength;

      if (influence > 0.01) {
        float angle = atan(toVortex.y, toVortex.x) + time * 2.0 * vortexStrength;
        float spiralRadius = dist * (1.0 - influence * 0.3);

        vortexOffset.xy = vec2(cos(angle), sin(angle)) * spiralRadius - toVortex;
        vortexOffset.y += influence * 50.0;
      }
    }

    // 평상시 위치 (curl noise + float)
    vec3 flowPos = pos + flowOffset + vec3(floatX, floatY, 0.0) + vortexOffset;

    // 모핑 적용 (easing)
    float easedMorph = easeInOutCubic(morphProgress);
    vec3 morphedPos = mix(flowPos, currentTarget, easedMorph);

    // 형태 유지 시 미세한 움직임
    if (morphProgress > 0.5) {
      float aliveIntensity = (morphProgress - 0.5) * 2.0;

      // 호흡 효과
      float breathe = sin(time * 1.2 + life * 3.14) * 2.0;
      morphedPos += normalize(currentTarget) * breathe * aliveIntensity * 0.5;

      // 잔물결 (현재 타겟 위치 기반)
      vec3 ripple = curlNoise(currentTarget * 0.02 + vec3(time * 0.5, 0.0, 0.0)) * 3.0;
      morphedPos += ripple * aliveIntensity;

      // 전환 중 추가 움직임 (이전 형태에서 새 형태로 흘러가는 듯)
      if (isTransitioning > 0.1) {
        vec3 flowToNew = curlNoise(morphedPos * 0.01 + vec3(time * 0.3, 0.0, 0.0));
        morphedPos += flowToNew * isTransitioning * 5.0;
      }
    }

    pos = morphedPos;

    // 속도 계산 (색상/크기에 사용)
    vSpeed = length(curl) + vortexStrength * 0.5 + isTransitioning * 0.3;

    vLife = life;
    vMorph = morphProgress;
    vTransition = isTransitioning;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;

    // 파티클 크기 (전환 중에는 약간 커짐)
    float baseSize = size * (1.0 + morphProgress * 0.3);
    float speedSize = 1.0 + vSpeed * 0.2;
    float transitionSize = 1.0 + isTransitioning * 0.2;
    gl_PointSize = (baseSize * speedSize * transitionSize / -mvPos.z) * 150.0;
  }
`;

// ==================== Fragment Shader ====================
const CURL_FRAGMENT_SHADER = `
  uniform vec3 color1;
  uniform vec3 color2;
  uniform vec3 color3;
  uniform float time;

  varying float vLife;
  varying float vMorph;
  varying float vSpeed;
  varying float vTransition;

  void main() {
    // 부드러운 원형 파티클
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    // 가우시안 블러 효과
    float alpha = exp(-dist * dist * 8.0);

    // 색상 그라데이션 (life + speed 기반)
    float colorMix = vLife + vSpeed * 0.3;
    colorMix = fract(colorMix + time * 0.05);

    vec3 color;
    if (colorMix < 0.5) {
      color = mix(color1, color2, colorMix * 2.0);
    } else {
      color = mix(color2, color3, (colorMix - 0.5) * 2.0);
    }

    // 모핑 시 밝아짐
    color += vec3(0.1) * vMorph;

    // 전환 중 밝아짐 (더 활발해 보이게)
    color += vec3(0.08, 0.06, 0.1) * vTransition;

    // 속도에 따른 밝기
    color += vec3(0.05) * vSpeed;

    // 알파
    alpha *= 0.7 + vMorph * 0.3;

    gl_FragColor = vec4(color, alpha);
  }
`;

// ==================== Component ====================
interface CurlNoiseCanvasProps {
  colors?: {
    color1: { r: number; g: number; b: number };
    color2: { r: number; g: number; b: number };
    color3: { r: number; g: number; b: number };
  };
  particleCount?: number;
  /** 잔상 효과 강도 (0.0 ~ 1.0, 높을수록 오래 지속) */
  afterImageDamp?: number;
}

const DEFAULT_COLORS = {
  dark: {
    color1: { r: 0.4, g: 0.5, b: 0.7 },   // 청회색
    color2: { r: 0.6, g: 0.6, b: 0.75 },  // 연보라
    color3: { r: 0.75, g: 0.75, b: 0.85 }, // 밝은 회색
  },
  light: {
    color1: { r: 0.2, g: 0.25, b: 0.4 },
    color2: { r: 0.3, g: 0.3, b: 0.45 },
    color3: { r: 0.4, g: 0.4, b: 0.5 },
  },
};

export function CurlNoiseCanvas({
  colors,
  particleCount = PARTICLE_COUNT,
  afterImageDamp = 0.35,
}: CurlNoiseCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const { targetMorphRef, contentRef, contentVersion, vortexRef } =
    useParticleBackground();
  const morphProgressRef = useRef(0);
  const transitionProgressRef = useRef(1);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  // 타겟 위치 업데이트
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

    // 전환 시작
    transitionProgressRef.current = 0;
  }, [contentVersion, contentRef]);

  // Three.js 초기화
  useEffect(() => {
    if (!mountRef.current) return;

    const mountElement = mountRef.current;

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

    // Geometry 생성
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const lives = new Float32Array(particleCount);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // 넓게 분포
      positions[i3] = (Math.random() - 0.5) * 500;
      positions[i3 + 1] = (Math.random() - 0.5) * 350;
      positions[i3 + 2] = (Math.random() - 0.5) * 80;

      sizes[i] = 0.8 + Math.random() * 1.2;
      lives[i] = Math.random();

      velocities[i3] = (Math.random() - 0.5) * 2;
      velocities[i3 + 1] = (Math.random() - 0.5) * 2;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.5;
    }

    const initialPoints = generatePointsFromContent(contentRef.current);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("life", new THREE.BufferAttribute(lives, 1));
    geometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute("targetPos", new THREE.BufferAttribute(initialPoints, 3));
    geometry.setAttribute(
      "prevTargetPos",
      new THREE.BufferAttribute(new Float32Array(initialPoints), 3)
    );
    geometryRef.current = geometry;

    // 색상 설정
    const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const colorSet = colors || (isDarkMode ? DEFAULT_COLORS.dark : DEFAULT_COLORS.light);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        morphProgress: { value: 0 },
        transitionProgress: { value: 1 },
        vortexActive: { value: 0 },
        vortexCenter: { value: new THREE.Vector2(0, 0) },
        vortexStrength: { value: 0 },
        color1: { value: new THREE.Vector3(colorSet.color1.r, colorSet.color1.g, colorSet.color1.b) },
        color2: { value: new THREE.Vector3(colorSet.color2.r, colorSet.color2.g, colorSet.color2.b) },
        color3: { value: new THREE.Vector3(colorSet.color3.r, colorSet.color3.g, colorSet.color3.b) },
      },
      vertexShader: CURL_VERTEX_SHADER,
      fragmentShader: CURL_FRAGMENT_SHADER,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    materialRef.current = material;

    // 테마 변경
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = (e: MediaQueryListEvent) => {
      const newColors = e.matches ? DEFAULT_COLORS.dark : DEFAULT_COLORS.light;
      material.uniforms.color1.value.set(newColors.color1.r, newColors.color1.g, newColors.color1.b);
      material.uniforms.color2.value.set(newColors.color2.r, newColors.color2.g, newColors.color2.b);
      material.uniforms.color3.value.set(newColors.color3.r, newColors.color3.g, newColors.color3.b);
    };
    mediaQuery.addEventListener("change", handleThemeChange);

    scene.add(new THREE.Points(geometry, material));

    // ==================== Post-processing ====================
    const composer = new EffectComposer(renderer);

    // 1. 기본 렌더 패스
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // 2. Afterimage 패스 (잔상 효과)
    const afterimagePass = new AfterimagePass(afterImageDamp);
    composer.addPass(afterimagePass);

    // 3. 출력 패스 (항상 마지막)
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // 애니메이션
    const timer = new THREE.Timer();
    let animationFrameId: number;

    const animate = () => {
      timer.update();
      const delta = timer.getDelta();
      material.uniforms.time.value += delta;

      // 모핑
      const morphSpeed =
        targetMorphRef.current > morphProgressRef.current
          ? MORPH_IN_SPEED
          : MORPH_OUT_SPEED;
      morphProgressRef.current +=
        (targetMorphRef.current - morphProgressRef.current) * morphSpeed;
      material.uniforms.morphProgress.value = morphProgressRef.current;

      // 전환 (더 부드럽게)
      transitionProgressRef.current +=
        (1 - transitionProgressRef.current) * TRANSITION_SPEED;
      material.uniforms.transitionProgress.value = transitionProgressRef.current;

      // 회오리
      const vortex = vortexRef.current;
      if (!vortex.active && vortex.strength > 0) {
        vortex.strength = Math.max(0, vortex.strength - VORTEX_FADE_SPEED);
      }
      material.uniforms.vortexActive.value = vortex.strength > 0.01 ? 1 : 0;
      material.uniforms.vortexCenter.value.set(vortex.x, vortex.y);
      material.uniforms.vortexStrength.value = vortex.strength;

      // EffectComposer로 렌더링
      composer.render();
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    // 리사이즈
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // Cleanup
    return () => {
      geometryRef.current = null;
      materialRef.current = null;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
      mediaQuery.removeEventListener("change", handleThemeChange);
      mountElement.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      releaseWebGL(renderer, composer);
    };
  }, [targetMorphRef, contentRef, vortexRef, colors, particleCount, afterImageDamp]);

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
