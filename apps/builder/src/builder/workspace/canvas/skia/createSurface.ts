/**
 * CanvasKit Surface 생성 — WebGL context 의 소유자 (ADR-273 Phase 2)
 *
 * 화면 canvas 의 GL context 와 `GrDirectContext` 를 이 파일이 만들고 지운다. 이전에는
 * `MakeWebGLCanvasSurface(canvas)` 가 호출마다 (첫 생성 · resize · 복원) 새 GL 핸들과 GrDirectContext 를
 * 만들고 옛 것은 지우지 않았다 — 핸들이 쌓이고, 캐시 한도를 걸 context 가 하나가 아니었다.
 * 이제 산 context 는 resize 에서 재사용하고, 소실된 context 는 복원 때 지운 뒤 새로 만든다.
 *
 * @see docs/RENDERING_ARCHITECTURE.md §5.2 Surface 생성
 */

import type {
  CanvasKit,
  GrDirectContext,
  Surface,
  WebGLContextHandle,
} from "canvaskit-wasm";
import { renderCounters, renderDebug } from "./renderCounters";

export type SurfaceBackend = "gpu" | "sw";

/** 소유한 GL context 의 상태 — dev 전역 · 하니스가 읽는다. */
export interface GpuContextStats {
  backend: SurfaceBackend;
  /** 지금 살아 있는 GrDirectContext 수 (0 또는 1 — 옛 경로 `legacySurface` 는 셀 수 없다). */
  liveContexts: number;
  /** 이 소유자가 만든 · 지운 GL 핸들 수 (첫 생성 + 복원마다 +1 · 지움은 복원 · dispose). */
  contextsCreated: number;
  contextsDeleted: number;
  /** 첫 context 를 만든 직후 읽은 Skia 기본 한도 (setter 전 — 사용자 결정 2 의 기준값). */
  defaultLimitBytes: number | null;
  limitBytes: number | null;
  usageBytes: number | null;
}

/** canvaskit 0.42.0 의 embind 원 메서드 — d.ts 에 없다. */
interface GrContextNative {
  _getResourceCacheLimitBytes(): number;
  _getResourceCacheUsageBytes(): number;
}

/**
 * GrDirectContext 의 캐시 바이트를 읽는다. canvaskit 0.42.0 의 JS 래퍼
 * (`GrDirectContext.prototype.getResourceCacheLimitBytes` · `…UsageBytes`) 는 context 를 현재로 맞춘 뒤
 * embind 결과를 `return` 하지 않아 늘 `undefined` 다 (`bin/canvaskit.js`). 래퍼로 현재 context 를 맞추고
 * 원 메서드로 값을 읽는다.
 */
function readCacheBytes(gr: GrDirectContext, which: "limit" | "usage"): number {
  const native = gr as unknown as GrContextNative;
  if (which === "limit") {
    gr.getResourceCacheLimitBytes();
    return native._getResourceCacheLimitBytes();
  }
  gr.getResourceCacheUsageBytes();
  return native._getResourceCacheUsageBytes();
}

/**
 * 화면 canvas 하나의 GL context · GrDirectContext · surface 생성을 맡는다.
 *
 * - `makeSurface()`: 산 context 가 있으면 그 위에 새 크기의 onscreen surface 를 만든다 (텍스처 · glyph atlas
 *   유지). 없거나 소실됐으면 옛 핸들을 지운 뒤 새로 만든다 — 옛 핸들 삭제가 먼저다: emscripten 의
 *   `deleteContext` 는 canvas 에 붙은 최신 context 기록 (`canvas.GLctxObject`) 을 지운다.
 * - `contextLost()`: `webglcontextlost` 때 GrDirectContext 를 abandon 한다 (GL 호출 없이 자원 포기).
 *   abandon 된 context 를 다시 쓰면 `MakeOnScreenGLSurface` 가 null 이라 조용히 실패한다 (R5) — 그래서
 *   다음 `makeSurface()` 가 새로 만든다.
 * - GL context 를 아예 얻지 못하면 (WebGL 미지원) SW surface 로 폴백한다. GL context 가 붙은 canvas 에는
 *   2D context 를 얻을 수 없어 그 뒤의 폴백은 없다.
 *
 * 호출 순서: surface 를 만든 쪽 (renderer) 이 옛 surface 를 지운 뒤 `makeSurface()` 를 부른다.
 */
export class CanvasSurfaceOwner {
  private handle: WebGLContextHandle | null = null;
  private grContext: GrDirectContext | null = null;
  private abandoned = false;
  /** 소실 뒤 `webglcontextrestored` 를 아직 받지 않았다 — 이 동안은 새 context 를 만들지 않는다. */
  private awaitingRestore = false;
  private backend: SurfaceBackend = "gpu";
  private created = 0;
  private deleted = 0;
  private defaultLimit: number | null = null;

  constructor(
    private readonly ck: CanvasKit,
    private canvas: HTMLCanvasElement,
    /** GrDirectContext resource cache 한도 — null 이면 Skia 기본을 둔다. */
    private readonly cacheLimitBytes: number | null,
  ) {}

  /**
   * `canvas` 의 지금 크기 (`width` · `height` — device px) 로 surface 를 만든다.
   * ⚠️ 호출 전에 canvas.width/height 를 디바이스 픽셀 크기로 설정할 것.
   */
  makeSurface(canvas: HTMLCanvasElement = this.canvas): Surface {
    if (canvas !== this.canvas) {
      this.releaseContext();
      this.canvas = canvas;
    }
    if (process.env.NODE_ENV === "development" && renderDebug.legacySurface) {
      // 옛 경로 (픽셀 대조 전용): 호출마다 새 context, 옛 것은 남는다.
      this.releaseContext();
      const legacy = this.ck.MakeWebGLCanvasSurface(canvas);
      if (legacy) return legacy;
      return this.softwareSurface(canvas);
    }
    if (this.abandoned) this.releaseContext();
    if (!this.grContext) {
      const surface = this.createContext(canvas);
      if (surface) return surface;
    } else {
      const surface = this.onScreenSurface(canvas);
      if (surface) return surface;
    }
    return this.softwareSurface(canvas);
  }

  /** `webglcontextlost` — GL 호출 없이 자원을 포기하고 다음 `makeSurface()` 가 새 context 를 만들게 한다. */
  contextLost(): void {
    this.awaitingRestore = true;
    if (!this.grContext || this.abandoned) return;
    this.grContext.releaseResourcesAndAbandonContext();
    this.abandoned = true;
  }

  /** `webglcontextrestored` — 다음 `makeSurface()` 부터 새 context 를 만들 수 있다. */
  contextRestored(): void {
    this.awaitingRestore = false;
  }

  /** 소실 뒤 복원을 기다리는 중 — surface 를 만들지 않는다. */
  isAwaitingRestore(): boolean {
    return this.awaitingRestore;
  }

  getGrContext(): GrDirectContext | null {
    return this.abandoned ? null : this.grContext;
  }

  stats(): GpuContextStats {
    const live = this.getGrContext();
    return {
      backend: this.backend,
      liveContexts: live ? 1 : 0,
      contextsCreated: this.created,
      contextsDeleted: this.deleted,
      defaultLimitBytes: this.defaultLimit,
      limitBytes: live ? readCacheBytes(live, "limit") : null,
      usageBytes: live ? readCacheBytes(live, "usage") : null,
    };
  }

  /** 프레임 끝에서 캐시 사용량을 한 번 읽어 고수위 · 한도 근접 프레임을 센다 (dev 전용). */
  sampleUsage(): void {
    const live = this.getGrContext();
    if (!live) return;
    const usage = readCacheBytes(live, "usage");
    if (usage > renderCounters.grCacheUsageMax)
      renderCounters.grCacheUsageMax = usage;
    if (usage > 0.9 * readCacheBytes(live, "limit"))
      renderCounters.grCacheNearLimitFrames += 1;
  }

  dispose(): void {
    this.releaseContext();
  }

  private createContext(canvas: HTMLCanvasElement): Surface | null {
    // `MakeWebGLCanvasSurface(canvas)` 와 같은 순서 · 같은 기본값 (`bin/canvaskit.js`): GetWebGLContext 에
    // 옵션 없이 (alpha · depth · stencil 8 · antialias 0 · premultipliedAlpha · preserveDrawingBuffer 0 ·
    // WebGL2 우선), onscreen surface 의 colorSpace 는 null (sRGB), sampleCount · stencil 은 context 에서 읽는다.
    const handle = this.ck.GetWebGLContext(canvas);
    if (!handle || handle < 0) return null;
    const grContext = this.ck.MakeWebGLContext(handle);
    if (!grContext) {
      this.ck.deleteContext(handle);
      return null;
    }
    this.handle = handle;
    this.grContext = grContext;
    this.abandoned = false;
    this.backend = "gpu";
    this.created += 1;
    if (process.env.NODE_ENV === "development")
      renderCounters.gpuContextsCreated += 1;
    this.defaultLimit ??= readCacheBytes(grContext, "limit");
    if (this.cacheLimitBytes !== null)
      grContext.setResourceCacheLimitBytes(this.cacheLimitBytes);
    const surface = this.onScreenSurface(canvas);
    if (!surface)
      throw new Error(
        "CanvasKit onscreen surface 생성 불가 — GL context 는 얻었으나 surface 가 null.",
      );
    return surface;
  }

  private onScreenSurface(canvas: HTMLCanvasElement): Surface | null {
    return this.ck.MakeOnScreenGLSurface(
      this.grContext!,
      canvas.width,
      canvas.height,
      null as unknown as Parameters<CanvasKit["MakeOnScreenGLSurface"]>[3],
    );
  }

  private softwareSurface(canvas: HTMLCanvasElement): Surface {
    console.warn("[Skia] WebGL surface 생성 실패, SW 폴백");
    this.backend = "sw";
    const swSurface = this.ck.MakeSWCanvasSurface(canvas);
    if (swSurface) return swSurface;
    throw new Error(
      "CanvasKit Surface 생성 불가. WebGL/SW 모두 실패. " +
        "브라우저가 WebGL을 지원하는지 확인하세요.",
    );
  }

  /** GrDirectContext 를 지우고 GL 핸들을 해제한다 (abandon 됐으면 GL 호출 없이). */
  private releaseContext(): void {
    if (this.grContext) {
      if (!this.grContext.isDeleted()) this.grContext.delete();
      this.grContext = null;
    }
    if (this.handle !== null) {
      this.ck.deleteContext(this.handle);
      this.handle = null;
      this.deleted += 1;
      if (process.env.NODE_ENV === "development")
        renderCounters.gpuContextsDeleted += 1;
    }
    this.abandoned = false;
  }
}

/**
 * WebGL 컨텍스트 손실/복원 이벤트를 감시한다.
 *
 * GPU 드라이버 충돌, 메모리 부족, 백그라운드 전환 등으로
 * WebGL 컨텍스트가 손실되면 onLost 콜백을 호출하고,
 * 브라우저가 컨텍스트를 복원하면 onRestored 콜백을 호출한다.
 *
 * @returns cleanup 함수 (이벤트 리스너 해제)
 */
export function watchContextLoss(
  canvas: HTMLCanvasElement,
  onLost: () => void,
  onRestored: () => void,
): () => void {
  const handleLost = (e: Event) => {
    e.preventDefault(); // 브라우저에 복원 의도를 알림
    console.warn("[Skia] WebGL 컨텍스트 손실");
    onLost();
  };
  const handleRestored = () => {
    console.log("[Skia] WebGL 컨텍스트 복원");
    onRestored();
  };

  canvas.addEventListener("webglcontextlost", handleLost);
  canvas.addEventListener("webglcontextrestored", handleRestored);

  return () => {
    canvas.removeEventListener("webglcontextlost", handleLost);
    canvas.removeEventListener("webglcontextrestored", handleRestored);
  };
}
