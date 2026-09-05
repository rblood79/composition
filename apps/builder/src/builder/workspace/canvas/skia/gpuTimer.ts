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
 * - 인스턴스는 development 또는 명시적 capture opt-in에서 생성 (SkiaRenderer 게이트)
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
  private samplesMs: number[] = [];
  private invalid = 0;
  private started = 0;
  private dropped = 0;
  private disposed = false;

  snapshot() {
    return {
      supported: this.supported,
      disposed: this.disposed,
      contextLost: this.gl?.isContextLost() ?? false,
      started: this.started,
      valid: this.samplesMs.length,
      invalid: this.invalid,
      dropped: this.dropped,
      pending: this.pending ? 1 : 0,
      samplesMs: [...this.samplesMs],
    };
  }

  resetSamples(): void {
    // 하니스는 RAF callback 사이에서만 reset한다. 이전 구간의 query를 섞지 않는다.
    if (this.pending && !this.measuring) {
      this.gl?.deleteQuery(this.pending);
      this.pending = null;
    }
    this.samplesMs.length = 0;
    this.invalid = 0;
    this.started = 0;
    this.dropped = 0;
  }

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
    if (gl.isContextLost() || gl.getParameter(ext.GPU_DISJOINT_EXT)) {
      gl.deleteQuery(pending);
      this.pending = null;
      this.invalid++;
      return null;
    }
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
      if (!Number.isFinite(resultMs) || resultMs < 0) {
        resultMs = null;
        this.invalid++;
      } else if (this.samplesMs.length < 10000) this.samplesMs.push(resultMs);
      else this.dropped++;
    } else {
      this.invalid++;
    }
    gl.deleteQuery(pending);
    this.pending = null;
    return resultMs;
  }

  /** 프레임 GPU 구간 측정 시작 — in-flight query 가 남아 있으면 skip. */
  frameBegin(): void {
    const { gl, ext } = this;
    if (!gl || !ext || gl.isContextLost() || this.pending || this.measuring)
      return;
    const query = gl.createQuery();
    if (!query) return;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    this.pending = query;
    this.measuring = true;
    this.started++;
  }

  frameEnd(): void {
    const { gl, ext } = this;
    if (!gl || !ext || !this.measuring) return;
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    this.measuring = false;
  }

  dispose(): void {
    if (this.gl && this.ext && this.measuring && !this.gl.isContextLost()) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.measuring = false;
    }
    if (this.gl && this.pending && !this.measuring) {
      this.gl.deleteQuery(this.pending);
    }
    this.pending = null;
    this.measuring = false;
    this.gl = null;
    this.ext = null;
    this.disposed = true;
  }
}
