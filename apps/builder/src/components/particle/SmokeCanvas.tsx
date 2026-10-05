/**
 * SmokeCanvas - Lightweight Volumetric Smoke Effect
 *
 * 성능 최적화된 연기/안개 효과
 * - 사전 생성된 노이즈 텍스처 사용 (GPU 부하 최소화)
 * - 적은 레이어 수 (4개)
 * - 간단한 UV 스크롤링
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useParticleBackground } from "./useParticleBackground";
import { generatePointsFromContent, releaseWebGL } from "./canvasUtils";
import {
  MORPH_IN_SPEED,
  MORPH_OUT_SPEED,
  TRANSITION_SPEED,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from "./constants";

// ==================== 노이즈 텍스처 생성 (CPU에서 1회만) ====================
function generateNoiseTexture(size: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);

  // Perlin-like noise 생성
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // 여러 주파수의 노이즈를 합성
      let value = 0;
      let amplitude = 1;
      let frequency = 1;
      let maxValue = 0;

      for (let octave = 0; octave < 4; octave++) {
        const nx = (x / size) * frequency * 4;
        const ny = (y / size) * frequency * 4;

        // 간단한 값 노이즈
        const noise =
          Math.sin(nx * 12.9898 + ny * 78.233) * 43758.5453;
        value += (noise - Math.floor(noise)) * amplitude;

        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }

      value = (value / maxValue) * 255;

      data[idx] = value;     // R
      data[idx + 1] = value; // G
      data[idx + 2] = value; // B
      data[idx + 3] = 255;   // A
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;

  return texture;
}

// ==================== Smoke Shader (경량화) ====================
const SMOKE_VERTEX_SHADER = `
  varying vec2 vUv;
  varying float vLayerAlpha;

  uniform float time;
  uniform float layerIndex;

  void main() {
    vUv = uv;
    vLayerAlpha = 1.0 - layerIndex * 0.15;

    vec3 pos = position;
    float offset = layerIndex * 0.7;

    // 간단한 움직임
    pos.x += sin(time * 0.2 + offset) * 8.0;
    pos.y += cos(time * 0.15 + offset) * 5.0;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const SMOKE_FRAGMENT_SHADER = `
  uniform float time;
  uniform float morphProgress;
  uniform float layerIndex;
  uniform sampler2D noiseTexture;
  uniform sampler2D morphTexture;
  uniform vec3 smokeColor;
  uniform float opacity;

  varying vec2 vUv;
  varying float vLayerAlpha;

  void main() {
    vec2 uv = vUv;

    // UV 스크롤 (레이어마다 다른 속도)
    float scrollSpeed = 0.02 + layerIndex * 0.01;
    vec2 scroll1 = vec2(time * scrollSpeed, time * scrollSpeed * 0.7);
    vec2 scroll2 = vec2(-time * scrollSpeed * 0.5, time * scrollSpeed * 0.3);

    // 노이즈 텍스처 샘플링 (2번만)
    float noise1 = texture2D(noiseTexture, uv * 1.5 + scroll1).r;
    float noise2 = texture2D(noiseTexture, uv * 2.5 + scroll2).r;

    // 연기 밀도
    float density = (noise1 * 0.6 + noise2 * 0.4);

    // 가장자리 페이드
    vec2 center = uv - 0.5;
    float dist = length(center);
    float vignette = 1.0 - smoothstep(0.2, 0.6, dist);
    density *= vignette;

    // 모핑 (텍스트 형성)
    if (morphProgress > 0.01) {
      float morphSample = texture2D(morphTexture, uv).r;
      density = mix(density, morphSample * 0.9 + density * 0.3, morphProgress * 0.8);
    }

    // 레이어별 투명도
    float alpha = density * opacity * vLayerAlpha;

    if (alpha < 0.02) discard;

    // 밀도에 따른 미세한 색상 변화
    vec3 color = smokeColor + vec3(0.05) * density;

    gl_FragColor = vec4(color, alpha);
  }
`;

// ==================== Component ====================
interface SmokeCanvasProps {
  color?: { r: number; g: number; b: number };
  opacity?: number;
  layerCount?: number;
}

export function SmokeCanvas({
  color = { r: 0.8, g: 0.8, b: 0.85 },
  opacity = 0.4,
  layerCount = 4, // 10 → 4로 감소
}: SmokeCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const { targetMorphRef, contentRef, contentVersion } = useParticleBackground();
  const morphProgressRef = useRef(0);
  const transitionProgressRef = useRef(1);
  const materialsRef = useRef<THREE.ShaderMaterial[]>([]);
  const morphTextureRef = useRef<THREE.DataTexture | null>(null);

  // 모핑 텍스처 업데이트
  useEffect(() => {
    if (!morphTextureRef.current) return;

    const points = generatePointsFromContent(contentRef.current);
    const textureSize = 256; // 512 → 256으로 감소
    const data = new Uint8Array(textureSize * textureSize);

    for (let i = 0; i < points.length; i += 3) {
      const x = points[i];
      const y = points[i + 1];

      const texX = Math.floor(((x / (CANVAS_WIDTH * 0.28 / 2)) * 0.5 + 0.5) * textureSize);
      const texY = Math.floor(((-y / (CANVAS_HEIGHT * 0.28 / 2)) * 0.5 + 0.5) * textureSize);

      if (texX >= 0 && texX < textureSize && texY >= 0 && texY < textureSize) {
        // 블러 범위 축소 (2 → 1)
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const px = texX + dx;
            const py = texY + dy;
            if (px >= 0 && px < textureSize && py >= 0 && py < textureSize) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              const intensity = Math.max(0, 1 - dist / 2) * 255;
              const idx = py * textureSize + px;
              data[idx] = Math.min(255, data[idx] + intensity);
            }
          }
        }
      }
    }

    if (morphTextureRef.current.image.data) {
      morphTextureRef.current.image.data.set(data);
    }
    morphTextureRef.current.needsUpdate = true;
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
      antialias: false, // 안티앨리어싱 비활성화
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // 픽셀 비율 제한
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountElement.appendChild(renderer.domElement);

    // 노이즈 텍스처 (1회 생성)
    const noiseTexture = generateNoiseTexture(128); // 작은 크기

    // 모핑 텍스처
    const textureSize = 256;
    const morphData = new Uint8Array(textureSize * textureSize);
    const morphTexture = new THREE.DataTexture(
      morphData,
      textureSize,
      textureSize,
      THREE.RedFormat
    );
    morphTexture.needsUpdate = true;
    morphTextureRef.current = morphTexture;

    // 다크모드 감지
    const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const smokeColor = isDarkMode
      ? new THREE.Vector3(color.r, color.g, color.b)
      : new THREE.Vector3(color.r * 0.4, color.g * 0.4, color.b * 0.4);

    // 레이어 생성
    const materials: THREE.ShaderMaterial[] = [];
    const geometries: THREE.PlaneGeometry[] = [];
    const planeSize = 450;

    for (let i = 0; i < layerCount; i++) {
      const geometry = new THREE.PlaneGeometry(planeSize, planeSize, 1, 1);
      geometries.push(geometry);

      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          morphProgress: { value: 0 },
          layerIndex: { value: i },
          noiseTexture: { value: noiseTexture },
          morphTexture: { value: morphTexture },
          smokeColor: { value: smokeColor },
          opacity: { value: opacity },
        },
        vertexShader: SMOKE_VERTEX_SHADER,
        fragmentShader: SMOKE_FRAGMENT_SHADER,
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      materials.push(material);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = -30 + i * (60 / layerCount);
      mesh.rotation.z = i * 0.05;

      scene.add(mesh);
    }

    materialsRef.current = materials;

    // 테마 변경
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = (e: MediaQueryListEvent) => {
      const newColor = e.matches
        ? new THREE.Vector3(color.r, color.g, color.b)
        : new THREE.Vector3(color.r * 0.4, color.g * 0.4, color.b * 0.4);
      materials.forEach((mat) => {
        mat.uniforms.smokeColor.value = newColor;
      });
    };
    mediaQuery.addEventListener("change", handleThemeChange);

    // 애니메이션
    const timer = new THREE.Timer();
    let animationFrameId: number;

    const animate = () => {
      timer.update();
      const elapsed = timer.getElapsed();

      // 모핑 진행도
      const morphSpeed =
        targetMorphRef.current > morphProgressRef.current
          ? MORPH_IN_SPEED
          : MORPH_OUT_SPEED;
      morphProgressRef.current +=
        (targetMorphRef.current - morphProgressRef.current) * morphSpeed;

      transitionProgressRef.current +=
        (1 - transitionProgressRef.current) * TRANSITION_SPEED;

      // Uniform 업데이트
      materials.forEach((mat) => {
        mat.uniforms.time.value = elapsed;
        mat.uniforms.morphProgress.value = morphProgressRef.current;
      });

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    // 리사이즈
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // Cleanup
    return () => {
      materialsRef.current = [];
      morphTextureRef.current = null;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
      mediaQuery.removeEventListener("change", handleThemeChange);
      mountElement.removeChild(renderer.domElement);
      noiseTexture.dispose();
      morphTexture.dispose();
      materials.forEach((mat) => mat.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      releaseWebGL(renderer);
    };
  }, [targetMorphRef, contentRef, color, opacity, layerCount]);

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
