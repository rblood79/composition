import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { useParticleBackground } from "./useParticleBackground";
import { generatePointsFromContent, releaseWebGL } from "./canvasUtils";
import { PARTICLE_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER } from "./shaders";
import {
  PARTICLE_COUNT,
  MORPH_IN_SPEED,
  MORPH_OUT_SPEED,
  TRANSITION_SPEED,
  VORTEX_FADE_SPEED,
} from "./constants";
import type { ParticleThemePreset } from "./types";

interface ParticleCanvasProps {
  preset: ParticleThemePreset;
  /** 잔상 효과 강도 (0.0 ~ 1.0, 높을수록 오래 지속) */
  afterImageDamp?: number;
  /** Bloom 강도 (0.0 ~ 2.0) */
  bloomStrength?: number;
  /** Bloom 반경 */
  bloomRadius?: number;
  /** Bloom 임계값 (0.0 ~ 1.0, 낮을수록 더 많은 영역이 발광) */
  bloomThreshold?: number;
}

export function ParticleCanvas({
  preset,
  afterImageDamp = 0.35,
  bloomStrength = 0.4,
  bloomRadius = 0.3,
  bloomThreshold = 0.6,
}: ParticleCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const { targetMorphRef, contentRef, contentVersion, vortexRef } =
    useParticleBackground();
  const morphProgressRef = useRef(0);
  const transitionProgressRef = useRef(1);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

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

    // Geometry 생성
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const randoms = new Float32Array(PARTICLE_COUNT);
    const heightLayers = new Float32Array(PARTICLE_COUNT);
    const particleSizes = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      positions[i3] = (Math.random() - 0.5) * 550;
      positions[i3 + 1] = (Math.random() - 0.5) * 380;
      positions[i3 + 2] = (Math.random() - 0.5) * 100;

      randoms[i] = Math.random();

      const heightRandom = Math.random();
      heightLayers[i] = heightRandom * heightRandom;

      const baseSize =
        preset.particleBaseSize + Math.random() * preset.particleSizeVariance;
      particleSizes[i] = baseSize * (1.0 - heightLayers[i] * preset.layerSizeReduction);
    }

    const initialPoints = generatePointsFromContent(contentRef.current);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("random", new THREE.BufferAttribute(randoms, 1));
    geometry.setAttribute("heightLayer", new THREE.BufferAttribute(heightLayers, 1));
    geometry.setAttribute("particleSize", new THREE.BufferAttribute(particleSizes, 1));
    geometry.setAttribute("targetPos", new THREE.BufferAttribute(initialPoints, 3));
    geometry.setAttribute(
      "prevTargetPos",
      new THREE.BufferAttribute(new Float32Array(initialPoints), 3)
    );
    geometryRef.current = geometry;

    // 색상 설정
    const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const colors = isDarkMode ? preset.colors.dark : preset.colors.light;

    // 테마별 색상 힌트
    const morphColorTint =
      preset.name === "sand"
        ? new THREE.Vector3(0.12, 0.06, 0.0)
        : new THREE.Vector3(0.05, 0.05, 0.05);

    const hazeColor =
      preset.name === "sand"
        ? new THREE.Vector3(0.9, 0.8, 0.6)
        : new THREE.Vector3(0.85, 0.85, 0.9);

    const tweaks = preset.shaderTweaks ?? {};

    // Material 생성
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        morphProgress: { value: 0 },
        transitionProgress: { value: 1 },

        // 색상
        colorPrimary: {
          value: new THREE.Vector3(colors.primary.r, colors.primary.g, colors.primary.b),
        },
        colorSecondary: {
          value: new THREE.Vector3(colors.secondary.r, colors.secondary.g, colors.secondary.b),
        },
        colorDust: {
          value: new THREE.Vector3(colors.dust.r, colors.dust.g, colors.dust.b),
        },
        morphColorTint: { value: morphColorTint },
        hazeColor: { value: hazeColor },

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
        formIntensityMultiplier: { value: tweaks.formIntensityMultiplier ?? 3.5 },
        aliveBreathScale: { value: tweaks.aliveBreathScale ?? 2.0 },
        vibrationScale: { value: tweaks.vibrationScale ?? 0.6 },
        baseAlphaLow: { value: preset.baseAlpha.low },
        baseAlphaHigh: { value: preset.baseAlpha.high },
      },
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      transparent: true,
      blending:
        preset.blending === "additive"
          ? THREE.AdditiveBlending
          : THREE.NormalBlending,
      depthWrite: false,
    });
    materialRef.current = material;

    // 테마 변경 핸들러
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = (e: MediaQueryListEvent) => {
      const c = e.matches ? preset.colors.dark : preset.colors.light;
      material.uniforms.colorPrimary.value.set(c.primary.r, c.primary.g, c.primary.b);
      material.uniforms.colorSecondary.value.set(c.secondary.r, c.secondary.g, c.secondary.b);
      material.uniforms.colorDust.value.set(c.dust.r, c.dust.g, c.dust.b);
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

    // 3. UnrealBloom 패스 (발광 효과)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloomStrength,
      bloomRadius,
      bloomThreshold
    );
    composer.addPass(bloomPass);

    // 4. 출력 패스 (항상 마지막)
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // 애니메이션 루프
    const timer = new THREE.Timer();
    let animationFrameId: number;

    const vortexFadeMultiplier = tweaks.vortexFadeMultiplier ?? 135;

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

      // EffectComposer로 렌더링
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
      materialRef.current = null;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
      mediaQuery.removeEventListener("change", handleThemeChange);
      mountElement.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      releaseWebGL(renderer, composer);
    };
  }, [targetMorphRef, contentRef, vortexRef, preset, afterImageDamp, bloomStrength, bloomRadius, bloomThreshold]);

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
