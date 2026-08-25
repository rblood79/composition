/**
 * WebGL2 GPU 프레임 시간 측정 (ADR-153 Phase 1-c)
 *
 * EXT_disjoint_timer_query_webgl2 로 GPU 측 실행 시간을 non-blocking 측정한다.
 * CanvasKit 이 이미 획득한 canvas 의 webgl2 컨텍스트를 재사용한다 — 같은 canvas
 * 에 getContext("webgl2") 를 다시 호출하면 기존 컨텍스트가 반환된다 (신규 생성
 * 아님). CanvasKit 이 webgl1 폴백이거나 SW surface 면 null 이 반환되어
 * supported=false → 전체 no-op (breakdown §Phase 1-c "불가 시 본 항목만 축소").
 *
 * 규율:
 * - in-flight query 는 1개만 유지 — 결과 준비 전에는 새 측정을 시작하지 않는다
 *   (`getQueryParameter` 동기 대기 금지, 파이프라인 stall 방지)
 * - GPU_DISJOINT_EXT 발생 시 해당 샘플 폐기 (스펙 요구)
 * - 인스턴스는 dev 모드에서만 생성 (SkiaRenderer 생성자 게이트)
 */

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

export class GpuTimer {
  private gl: WebGL2RenderingContext | null = null;
  private ext: TimerExt | null = null;
  private pending: WebGLQuery | null = null;
  private measuring = false;
  readonly supported: boolean;

  constructor(canvas: HTMLCanvasElement) {
    let gl: WebGL2RenderingContext | null;
    try {
      gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    } catch {
      gl = null;
    }
    const ext = (gl?.getExtension("EXT_disjoint_timer_query_webgl2") ??
      null) as TimerExt | null;
    this.gl = ext ? gl : null;
    this.ext = ext;
    this.supported = ext !== null;
  }

  /**
   * 직전 in-flight 측정 결과를 비차단 조회한다 (ms). 준비 전이면 null.
   * disjoint 이벤트가 있었던 샘플은 폐기하고 null 을 반환한다.
   */
  poll(): number | null {
    const { gl, ext, pending } = this;
    if (!gl || !ext || !pending || this.measuring) return null;
    const available = gl.getQueryParameter(
      pending,
      gl.QUERY_RESULT_AVAILABLE,
    ) as boolean;
    if (!available) return null;

    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean;
    let resultMs: number | null = null;
    if (!disjoint) {
      const ns = gl.getQueryParameter(pending, gl.QUERY_RESULT) as number;
      resultMs = ns / 1e6;
    }
    gl.deleteQuery(pending);
    this.pending = null;
    return resultMs;
  }

  /** 프레임 GPU 구간 측정 시작 — in-flight query 가 남아 있으면 skip. */
  frameBegin(): void {
    const { gl, ext } = this;
    if (!gl || !ext || this.pending || this.measuring) return;
    const query = gl.createQuery();
    if (!query) return;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    this.pending = query;
    this.measuring = true;
  }

  frameEnd(): void {
    const { gl, ext } = this;
    if (!gl || !ext || !this.measuring) return;
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    this.measuring = false;
  }

  dispose(): void {
    if (this.gl && this.pending && !this.measuring) {
      this.gl.deleteQuery(this.pending);
    }
    this.pending = null;
    this.measuring = false;
    this.gl = null;
    this.ext = null;
  }
}
