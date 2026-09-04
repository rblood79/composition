/**
 * ADR-183 Phase 3 — 레이아웃 explain 판독 채널 (dev 전용).
 *
 * 엔진 판정 트레이스(Phase 1)를 WASM 경계(Phase 2)로 꺼내 **사람이 읽는
 * 시퀀스**로 포맷한다. `window.__layoutExplain(elementId)` 가 진입점이고,
 * `fullTreeLayout.ts` 가 DEV 게이트(`import.meta.env.DEV`)로 설치한다 —
 * boolean 게이트 상수가 아니므로 featureFlags registry 계약과 무충돌.
 *
 * ## 판독 규칙
 *
 * - 트레이스는 **엔진의 자기 보고**다 — "엔진이 무엇을 했나" 는 답하지만
 *   "그것이 CSS 에 맞나" 는 답하지 않는다. 정합 oracle 은 Chrome parity
 *   fixture 이고, 출력 첫 줄이 이를 명시한다 (R4).
 * - TS 층 공급값(`contentMinWidth`/`contentMaxWidth` 측정 스칼라)은 엔진
 *   판정이 아니다 — `[TS]` prefix 의 별도 줄로 병기한다 (HC4, ADR-165).
 * - 측정 패스(센티넬 available) 판정은 `[측정]` 태그로 본 solve 와 구분한다
 *   (R5) — 섞으면 판독이 오도된다.
 *
 * ## 게이트 흐름 (Decision 1 — 살아 있는 트리)
 *
 * explain 은 문제 노드를 fresh 트리로 다시 풀지 않는다 — 그러면 증분 skip
 * 게이트·측정 캐시를 타지 않아 오진 반복 최다 축(캐시 계열)이 정확히
 * 사각이 된다. 대신 **살아 있는 트리에 게이트를 켜고**, 사용자가 재현
 * 동작(편집/리사이즈)을 한 뒤 다시 호출하는 2-호출 흐름이다.
 */

import type {
  EngineTraceEvent,
  EngineTraceNode,
} from "../../wasm-bindings/compositionEngine";

/**
 * explain 이 필요로 하는 트리 표면 — `PersistentLayoutTree` 가 구조적으로
 * 만족한다. 인터페이스로 좁혀 테스트가 fake 를 주입할 수 있게 한다.
 */
export interface ExplainableTree {
  hasNode(elementId: string): boolean;
  enableLayoutTrace(enabled: boolean): boolean;
  getLayoutTraceForElement(elementId: string): EngineTraceNode | null;
  getLastJson(elementId: string): string | undefined;
}

export interface LayoutExplainFn {
  (elementId: string): string;
  /** 모든 트리의 트레이스 게이트를 끈다 (R3 — WASM 힙 반환). */
  disable(): void;
}

/**
 * available 센티넬을 이름으로 풀어 쓴다 — `-1` 을 숫자로 노출하면
 * "가짜 음수 여유" 계열 오진(미결정 main)을 판별할 수 없다 (G3 ③).
 */
function fmtAvail(v: number): string {
  if (v === -1) return "미결정";
  if (v === -2) return "min-content 측정";
  if (v === -3) return "max-content 측정";
  return String(v);
}

function axisName(a: "Inline" | "Block"): string {
  return a === "Inline" ? "width" : "height";
}

/** 판정 1건 → 사람이 읽는 한 줄. 문구는 `layout-engine.md` 오진 배제 근거와 짝. */
function fmtEvent(e: EngineTraceEvent): string {
  const tag = e.measure_pass ? "[측정] " : "";
  switch (e.type) {
    case "IncrementalSkip": {
      const avail = `avail=(${fmtAvail(e.avail[0])}, ${fmtAvail(e.avail[1])})`;
      if (e.reason === "Hit") {
        return `${tag}IncrementalSkip: HIT — 재계산 없이 직전 반환값 재사용, 서브트리 미방문 ${avail}`;
      }
      const why =
        e.reason === "AvailChanged"
          ? " — 재부모화/부모 리사이즈 서명: 데이터가 아니라 레이아웃 캐시 축이다"
          : "";
      return `${tag}IncrementalSkip: MISS(${e.reason})${why} ${avail}`;
    }
    case "UsedSizeClamp":
      return `${tag}UsedSizeClamp: ${axisName(e.axis)} ${e.from} → ${e.to} (${e.bound} 바인딩 — 내부 재분배는 clamp 뒤 값 기준)`;
    case "AutoMinFloor":
      return `${tag}AutoMinFloor: item#${e.item} floor=${e.floor} (${
        e.source === "ContentMinScalar"
          ? "정확 min-content — TS 스칼라 공급"
          : e.source === "SpecifiedSizeMin"
            ? "definite 주축 — min(specified, 정확 min-content) (ADR-204 §4.5)"
            : "스칼라 부재 fallback — 단일줄 상한 근사"
      })`;
    case "ShrinkToFitReentry":
      return `${tag}ShrinkToFitReentry: ${axisName(e.axis)} settled=${e.settled} — 확정 크기를 containing block 으로 2차 pass (§5.1)`;
    case "IntrinsicMeasure":
      return `${tag}IntrinsicMeasure: ${e.hit ? "HIT (캐시)" : "MISS (재측정)"} gen=${e.generation} min=${e.min} max=${e.max}`;
    case "FlexItemResolve":
      return `${tag}FlexItemResolve: item#${e.item} used_main=${e.used_main} ≠ solve 시 avail=${e.prev_avail} — 재-solve 발생 (3.5)`;
    case "GridTrackResolve":
      return `${tag}GridTrackResolve: ${e.axis === "Inline" ? "cols" : "rows"} [${e.tracks
        .map((t) => (t === null ? "미해소" : t))
        .join(
          ", ",
        )}] (${e.stage === "Contribution" ? "§12.5 기여" : "§12.8 auto stretch"})`;
  }
}

/**
 * 마지막으로 WASM 에 보낸 style JSON 에서 TS 공급 스칼라를 뽑는다.
 * `_lastJsonMap` 이 소스라 "엔진이 실제로 받은 값" 그대로다.
 */
function fmtTsSupply(lastStyleJson: string | undefined): string | null {
  if (!lastStyleJson) return null;
  try {
    const style = JSON.parse(lastStyleJson) as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof style.contentMinWidth === "number") {
      parts.push(`contentMinWidth=${style.contentMinWidth}`);
    }
    if (typeof style.contentMaxWidth === "number") {
      parts.push(`contentMaxWidth=${style.contentMaxWidth}`);
    }
    if (parts.length === 0) return null;
    return `[TS] ${parts.join(" ")} — enrichWithIntrinsicSize 측정 스칼라 (엔진 판정 아님, ADR-165 공급 채널)`;
  } catch {
    return null;
  }
}

/**
 * 노드 1개의 트레이스 보고 → 사람이 읽는 시퀀스 (§1 목표 형태).
 * 순수 함수 — G3 시나리오 계약은 `layoutExplain.test.ts` 가 잠근다.
 */
export function formatLayoutExplain(
  elementId: string,
  trace: EngineTraceNode | null,
  lastStyleJson?: string,
): string {
  const head = `[node ${elementId}] 엔진 판정 트레이스 — 자기 보고이며, 정합 oracle 은 Chrome parity fixture 다`;
  if (!trace) {
    return `${head}\n조회 실패 — 레이아웃 트리에 미등록이거나 엔진이 트레이스 채널을 지원하지 않는다`;
  }

  const lines = [head];
  const ts = fmtTsSupply(lastStyleJson);
  if (ts) lines.push(ts);

  if (!trace.enabled) {
    lines.push(
      "트레이스 게이트가 꺼져 있다 — window.__layoutExplain(elementId) 로 켠 뒤 재현 동작이 필요하다",
    );
    return lines.join("\n");
  }
  if (trace.events.length === 0) {
    lines.push(
      "기록된 판정 없음 — 게이트를 켠 뒤 이 노드의 재계산이 아직 없었다 (편집/리사이즈로 재현 후 다시 호출)",
    );
    return lines.join("\n");
  }

  trace.events.forEach((e, i) => {
    const branch = i === trace.events.length - 1 ? "└" : "├";
    lines.push(`${branch} ${fmtEvent(e)}`);
  });
  if (trace.dropped > 0) {
    lines.push(
      `⚠ 노드당 상한 초과로 ${trace.dropped}건 잘림 — 최초 ${trace.events.length}건만 보존 (완전한 시퀀스가 아니다)`,
    );
  }
  return lines.join("\n");
}

/**
 * explain 함수 생성. `trees` 는 호출 시점마다 평가된다 — 페이지 트리 맵은
 * 라이브로 늘고 줄기 때문에 스냅샷을 캡처하면 stale 이 된다.
 */
export function createLayoutExplain(
  trees: () => Iterable<ExplainableTree>,
): LayoutExplainFn {
  const findTree = (elementId: string): ExplainableTree | null => {
    for (const t of trees()) {
      if (t.hasNode(elementId)) return t;
    }
    return null;
  };

  const fn = (elementId: string): string => {
    const tree = findTree(elementId);
    if (!tree) {
      return `[node ${elementId}] 미등록 — 어느 페이지 레이아웃 트리에도 없다 (elementId 오타 또는 아직 배치 전)`;
    }

    const trace = tree.getLayoutTraceForElement(elementId);
    if (trace && !trace.enabled) {
      // 살아 있는 트리에 켠다 — markDirty 로 재계산을 강제하면 skip 판정
      // 자체가 바뀌어 캐시 계열 오진이 사각이 된다 (Decision 1).
      tree.enableLayoutTrace(true);
      return `[node ${elementId}] 트레이스 게이트를 켰다 — 재현 동작(편집/리사이즈 등) 후 다시 호출하면 판정 시퀀스가 보인다. 끝나면 __layoutExplain.disable()`;
    }
    return formatLayoutExplain(elementId, trace, tree.getLastJson(elementId));
  };

  fn.disable = (): void => {
    for (const t of trees()) {
      t.enableLayoutTrace(false);
    }
  };
  return fn;
}

declare global {
  interface Window {
    __layoutExplain?: LayoutExplainFn;
  }
}

/**
 * `window.__layoutExplain` 설치. DEV 게이트는 호출부(fullTreeLayout.ts) 책임.
 * 콘솔 판독용으로 console.log 를 겸한다 — devtools 는 반환 문자열의 개행을
 * 이스케이프해 보여주기 때문.
 */
export function installLayoutExplain(
  trees: () => Iterable<ExplainableTree>,
): void {
  if (typeof window === "undefined") return;
  const explain = createLayoutExplain(trees);
  const logged = (elementId: string): string => {
    const out = explain(elementId);

    console.log(out);
    return out;
  };
  logged.disable = explain.disable;
  window.__layoutExplain = logged;
}
