/**
 * GPU Backend Abstraction Interface
 *
 * Provides a unified interface for canvas rendering across multiple GPU backends
 * (CanvasKit/Skia, WebGPU, etc.). This enables future WebGPU migration without
 * breaking existing rendering code.
 *
 * See: ADR-100 GPU Backend Migration
 *
 * ---
 * **미배선 — 의도된 보존** (2026-08-15 잔재 스윕 확인)
 *
 * 이 인터페이스와 `CanvasKitWebGLBackend` 는 라이브 경로에 배선되어 있지 않다
 * (인스턴스화 0건, import 0건). 현행 렌더는 `SkiaRenderer` + `createSurface` 가
 * 직접 담당한다. **삭제 대상이 아니다** — ADR-900 §Consequences/Positive 가
 * "WebGPU 마이그레이션 경로 → GPU 백엔드 추상화로 향후 WebGPU 전환 비용 최소화"
 * 를 명시적 이득으로 채택했다. 참조 0건 grep 만 보고 지우지 말 것.
 *
 * 주의: `CanvasKitWebGLBackend.watchContextLoss` 는 살아 있는 컨텍스트 손실
 * 경로(`skia/createSurface.ts` + `SkiaCanvas`)와 **별개의 미배선 사본**이다.
 * 손실 처리를 고칠 때 이쪽을 고치고 있지 않은지 확인할 것.
 */

/**
 * Represents a GPU surface for rendering.
 *
 * A surface is the target for drawing operations. It can be backed by
 * an HTMLCanvasElement, an offscreen context, or a WebGPU surface.
 */
export interface GPUSurface {
  /** Width of the surface in pixels */
  readonly width: number;

  /** Height of the surface in pixels */
  readonly height: number;

  /**
   * Returns the native canvas-like object.
   * - For CanvasKit: CanvasKit.Canvas
   * - For WebGPU: GPUCanvasContext
   * - Type is `unknown` to avoid tight coupling to specific APIs
   */
  getCanvas(): unknown;

  /**
   * Creates an image snapshot of the current surface contents.
   * Useful for testing, debugging, or exporting rendered output.
   *
   * Returns: CanvasKit.Image or equivalent GPU-backed image object
   */
  makeImageSnapshot(): unknown;

  /**
   * Submits pending draw calls to the GPU.
   * Ensures all rendering operations are processed.
   */
  flush(): void;

  /**
   * Releases GPU resources associated with this surface.
   * Must be called when the surface is no longer needed.
   */
  dispose(): void;
}

/**
 * GPU Backend Interface
 *
 * Manages GPU surface lifecycle, rendering context, and device capabilities.
 * Implementations should handle context loss/restoration, device capabilities,
 * and backend-specific initialization.
 */
export interface GPUBackend {
  /**
   * Creates a GPU surface backed by an HTMLCanvasElement.
   *
   * @param canvas - The DOM canvas element to render to
   * @param width - Initial width in pixels
   * @param height - Initial height in pixels
   * @returns A GPUSurface, or null if surface creation fails (e.g., context lost)
   */
  createSurface(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
  ): GPUSurface | null;

  /**
   * Creates an offscreen GPU surface.
   * Useful for off-canvas rendering, texture atlases, or intermediate passes.
   *
   * @param width - Width in pixels
   * @param height - Height in pixels
   * @returns A GPUSurface, or null if creation fails
   */
  createOffscreenSurface(width: number, height: number): GPUSurface | null;

  /**
   * Resizes an existing surface.
   * Returns a new surface with updated dimensions (backends may rebuild internally).
   *
   * @param surface - The surface to resize
   * @param width - New width in pixels
   * @param height - New height in pixels
   * @returns The same or a new GPUSurface with updated dimensions, or null on failure
   */
  resizeSurface(
    surface: GPUSurface,
    width: number,
    height: number,
  ): GPUSurface | null;

  /**
   * Releases a surface.
   * Inverse of createSurface/createOffscreenSurface.
   */
  disposeSurface(surface: GPUSurface): void;

  /**
   * Signals the start of a rendering frame.
   * Backend may perform per-frame setup (e.g., clear buffers, bind render targets).
   */
  beginFrame(surface: GPUSurface): void;

  /**
   * Signals the end of a rendering frame.
   * Backend may perform per-frame cleanup (e.g., flush, present).
   */
  endFrame(surface: GPUSurface): void;

  /**
   * Detects if the GPU context has been lost.
   * Contexts can be lost due to device removal, tab backgrounding, or memory pressure.
   *
   * @returns true if the context is lost
   */
  isContextLost(): boolean;

  /**
   * Registers a callback to be invoked when the GPU context is lost.
   * Used for cleanup and resource release.
   */
  onContextLost(callback: () => void): void;

  /**
   * Registers a callback to be invoked when the GPU context is restored.
   * Used to reinitialize resources and resume rendering.
   */
  onContextRestored(callback: () => void): void;

  /**
   * Returns the maximum texture size supported by the backend.
   * Useful for determining texture atlas layout and constraints.
   *
   * @returns Max texture dimension in pixels
   */
  getMaxTextureSize(): number;

  /**
   * Returns the device pixel ratio (logical-to-physical pixels).
   * Used for high-DPI/Retina displays.
   *
   * @returns Pixel ratio (e.g., 1.0, 2.0)
   */
  getDevicePixelRatio(): number;

  /**
   * Releases all GPU backend resources.
   * Should be called once per application lifetime, not per-surface.
   */
  dispose(): void;
}
