/**
 * CanvasKit/Skia 렌더 루프
 *
 * Phase 5: 기본 렌더 루프 (단일 Surface)
 * Phase 6: 이중 Surface 캐싱 (컨텐츠 캐시 + 오버레이 분리)
 *
 * 프레임 분류:
 * - idle: 변경 없음 → 렌더링 스킵 (0ms)
 * - present: 오버레이만 변경 → 캐시 blit + 오버레이 렌더
 * - camera-only: 카메라만 변경 → 캐시 blit + 아핀 변환 + 오버레이 렌더 (~1ms)
 * - content: 요소 변경 → 컨텐츠 재렌더링 + 캐시 갱신
 * - full: 리사이즈/첫 프레임/cleanup → 전체 재렌더링
 *
 * @see docs/RENDERING_ARCHITECTURE.md §5.10, §6.1, §6.2
 */

import type { CanvasKit, Canvas, Surface, Image } from "canvaskit-wasm";
import type {
  SkiaRenderable,
  FrameType,
  CameraState,
  OpacityEffect,
} from "./types";
import { createGPUSurface } from "./createSurface";
import { drainPendingWasmDisposals } from "./deferredDisposal";
import { recordWasmMetric, flushWasmMetrics } from "../utils/gpuProfilerCore";
import { getCacheMetrics } from "./cacheMetrics";
import { takeDrawStats } from "./drawStats";
import { GpuTimer } from "./gpuTimer";
import { markBegin, markEnd, PERF_LABEL } from "../../../utils/perfMarks";
import type { TransitionManager } from "./transitionManager";
import type { AnimationEngine } from "./animationEngine";
import { getSkiaNode } from "./useSkiaNode";
import { setVolatileNodeIds } from "./nodePictureCache";

/** classifyFrame 판정 결과 — content/full 프레임은 승격 사유를 동반한다 (ADR-153 Phase 1-a) */
interface FrameClassification {
  type: FrameType;
  /** content/full 프레임의 재렌더 사유 — contentSurface 캐시 miss 사유로 기록 */
  reason: string | null;
}

/**
 * content 스냅샷 정책 (ADR-153 Phase 3 — R7 격차 5)
 *
 * 스냅샷(Image)이 살아 있는 채로 backing surface 에 다시 그리면 Ganesh 가
 * copy-on-write 로 텍스처 전체를 복사한다 — flush.content 스파이크의 원인 구조.
 * - "single": 그리기 전에 이전 스냅샷을 해제 (early-release — 추가 메모리 0)
 * - "ping-pong": 표면 2장 교대 — "그리는 표면 ≠ 스냅샷 표면" 구조 보장
 *   (content surface 1장분 GPU 메모리 추가 — G3 상한에 포함)
 *
 * 2026-07-28 live 실측 (zoom 오실레이션 150틱, flush.content):
 *   single(early-release) mean 0.43 / p95 1.6 / p99 5.4 / max 7.2ms
 *   ping-pong             mean 0.16 / p95 0.3 / p99 0.3 / max 0.4ms
 * → tail(p99/max) 13~18배 차이로 ping-pong 확정. early-release 만으로는 이전
 * 프레임 blit 이 읽는 동일 텍스처 재기록 대기(stall)가 잔존한다.
 * dev 는 `window.__composition_SNAPSHOT_POLICY__` 로 전환 가능.
 */
type SnapshotPolicy = "single" | "ping-pong";
const DEFAULT_SNAPSHOT_POLICY: SnapshotPolicy = "ping-pong";

export class SkiaRenderer {
  private ck: CanvasKit;
  private contentNode: SkiaRenderable | null = null;
  private overlayNode: SkiaRenderable | null = null;
  private disposed = false;
  private dpr: number;

  /** Content Surface 패딩 (CSS px) — camera-only blit 가장자리 아티팩트 방지 */
  private readonly contentPaddingCssPx = 512;
  /** DPR 반영된 패딩 (device px) */
  private contentPaddingDevicePx = 0;

  /**
   * Snapshot(blit) 리샘플링 정책
   *
   * Pencil은 zoom mismatch 시 drawImageCubic 계열로 보간을 사용하는 것으로 알려져 있다.
   * composition도 zoomRatio != 1인 경우(스케일링 발생)에 cubic 보간을 우선 사용한다.
   *
   * Mitchell-Netravali (B=C=1/3): 일반적인 UI 확대/축소에 무난한 기본값.
   */
  private readonly snapshotCubicResampler = { b: 1 / 3, c: 1 / 3 };

  // ============================================
  // Main Surface (화면 표시)
  // ============================================
  private mainSurface: Surface;
  private mainCanvas: Canvas;

  // ============================================
  // Content Surface (Phase 6: 오프스크린 캐시)
  // ============================================
  private contentSurface: Surface | null = null;
  private contentCanvas: Canvas | null = null;
  private contentSnapshot: Image | null = null;
  /** ping-pong 정책 전용 대기 표면 (lazy 생성) — 그리는 표면 ≠ 스냅샷 표면 보장 */
  private standbySurface: Surface | null = null;
  private standbyCanvas: Canvas | null = null;
  private contentDirty = true;
  private lastRegistryVersion = -1;
  private lastOverlayVersion = -1;
  private lastScreenOverlayVersion = -1;
  /** 프레임 분류용 — 매 프레임 갱신 */
  private lastCamera: CameraState = { zoom: 1, panX: 0, panY: 0 };
  /** 스냅샷 캡처 시점의 카메라 — camera-only blit 델타 기준점 */
  private snapshotCamera: CameraState = { zoom: 1, panX: 0, panY: 0 };

  // ============================================
  // Cleanup Render (Pencil debouncedMoveEnd 패턴)
  // ============================================
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private needsCleanupRender = false;

  // ============================================
  // Dev instrumentation
  // ============================================
  private devContentRenderCount = 0;
  private devContentRenderWindowStartMs = 0;
  private devFrameCount = 0;
  private devIdleFrameCount = 0;
  private devFrameWindowStartMs = 0;

  /**
   * Active transition이 있는 경우 idle 프레임을 content로 승격시키기 위한 참조.
   * StoreRenderBridge가 주입. null이면 transition 미사용.
   */
  public transitionManager: TransitionManager | null = null;
  public animationEngine: AnimationEngine | null = null;

  /** GPU 프레임 시간 측정 (dev 전용 — production 은 null 유지, ADR-153 Phase 1-c) */
  private gpuTimer: GpuTimer | null = null;

  constructor(ck: CanvasKit, htmlCanvas: HTMLCanvasElement, dpr?: number) {
    this.ck = ck;
    this.dpr = dpr ?? (window.devicePixelRatio || 1);
    this.contentPaddingDevicePx = Math.round(
      this.contentPaddingCssPx * this.dpr,
    );
    this.mainSurface = createGPUSurface(ck, htmlCanvas);
    this.mainCanvas = this.mainSurface.getCanvas();

    if (process.env.NODE_ENV === "development") {
      this.devContentRenderWindowStartMs = performance.now();
      this.devFrameWindowStartMs = this.devContentRenderWindowStartMs;
      // CanvasKit 이 획득한 동일 canvas 의 webgl2 컨텍스트를 재사용한다.
      // webgl1 폴백/SW surface 면 supported=false 로 전체 no-op.
      this.gpuTimer = new GpuTimer(htmlCanvas);
    }
  }

  /** 컨텐츠(디자인 노드) 렌더러를 설정한다. */
  setContentNode(node: SkiaRenderable | null): void {
    this.contentNode = node;
  }

  /** 오버레이(Selection/AI) 렌더러를 설정한다. */
  setOverlayNode(node: SkiaRenderable | null): void {
    this.overlayNode = node;
  }

  /** 컨텐츠 캐시를 무효화하여 다음 프레임에서 전체 재렌더링하도록 한다. */
  invalidateContent(): void {
    this.contentDirty = true;
  }

  /** 메인 캔버스를 클리어한다 (페이지 전환/초기화용). */
  clearFrame(): void {
    // ADR-902: void 영역 투명화 — DotBackground 가 캔버스 뒤에서 노출되도록.
    // 페이지 body fill 은 element 트리 렌더 경로에서 유지된다.
    this.mainCanvas.clear(this.ck.Color4f(0, 0, 0, 0));
    this.mainSurface.flush();
  }

  // ============================================
  // Phase 6: 이중 Surface 렌더링
  // ============================================

  /**
   * 프레임을 분류하여 최적 렌더 경로를 결정한다.
   *
   * 컨텐츠는 contentSurface에 캐시하고, 화면 표시는
   * snapshot blit + 오버레이를 mainSurface에 덧그린다.
   */
  private classifyFrame(
    registryVersion: number,
    camera: CameraState,
    overlayVersion: number,
    screenOverlayVersion: number,
  ): FrameClassification {
    // reason 문자열은 contentSurface 캐시 miss 사유 분류 (ADR-153 Phase 1-a).
    if (this.contentDirty) return { type: "full", reason: "invalidate" };

    // Cleanup render — 모션 종료 후 200ms 디바운스 full quality 재렌더링
    if (this.needsCleanupRender) {
      this.needsCleanupRender = false;
      return { type: "full", reason: "cleanup" };
    }

    const registryChanged = registryVersion !== this.lastRegistryVersion;
    const overlayChanged = overlayVersion !== this.lastOverlayVersion;
    const screenOverlayChanged =
      screenOverlayVersion !== this.lastScreenOverlayVersion;
    const cameraChanged =
      camera.zoom !== this.lastCamera.zoom ||
      camera.panX !== this.lastCamera.panX ||
      camera.panY !== this.lastCamera.panY;

    if (registryChanged) {
      return { type: "content", reason: "registry" };
    }
    if (cameraChanged) {
      if (!this.contentSnapshot) {
        return { type: "content", reason: "no-snapshot" };
      }

      // Pencil 모델: 팬/줌 중에는 snapshot blit(camera-only)으로 즉시 응답한다.
      //
      // 단, 아래 조건에서는 "현재 스냅샷으로는 품질/커버리지를 유지할 수 없다"고 보고
      // 즉시 content를 재렌더링한다. (Pencil의 redrawContentIfNeeded() 패턴)
      //
      // 1) zoom in이 스냅샷 캡처 시점 대비 너무 커짐 → 리샘플링 blur/디테일 손실
      // 2) 스냅샷(패딩 포함)이 현재 뷰포트를 완전히 덮지 못함 → 빈 영역/가장자리 아티팩트
      const zoomTooLarge = camera.zoom > this.snapshotCamera.zoom * 3;
      if (zoomTooLarge) {
        return { type: "content", reason: "zoom-refresh" };
      }
      if (!this.canBlitWithCameraTransform(camera)) {
        return { type: "content", reason: "coverage-refresh" };
      }

      // 모션 종료 후 200ms에 1회 full render로 최종 품질을 정리한다.
      // (zoom mismatch 보간, 서브픽셀 이동에 대한 cleanup)
      this.scheduleCleanupRender();
      return { type: "camera-only", reason: null };
    }
    if (overlayChanged || screenOverlayChanged) {
      return { type: "present", reason: null };
    }
    return { type: "idle", reason: null };
  }

  private tickDevMetrics(nowMs: number): void {
    if (process.env.NODE_ENV !== "development") return;

    if (this.devContentRenderWindowStartMs <= 0) {
      this.devContentRenderWindowStartMs = nowMs;
      this.devContentRenderCount = 0;
      return;
    }

    const elapsed = nowMs - this.devContentRenderWindowStartMs;
    if (elapsed < 1000) return;

    const perSec = this.devContentRenderCount / (elapsed / 1000);
    recordWasmMetric("contentRendersPerSec", perSec);
    // CanvasSync 스토어로 플러시하여 dev overlay/monitor에서 확인 가능하게 한다.
    flushWasmMetrics();

    this.devContentRenderWindowStartMs = nowMs;
    this.devContentRenderCount = 0;
  }

  /**
   * Cleanup render를 200ms 후로 예약한다.
   *
   * Pencil의 debouncedMoveEnd(200ms) → invalidateContent() 패턴.
   * 카메라 모션/콘텐츠 변경 종료 후 full quality 재렌더링으로
   * camera-only blit의 가장자리 아티팩트를 보정한다.
   */
  private scheduleCleanupRender(): void {
    if (this.cleanupTimer) clearTimeout(this.cleanupTimer);
    this.cleanupTimer = setTimeout(() => {
      this.needsCleanupRender = true;
      this.cleanupTimer = null;
    }, 200);
  }

  private cancelCleanupRender(): void {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.needsCleanupRender = false;
  }

  private canBlitWithCameraTransform(camera: CameraState): boolean {
    if (!this.contentSnapshot) return false;

    const mainW = this.mainSurface.width();
    const mainH = this.mainSurface.height();
    if (mainW <= 0 || mainH <= 0) return false;

    const pad = this.contentPaddingDevicePx;
    const zoomRatio = camera.zoom / this.snapshotCamera.zoom;
    const tx = (camera.panX - this.snapshotCamera.panX * zoomRatio) * this.dpr;
    const ty = (camera.panY - this.snapshotCamera.panY * zoomRatio) * this.dpr;

    // 변환된 스냅샷 이미지가 메인 캔버스를 완전히 덮는지 확인한다.
    // base = -pad 이고 contentSize = main + 2*pad 이므로:
    // left = -pad*r + tx, right = (mainW + pad)*r + tx
    const left = -pad * zoomRatio + tx;
    const top = -pad * zoomRatio + ty;
    const right = (mainW + pad) * zoomRatio + tx;
    const bottom = (mainH + pad) * zoomRatio + ty;

    const margin = 1; // 1px 여유 (부동소수점 오차)
    return (
      left <= margin &&
      top <= margin &&
      right >= mainW - margin &&
      bottom >= mainH - margin
    );
  }

  /**
   * Content Surface를 초기화한다.
   * mainSurface보다 큰 오프스크린 Surface를 생성하여 camera-only blit 시
   * 가장자리 아티팩트를 방지한다.
   *
   * mainSurface.makeSurface()로 **동일 백엔드(GPU/SW)** 의 호환 Surface를 생성한다.
   * (ck.MakeSurface는 raster-direct(CPU) surface를 만들어 content render 비용이 커질 수 있으므로 사용하지 않는다.)
   */
  private initContentSurface(): void {
    this.disposeContentSurface();

    this.contentSurface = this.createContentSizedSurface();
    this.contentCanvas = this.contentSurface.getCanvas();
    this.contentDirty = true;
  }

  /**
   * content 규격(main + padding×2) 오프스크린 표면 생성.
   * ping-pong 이후 content/standby 는 교대하는 peer 이므로 규격 결정은 한 곳에 둔다.
   */
  private createContentSizedSurface(): Surface {
    return this.mainSurface.makeSurface({
      ...this.mainSurface.imageInfo(),
      width: this.mainSurface.width() + this.contentPaddingDevicePx * 2,
      height: this.mainSurface.height() + this.contentPaddingDevicePx * 2,
    });
  }

  /** 스냅샷 정책 해석 — dev 는 window 전역으로 실측 전환 가능 (production 은 default 고정) */
  private resolveSnapshotPolicy(): SnapshotPolicy {
    if (process.env.NODE_ENV === "development") {
      const override = (window as unknown as Record<string, unknown>)
        .__composition_SNAPSHOT_POLICY__;
      if (override === "single" || override === "ping-pong") return override;
    }
    return DEFAULT_SNAPSHOT_POLICY;
  }

  /** ping-pong 대기 표면 lazy 생성 (contentSurface 와 동일 규격/백엔드) */
  private ensureStandbySurface(): void {
    if (this.standbySurface || !this.contentSurface) return;
    this.standbySurface = this.createContentSizedSurface();
    this.standbyCanvas = this.standbySurface.getCanvas();
  }

  /**
   * Content Surface에 씬을 렌더링한다.
   */
  private renderContent(cullingBounds: DOMRect, camera: CameraState): void {
    if (!this.contentCanvas || !this.contentSurface || !this.contentNode)
      return;

    if (process.env.NODE_ENV === "development") {
      this.devContentRenderCount++;
    }

    // content/full 렌더가 수행되면 cleanup 목적(최종 품질 정리)이 충족되므로 예약을 취소한다.
    // (카메라 모션 도중 스타일 변경 등이 겹쳤을 때, 모션 종료 후 불필요한 추가 full render 방지)
    this.cancelCleanupRender();

    const isDev = process.env.NODE_ENV === "development";
    const start = performance.now();

    // 스냅샷 정책 (ADR-153 Phase 3 — R7): CoW 복사 회피
    const policy = this.resolveSnapshotPolicy();
    if (policy === "ping-pong") this.ensureStandbySurface();
    // 대기 표면이 없으면(single 정책 또는 생성 실패) content 표면에 직접 그린다
    const standby =
      policy === "ping-pong" && this.standbySurface && this.standbyCanvas
        ? { surface: this.standbySurface, canvas: this.standbyCanvas }
        : null;
    const targetSurface = standby ? standby.surface : this.contentSurface;
    const targetCanvas = standby ? standby.canvas : this.contentCanvas;

    if (targetSurface === this.contentSurface && this.contentSnapshot) {
      // early-release: 스냅샷이 살아 있는 채로 그 표면에 그리면 Ganesh 가
      // 텍스처 전체를 copy-on-write 복사한다 — 그리기 전에 해제한다.
      this.contentSnapshot.delete();
      this.contentSnapshot = null;
    }

    // 전체 콘텐츠 렌더링 (Pencil 방식: content invalidation은 full rerender)
    const padCss = this.contentPaddingDevicePx / this.dpr;
    const padScene = padCss / Math.max(camera.zoom, 0.001);
    const paddedBounds = new DOMRect(
      cullingBounds.x - padScene,
      cullingBounds.y - padScene,
      cullingBounds.width + padScene * 2,
      cullingBounds.height + padScene * 2,
    );

    // 투명 배경으로 클리어 — 그리드가 콘텐츠 아래(main canvas)에서 보이도록
    // 배경색은 present()에서 main canvas에 적용한다.
    targetCanvas.clear(this.ck.Color4f(0, 0, 0, 0));
    targetCanvas.save();
    targetCanvas.scale(this.dpr, this.dpr);
    targetCanvas.translate(padCss, padCss);
    targetCanvas.translate(camera.panX, camera.panY);
    targetCanvas.scale(camera.zoom, camera.zoom);
    // ADR-153 Phase 1-e: 씬 재기록 (WASM CPU) 구간 분해 라벨
    const recordBegin = isDev ? markBegin() : 0;
    this.contentNode.renderSkia(targetCanvas, paddedBounds);
    if (isDev) {
      markEnd(PERF_LABEL.RENDER_SKIA_RECORD_CONTENT, recordBegin);
      // ADR-153 Phase 1-b: 이번 content 렌더의 커맨드/드로콜 수 회수
      const stats = takeDrawStats();
      recordWasmMetric("commandCount", stats.commands);
      recordWasmMetric("drawCallCount", stats.draws);
    }
    targetCanvas.restore();

    // 콘텐츠 스냅샷 생성
    // ADR-153 Phase 1-e: Ganesh op 실행 + snapshot 구간 분해 라벨 (격차 5 감시 지표)
    const flushBegin = isDev ? markBegin() : 0;
    this.contentSnapshot?.delete(); // ping-pong: 반대 표면의 이전 스냅샷 해제
    targetSurface.flush();
    this.contentSnapshot = targetSurface.makeImageSnapshot();
    if (isDev) {
      markEnd(PERF_LABEL.RENDER_SKIA_FLUSH_CONTENT, flushBegin);
    }

    // ping-pong swap — "스냅샷은 항상 this.contentSurface 를 참조" 불변식 유지
    if (standby) {
      [this.contentSurface, this.standbySurface] = [
        this.standbySurface,
        this.contentSurface,
      ];
      [this.contentCanvas, this.standbyCanvas] = [
        this.standbyCanvas,
        this.contentCanvas,
      ];
    }

    this.snapshotCamera.zoom = camera.zoom; // camera-only blit 델타 기준점 갱신
    this.snapshotCamera.panX = camera.panX;
    this.snapshotCamera.panY = camera.panY;
    this.contentDirty = false;

    if (isDev) {
      recordWasmMetric("contentRenderTime", performance.now() - start);
    }
  }

  /**
   * Content 스냅샷을 Main Surface에 블리팅한다 (flush는 호출자가 수행).
   */
  private blitToMainNoFlush(): void {
    if (!this.contentSnapshot) return;

    // clear는 present()에서 수행 (그리드가 콘텐츠 아래에 위치하도록)
    this.mainCanvas.drawImage(
      this.contentSnapshot,
      -this.contentPaddingDevicePx,
      -this.contentPaddingDevicePx,
    );
  }

  /**
   * Phase 4: 카메라만 변경된 프레임에서 캐시된 스냅샷에 아핀 변환만 적용한다.
   *
   * content re-render 없이 이전 스냅샷을 카메라 델타만큼 이동/스케일하여
   * ~1ms 이내로 프레임을 완성한다.
   * 가장자리 아티팩트는 Cleanup Render(Phase 1)로 200ms 후 보정된다.
   */
  private blitWithCameraTransformNoFlush(camera: CameraState): void {
    if (!this.contentSnapshot) return;

    // clear는 present()에서 수행 (그리드가 콘텐츠 아래에 위치하도록)
    this.mainCanvas.save();

    // 스냅샷 픽셀 (px, py) → 새 위치로 변환:
    //   oldPixelX = (sceneX * oldZoom + oldPanX) * dpr
    //   newPixelX = (sceneX * newZoom + newPanX) * dpr
    // canvas.translate(tx, ty) → canvas.scale(r, r) 적용 시:
    //   newPixelX = oldPixelX * r + tx
    //   tx = (newPanX - oldPanX * r) * dpr
    const zoomRatio = camera.zoom / this.snapshotCamera.zoom;
    const tx = (camera.panX - this.snapshotCamera.panX * zoomRatio) * this.dpr;
    const ty = (camera.panY - this.snapshotCamera.panY * zoomRatio) * this.dpr;

    this.mainCanvas.translate(tx, ty);
    this.mainCanvas.scale(zoomRatio, zoomRatio);

    // zoom mismatch(스케일링) 시에는 cubic 보간을 사용해 선명도/계단 현상을 줄인다.
    // CanvasKit 타입 정의에 drawImageCubic이 없을 수 있어 런타임 존재 여부로 가드한다.
    const x = -this.contentPaddingDevicePx;
    const y = -this.contentPaddingDevicePx;
    const shouldUseCubic = Math.abs(zoomRatio - 1) > 1e-6;
    const anyCanvas = this.mainCanvas as unknown as {
      drawImageCubic?: (
        image: Image,
        x: number,
        y: number,
        b: number,
        c: number,
        paint?: unknown,
      ) => void;
    };

    if (shouldUseCubic && typeof anyCanvas.drawImageCubic === "function") {
      const { b, c } = this.snapshotCubicResampler;
      anyCanvas.drawImageCubic(this.contentSnapshot, x, y, b, c);
    } else {
      this.mainCanvas.drawImage(this.contentSnapshot, x, y);
    }
    this.mainCanvas.restore();
  }

  /**
   * 오버레이 노드 1개를 카메라 변환(DPR 스케일 + pan/zoom) 안에서 렌더링한다.
   *
   * 선택/호버 chrome(`overlayNode`)이 요소와 동일한 좌표계에서 동작하도록
   * 한다. 종전에는 씬 좌표계 그리드(`screenOverlayNode`)도 같은 변환
   * 시퀀스를 써서 한 루틴으로 묶여 있었고, 그리드 제거(2026-08-14) 후
   * 남은 소비자는 `overlayNode` 뿐이다.
   */
  private renderNodeWithCamera(
    node: SkiaRenderable | null,
    cullingBounds: DOMRect,
    camera: CameraState,
  ): void {
    if (!node) return;
    this.mainCanvas.save();
    this.mainCanvas.scale(this.dpr, this.dpr);
    this.mainCanvas.translate(camera.panX, camera.panY);
    this.mainCanvas.scale(camera.zoom, camera.zoom);
    node.renderSkia(this.mainCanvas, cullingBounds);
    this.mainCanvas.restore();
  }

  private present(cullingBounds: DOMRect, camera: CameraState): void {
    // 렌더링 순서: (투명 clear) → 콘텐츠 → 오버레이
    // ADR-902: void 영역 투명화로 전환. 페이지 배경은 element 트리의 body fill 로 유지,
    // canvas 뒤 DOM DotBackground 레이어가 void 영역에서 노출된다.
    this.mainCanvas.clear(this.ck.Color4f(0, 0, 0, 0));

    const cameraMatchesSnapshot =
      camera.zoom === this.snapshotCamera.zoom &&
      camera.panX === this.snapshotCamera.panX &&
      camera.panY === this.snapshotCamera.panY;

    const isDev = process.env.NODE_ENV === "development";
    const blitStart = isDev ? performance.now() : 0;
    if (cameraMatchesSnapshot) {
      this.blitToMainNoFlush();
    } else {
      this.blitWithCameraTransformNoFlush(camera);
    }
    if (isDev) {
      recordWasmMetric("blitTime", performance.now() - blitStart);
    }
    this.renderNodeWithCamera(this.overlayNode, cullingBounds, camera);
    // ADR-153 Phase 1-e: 화면 surface 제출 구간 분해 라벨
    const flushMainBegin = isDev ? markBegin() : 0;
    this.mainSurface.flush();
    if (isDev) {
      markEnd(PERF_LABEL.RENDER_SKIA_FLUSH_MAIN, flushMainBegin);
    }
  }

  /**
   * transition/animation 보간값을 SkiaNodeData에 직접 override한다.
   *
   * CSS 스펙에 따라 animation 값이 transition 값보다 우선한다.
   * 따라서 transition 먼저 적용 후 animation으로 덮어쓴다.
   *
   * @returns dirty 노드가 하나라도 있으면 true (프레임 승격용)
   */
  private applyAnimationOverrides(now: number): boolean {
    // Early exit: transition/animation 모두 비활성이면 Set 할당 없이 반환
    const tmActive = this.transitionManager?.isActive() ?? false;
    const aeActive = this.animationEngine?.isActive() ?? false;
    if (!tmActive && !aeActive) {
      setVolatileNodeIds(null);
      return false;
    }

    const dirtyTransition = tmActive
      ? this.transitionManager!.tick(now)
      : undefined;
    const dirtyAnimation = aeActive
      ? this.animationEngine!.tick(now)
      : undefined;

    // 둘 다 있으면 병합, 하나만 있으면 그대로 사용
    let allDirty: Set<string>;
    if (dirtyTransition && dirtyAnimation) {
      allDirty = new Set<string>(dirtyTransition);
      for (const id of dirtyAnimation) allDirty.add(id);
    } else {
      allDirty = dirtyTransition ?? dirtyAnimation ?? new Set<string>();
    }
    // 노드 Picture 캐시 volatile 면제 (ADR-153 Phase 3): tick 이 skiaData 를
    // in-place mutate 하는 노드는 identity 키가 변경을 못 보므로 캐시에서 제외.
    setVolatileNodeIds(allDirty); // 빈 집합 → null 정규화는 setter 가 수행
    if (allDirty.size === 0) return false;

    // transition(낮은 우선순위) → animation(높은 우선순위) 순으로 적용
    const sources = [this.transitionManager, this.animationEngine].filter(
      Boolean,
    ) as Array<{ getCurrentValue(id: string, prop: string): unknown }>;

    for (const elementId of allDirty) {
      const node = getSkiaNode(elementId);
      if (!node) continue;

      for (const source of sources) {
        const opacity = source.getCurrentValue(elementId, "opacity");
        if (typeof opacity === "number") {
          this.applyOpacityToNode(node, opacity);
        }

        const width = source.getCurrentValue(elementId, "width");
        if (typeof width === "number") node.width = width;

        const height = source.getCurrentValue(elementId, "height");
        if (typeof height === "number") node.height = height;

        const borderRadius = source.getCurrentValue(elementId, "borderRadius");
        if (typeof borderRadius === "number" && node.box) {
          node.box.borderRadius = borderRadius;
        }
      }
    }

    return true;
  }

  /**
   * SkiaNodeData의 effects 배열에 OpacityEffect를 추가하거나 기존 항목을 갱신한다.
   */
  private applyOpacityToNode(
    node: { effects?: Array<{ type: string; value?: number }> },
    opacity: number,
  ): void {
    if (!node.effects) node.effects = [];
    const existingIdx = node.effects.findIndex((e) => e.type === "opacity");
    const effect: OpacityEffect = { type: "opacity", value: opacity };
    if (existingIdx >= 0) {
      node.effects[existingIdx] = effect;
    } else {
      node.effects.push(effect);
    }
  }

  /**
   * 이중 Surface 모드로 한 프레임을 렌더링한다.
   *
   * 프레임 분류에 따라 최소 작업만 수행:
   * - idle → 스킵
   * - present → 캐시 blit + 오버레이
   * - camera-only → 캐시 blit(아핀) + 오버레이
   * - content/full → 컨텐츠 재렌더 + 캐시 갱신
   */
  private renderDualSurface(
    cullingBounds: DOMRect,
    registryVersion: number,
    camera: CameraState,
    overlayVersion: number,
    screenOverlayVersion = 0,
  ): void {
    if (this.disposed || !this.contentNode) return;

    const now = performance.now();
    this.tickDevMetrics(now);

    if (process.env.NODE_ENV === "development") {
      if (this.devFrameWindowStartMs <= 0) {
        this.devFrameWindowStartMs = now;
        this.devFrameCount = 0;
        this.devIdleFrameCount = 0;
      }
      this.devFrameCount++;
    }

    // Lazy init content surface
    if (!this.contentSurface) {
      this.initContentSurface();
      // Content surface 실패 시 레거시 폴백
      if (!this.contentSurface) {
        this.renderSingleSurface(cullingBounds, camera);
        return;
      }
    }

    const frameStart = now;
    const classification = this.classifyFrame(
      registryVersion,
      camera,
      overlayVersion,
      screenOverlayVersion,
    );
    let frameType = classification.type;
    let frameReason = classification.reason;

    // transition/animation 보간값을 SkiaNodeData에 override.
    // dirty 노드가 있으면 idle을 content로 승격하여 매 프레임 재렌더링.
    const hasAnimationChanges = this.applyAnimationOverrides(now);
    if (frameType === "idle" && hasAnimationChanges) {
      frameType = "content";
      frameReason = "animation";
    }

    // ADR-153 Phase 1-a: contentSurface 캐시 hit(스냅샷 재사용) / miss(재렌더 + 사유)
    if (process.env.NODE_ENV === "development") {
      if (frameType === "content" || frameType === "full") {
        getCacheMetrics("contentSurface").recordMiss(frameReason ?? "unknown");
      } else if (frameType === "present" || frameType === "camera-only") {
        getCacheMetrics("contentSurface").recordHit();
      }
    }

    // ADR-153 Phase 1-c: GPU 프레임 시간 — 직전 in-flight 결과 poll 후 이번 프레임 측정
    // (gpuTimer 는 dev 에서만 생성되므로 production 은 이 블록 전체가 no-op)
    if (frameType !== "idle" && this.gpuTimer) {
      const gpuMs = this.gpuTimer.poll();
      if (gpuMs !== null) recordWasmMetric("gpuFrameTime", gpuMs);
      this.gpuTimer.frameBegin();
    }

    switch (frameType) {
      case "idle":
        if (process.env.NODE_ENV === "development") {
          this.devIdleFrameCount++;
        }
        break;

      case "present":
      case "camera-only":
        this.present(cullingBounds, camera);
        break;

      case "content":
      case "full":
        this.renderContent(cullingBounds, camera);
        this.present(cullingBounds, camera);
        break;
    }

    if (frameType !== "idle") {
      this.gpuTimer?.frameEnd();
    }

    if (process.env.NODE_ENV === "development" && frameType !== "idle") {
      recordWasmMetric("skiaFrameTime", performance.now() - frameStart);
    }

    if (process.env.NODE_ENV === "development") {
      const elapsed = performance.now() - this.devFrameWindowStartMs;
      if (elapsed >= 1000 && this.devFrameCount > 0) {
        const ratio = this.devIdleFrameCount / this.devFrameCount;
        const nonIdle = this.devFrameCount - this.devIdleFrameCount;
        const presentsPerSec = nonIdle / (elapsed / 1000);
        recordWasmMetric("idleFrameRatio", ratio);
        recordWasmMetric("presentFramesPerSec", presentsPerSec);
        flushWasmMetrics();
        this.devFrameWindowStartMs = performance.now();
        this.devFrameCount = 0;
        this.devIdleFrameCount = 0;
      }
    }

    this.lastRegistryVersion = registryVersion;
    this.lastOverlayVersion = overlayVersion;
    this.lastScreenOverlayVersion = screenOverlayVersion;
    this.lastCamera.zoom = camera.zoom;
    this.lastCamera.panX = camera.panX;
    this.lastCamera.panY = camera.panY;
  }

  // ============================================
  // Phase 5: 레거시 단일 Surface 렌더링
  // ============================================

  /**
   * 단일 Surface로 한 프레임을 렌더링한다.
   *
   * content surface 생성 실패 시 `renderDualSurface` 가 폴백으로 호출하는
   * **현역 경로** — 이름의 "legacy" 가 지원 중단을 뜻하지 않는다.
   * (구 `DUAL_SURFACE_CACHE` 플래그 조건은 제거됨 — dual surface 는 상시 경로)
   */
  private renderSingleSurface(
    cullingBounds: DOMRect,
    camera: CameraState,
  ): void {
    if (this.disposed || !this.contentNode) return;

    const start = performance.now();

    // ADR-902: void 영역 투명화. 페이지 body fill 은 element 트리에서 유지.
    this.mainCanvas.clear(this.ck.Color4f(0, 0, 0, 0));
    this.mainCanvas.save();
    this.mainCanvas.scale(this.dpr, this.dpr);
    this.mainCanvas.translate(camera.panX, camera.panY);
    this.mainCanvas.scale(camera.zoom, camera.zoom);
    this.contentNode.renderSkia(this.mainCanvas, cullingBounds);
    if (this.overlayNode) {
      this.overlayNode.renderSkia(this.mainCanvas, cullingBounds);
    }
    this.mainCanvas.restore();
    this.mainSurface.flush();

    if (process.env.NODE_ENV === "development") {
      recordWasmMetric("skiaFrameTime", performance.now() - start);
    }
  }

  /**
   * 통합 렌더 진입점.
   *
   * Feature Flag에 따라 이중 Surface 또는 레거시 모드를 선택한다.
   * SkiaOverlay에서 호출한다.
   */
  render(
    cullingBounds: DOMRect,
    registryVersion: number,
    camera: CameraState,
    overlayVersion: number,
    screenOverlayVersion = 0,
  ): void {
    try {
      this.renderDualSurface(
        cullingBounds,
        registryVersion,
        camera,
        overlayVersion,
        screenOverlayVersion,
      );
    } finally {
      // 프레임 중 캐시 퇴거가 미뤄 둔 WASM 폐기(Paragraph/SkPicture)를 모든
      // surface flush 뒤에 일괄 수행한다. flush 전 delete 는 deferred draw 의
      // use-after-free — 해당 텍스트/노드가 화면에서 조용히 소실된다 (ADR-174).
      drainPendingWasmDisposals();
    }
  }

  // ============================================
  // 리사이즈 / 리소스 관리
  // ============================================

  /**
   * Surface를 새 크기로 재생성한다.
   */
  resize(htmlCanvas: HTMLCanvasElement): void {
    if (this.disposed) return;

    // DPR 갱신 — 외부 모니터 이동 등으로 변경될 수 있음 (I-H4)
    this.dpr = window.devicePixelRatio || 1;
    this.contentPaddingDevicePx = Math.round(
      this.contentPaddingCssPx * this.dpr,
    );

    // Content surface 정리
    this.disposeContentSurface();

    // Main surface 재생성
    this.mainSurface.delete();
    this.mainSurface = createGPUSurface(this.ck, htmlCanvas);
    this.mainCanvas = this.mainSurface.getCanvas();

    // Content surface는 다음 render()에서 lazy 재생성
    this.contentDirty = true;
  }

  private disposeContentSurface(): void {
    this.contentSnapshot?.delete();
    this.contentSnapshot = null;
    this.contentSurface?.delete();
    this.contentSurface = null;
    this.contentCanvas = null;
    this.standbySurface?.delete();
    this.standbySurface = null;
    this.standbyCanvas = null;
  }

  /** 내부 Canvas 인스턴스 (직접 그리기용) */
  getCanvas(): Canvas {
    return this.mainCanvas;
  }

  /** 내부 Surface 인스턴스 */
  getSurface(): Surface {
    return this.mainSurface;
  }

  /** 모든 리소스 해제 */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.gpuTimer?.dispose();
    this.gpuTimer = null;
    this.disposeContentSurface();
    this.mainSurface.delete();
    // 마지막 프레임이 미뤄 둔 폐기가 남아 있을 수 있다 — 프레임 밖이므로 즉시 배수
    drainPendingWasmDisposals();
  }
}
