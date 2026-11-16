/**
 * ADR-306 Phase 6 — 범위 선택 (`brush`) · 차트 동기화 (`syncId`). Preview · Publish 의 실행 상태 — 저장하지
 * 않고 Canvas 는 그리지 않는다 (사용자 결정 1 · breakdown §8 Phase 6). 뜻은 ztd-charts 0.5.0 (`3c4376c`,
 * MIT — `src/core/brush.tsx` `useBrush` · `changeRatio` · `BrushBand`, `src/core/sync.ts` `joinSync` ·
 * `sendSync` · `syncIndex`) 을 따른다.
 *
 * - 범위 선택: 마우스 · 펜으로 그림 안을 끈다 (4 px 넘게 움직여야 시작 — 클릭은 지운다). 키보드는
 *   Shift + ←/→ 로 넓히고 Enter 로 정하고 Esc 로 지운다. `select` 는 고른 구간의 등락 · 최고 · 최저,
 *   `zoom` 은 그 구간으로 확대하고 「Show all」 로 돌아온다.
 * - 동기화: 같은 이름의 차트끼리 가리킨 범주를 주고받는다 (범주 이름으로 맞춘다). 받은 차트는 그 자리에
 *   세로 안내선과 강조 시리즈의 값을 그린다 — ztd 는 받은 차트에 툴팁을 띄운다 (편차: 툴팁 대신 안내선 ·
 *   값 글자 — 차트 종류 (Recharts · family host) 와 무관하게 같은 표시).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Button as AriaButton } from "react-aria-components";
import { plotLine, rowCategoryLabel } from "@composition/rendering";
import type {
  ChartProps,
  ChartRow,
  Mark,
  Rect,
  TextMark,
} from "@composition/rendering";

// ── 동기화 bus ────────────────────────────────────────────────────────────────

type SyncListener = (label: string | null, from: object) => void;
const groups = new Map<string, Set<SyncListener>>();

export function joinChartSync(id: string, fn: SyncListener): () => void {
  let set = groups.get(id);
  if (!set) groups.set(id, (set = new Set()));
  set.add(fn);
  return () => {
    set.delete(fn);
    if (set.size === 0) groups.delete(id);
  };
}

export function sendChartSync(
  id: string,
  label: string | null,
  from: object,
): void {
  groups.get(id)?.forEach((fn) => fn(label, from));
}

/**
 * 같은 묶음 (`chartSyncGroup`) 의 다른 차트가 가리킨 범주 이름 (없으면 null) 과, 이 차트가 가리킨 범주를
 * 보내는 함수. 묶음이 "" 면 아무것도 주고받지 않는다.
 */
export function useChartSync(id: string): {
  received: string | null;
  publish: (label: string | null) => void;
} {
  const [self] = useState(() => ({}));
  const [received, setReceived] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return undefined;
    const leave = joinChartSync(id, (label, from) => {
      if (from !== self) setReceived(label);
    });
    return () => {
      leave();
      setReceived(null);
    };
  }, [id, self]);
  const last = useRef<string | null>(null);
  const publish = useCallback(
    (label: string | null) => {
      if (!id || last.current === label) return;
      last.current = label;
      sendChartSync(id, label, self);
    },
    [id, self],
  );
  return { received: id ? received : null, publish };
}

/** 받은 범주 자리의 안내선 · 값 글자 (scene 좌표 — front overlay 에 그린다). */
export function syncCursorMarks(input: {
  at: number;
  plot: Rect;
  horizontal: boolean;
  text: string | null;
}): Mark[] {
  const { at, plot, horizontal } = input;
  const line = plotLine(plot, !horizontal, at, { dash: [3, 3] });
  if (!input.text) return [line];
  const text: TextMark = horizontal
    ? {
        kind: "text",
        x: plot.x + plot.w - 4,
        y: at - 4,
        text: input.text,
        anchor: "end",
        baseline: "bottom",
        role: "value",
      }
    : {
        kind: "text",
        x: at + 4,
        y: plot.y + 4,
        text: input.text,
        anchor: "start",
        baseline: "top",
        role: "value",
      };
  return [line, text];
}

// ── 범위 선택 ─────────────────────────────────────────────────────────────────

export interface BrushRange {
  from: number;
  to: number;
}

const MIN_DRAG_PX = 4;

/**
 * 끌기 · 키보드 범위 선택 (ztd `useBrush`). `centers` 는 범주 축 좌표 (scene), `along` 은 pointer 의 범주
 * 축 좌표를 구하는 함수 (화면 → scene). `keep: false` (확대) 면 정하자마자 띠를 지운다.
 */
export function useChartBrush(o: {
  enabled: boolean;
  centers: readonly number[];
  plot: Rect;
  horizontal: boolean;
  keep: boolean;
  onCommit: (range: BrushRange | null) => void;
}) {
  const [range, setRange] = useState<BrushRange | null>(null);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ i: number; at: number; moved: boolean } | null>(null);
  const anchor = useRef<number | null>(null);
  const count = o.centers.length;
  const indexAt = (along: number): number => {
    let best = 0;
    let bd = Infinity;
    o.centers.forEach((c, i) => {
      const d = Math.abs(c - along);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };
  const local = (e: PointerEvent<Element>) => {
    const surface = (e.target as Element | null)?.closest?.(
      "svg.recharts-surface, svg[data-chart-family]",
    ) as SVGSVGElement | null;
    const box = (surface ?? e.currentTarget).getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };
  const inPlot = (p: { x: number; y: number }) =>
    p.x >= o.plot.x &&
    p.x <= o.plot.x + o.plot.w &&
    p.y >= o.plot.y &&
    p.y <= o.plot.y + o.plot.h;
  const alongOf = (p: { x: number; y: number }) => (o.horizontal ? p.y : p.x);
  // 고르던 것을 지운다 (키보드 기준점은 Esc 만 지운다 — `clear`).
  const drop = () => {
    start.current = null;
    setDragging(false);
    setRange(null);
  };
  const clear = () => {
    anchor.current = null;
    drop();
  };
  const handlers = o.enabled
    ? {
        onPointerDown: (e: PointerEvent<Element>) => {
          if (count < 2 || e.pointerType === "touch" || e.button !== 0) return;
          const p = local(e);
          if (!inPlot(p)) return;
          // 놓을 때까지 표면 밖으로 나가도 받는다 (활성 포인터가 아니면 — 합성 이벤트 — 건너뛴다).
          try {
            (e.target as Element).setPointerCapture?.(e.pointerId);
          } catch {
            /* no active pointer */
          }
          start.current = {
            i: indexAt(alongOf(p)),
            at: alongOf(p),
            moved: false,
          };
        },
        onPointerMove: (e: PointerEvent<Element>) => {
          const s = start.current;
          if (!s) return;
          const along = alongOf(local(e));
          if (!s.moved && Math.abs(along - s.at) < MIN_DRAG_PX) return;
          s.moved = true;
          const i = indexAt(along);
          const from = Math.min(s.i, i);
          const to = Math.max(s.i, i);
          setDragging(true);
          setRange((prev) =>
            prev?.from === from && prev.to === to ? prev : { from, to },
          );
        },
        onPointerUp: (e: PointerEvent<Element>) => {
          const s = start.current;
          start.current = null;
          if (!s) return;
          setDragging(false);
          if (!s.moved) {
            if (range) {
              setRange(null);
              o.onCommit(null);
            }
            return;
          }
          const i = indexAt(alongOf(local(e)));
          const r = { from: Math.min(s.i, i), to: Math.max(s.i, i) };
          const ok = r.to > r.from;
          setRange(ok && o.keep ? r : null);
          o.onCommit(ok ? r : null);
        },
        // 끌기가 취소되면 (창 전환 · 시스템 제스처) 고르던 것을 지운다 — 남은 `start` 로 다음 이동이 끌기가 되지 않게.
        onPointerCancel: () => {
          if (start.current) drop();
        },
        onKeyDown: (e: KeyboardEvent<Element>) => {
          if (e.key === "Escape" && range) {
            clear();
            o.onCommit(null);
            return;
          }
          if (e.key === "Enter" && range && anchor.current !== null) {
            anchor.current = null;
            if (!o.keep) setRange(null);
            o.onCommit(range);
            return;
          }
          if (
            !e.shiftKey ||
            (e.key !== "ArrowLeft" &&
              e.key !== "ArrowRight" &&
              e.key !== "ArrowUp" &&
              e.key !== "ArrowDown") ||
            count < 2
          )
            return;
          e.preventDefault();
          e.stopPropagation();
          const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
          const a = anchor.current ?? (step > 0 ? 0 : count - 1);
          const end =
            range && anchor.current !== null
              ? range.from === a
                ? range.to
                : range.from
              : a;
          const next = Math.max(0, Math.min(count - 1, end + step));
          anchor.current = a;
          setRange(
            next === a
              ? null
              : { from: Math.min(a, next), to: Math.max(a, next) },
          );
        },
      }
    : {};
  return { range, dragging, handlers };
}

/** a → b 의 바뀐 비율 (a 가 0 이면 null — ztd `changeRatio`). */
export function changeRatio(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return (b - a) / Math.abs(a);
}

export function signedPercent(r: number): string {
  const v = Math.round(r * 1000) / 10;
  return `${v > 0 ? "+" : ""}${v}%`;
}

/**
 * 고른 구간의 띠 (accent 0.14 · 끄는 중 0.1) · 양 끝 선 · 위쪽 요약 (등락 · 구간 이름) · 최고 · 최저 글자
 * (ztd `BrushBand` · `ExtremeTags` — 이름표 바탕 상자는 그리지 않는다, 주석과 같은 편차).
 */
export function brushMarks(input: {
  range: BrushRange;
  centers: readonly number[];
  labels: readonly string[];
  values: readonly (number | undefined)[];
  /** 항목 k 의 최고 · 최저 글자 기준점 (값 축 좌표 — Recharts 는 값 축 scale, family 는 target 의 점). */
  acrossOf: (k: number) => number;
  plot: Rect;
  horizontal: boolean;
  dragging: boolean;
  formatValue: (v: number) => string;
}): Mark[] {
  const { range, centers, plot, horizontal } = input;
  const a = centers[range.from];
  const b = centers[range.to];
  if (a === undefined || b === undefined) return [];
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const box: Rect = horizontal
    ? { x: plot.x, y: lo, w: plot.w, h: Math.max(1, hi - lo) }
    : { x: lo, y: plot.y, w: Math.max(1, hi - lo), h: plot.h };
  const edge = (at: number) =>
    plotLine(plot, !horizontal, at, { paint: "accent", opacity: 0.7 });
  const out: Mark[] = [
    {
      kind: "rect",
      ...box,
      seriesIndex: 0,
      fillPaint: "accent",
      fillOpacity: input.dragging ? 0.1 : 0.14,
    },
    edge(lo),
    edge(hi),
  ];
  const first = input.values[range.from];
  const last = input.values[range.to];
  const ratio =
    first !== undefined && last !== undefined ? changeRatio(first, last) : null;
  const span = `${input.labels[range.from] ?? ""}~${input.labels[range.to] ?? ""}`;
  const main =
    ratio !== null
      ? signedPercent(ratio)
      : last !== undefined
        ? input.formatValue(last)
        : "";
  out.push({
    kind: "text",
    x: horizontal ? plot.x + plot.w - 4 : (lo + hi) / 2,
    y: horizontal ? (lo + hi) / 2 : plot.y + 4,
    text: main ? `${main} · ${span}` : span,
    anchor: horizontal ? "end" : "middle",
    baseline: horizontal ? "middle" : "top",
    role: "value",
  });
  // 최고 · 최저 — 구간 안 값 (같은 값이면 앞의 것).
  let maxK = -1;
  let minK = -1;
  for (let k = range.from; k <= range.to; k++) {
    const v = input.values[k];
    if (v === undefined || !Number.isFinite(v)) continue;
    if (maxK < 0 || v > input.values[maxK]!) maxK = k;
    if (minK < 0 || v < input.values[minK]!) minK = k;
  }
  if (!input.dragging && maxK >= 0 && minK >= 0 && maxK !== minK) {
    const tag = (k: number, name: string, above: boolean): TextMark => {
      const v = input.values[k]!;
      const c = centers[k];
      const across = input.acrossOf(k);
      return horizontal
        ? {
            kind: "text",
            x: across + (above ? 6 : -6),
            y: c,
            text: `${name} ${input.formatValue(v)}`,
            anchor: above ? "start" : "end",
            baseline: "middle",
            role: "value",
          }
        : {
            kind: "text",
            x: c,
            y: across + (above ? -8 : 8),
            text: `${name} ${input.formatValue(v)}`,
            anchor: "middle",
            baseline: above ? "bottom" : "top",
            role: "value",
          };
    };
    out.push(tag(maxK, "High", true), tag(minK, "Low", false));
  }
  return out;
}

/**
 * 확대할 범주 — 보이는 격자 (예산 뒤) 에서 고른 첫 · 끝 범주를 원본 격자 (예산 전) 의 자리로 바꿔 그 사이
 * 원본 범주를 전부 (판독 HIGH-1 — extrema 예산은 보이는 범주가 원본의 일부라, 보이는 이름만 남기면 사이
 * 행을 잃는다). 보이는 이름이 원본에 없으면 (묶음 「a ~ b」 · others) null — 확대하지 않는다.
 */
export function zoomCategoryLabels(
  input: { categories: readonly string[] },
  visible: { categories: readonly string[] },
  range: BrushRange,
): string[] | null {
  const a = input.categories.indexOf(visible.categories[range.from] ?? "");
  const b = input.categories.indexOf(visible.categories[range.to] ?? "");
  if (a < 0 || b < 0) return null;
  return input.categories.slice(Math.min(a, b), Math.max(a, b) + 1);
}

// ── 확대 ──────────────────────────────────────────────────────────────────────

/**
 * 범위 선택 확대 상태 — 고른 범주의 행만 남긴다 (뷰 상태: 저장하지 않고, `resetKey` (데이터 · 종류) 가 바뀌면
 * 풀린다). Recharts host 와 family host 가 같이 쓴다.
 */
export function useChartZoom(
  rows: readonly ChartRow[],
  rowsKey: string,
  resetKey: string,
  props: Pick<ChartProps, "dimension">,
) {
  const [zoom, setZoom] = useState<{ key: string; labels: string[] } | null>(
    null,
  );
  const live = zoom !== null && zoom.key === resetKey ? zoom : null;
  const zoomKey = live ? live.labels.join("\u0000") : "";
  const viewRows = useMemo(() => {
    if (!live) return rows;
    const keep = new Set(live.labels);
    return rows.filter((row) => keep.has(rowCategoryLabel(row, props)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey, zoomKey, props.dimension]);
  return {
    viewRows,
    zoomKey,
    zoomed: live !== null,
    zoomTo: (labels: string[]) => setZoom({ key: resetKey, labels }),
    reset: () => setZoom(null),
  };
}

/** 확대 중일 때 오른쪽 위 「Show all」 — 누르면 전체 보기. */
export function ChartZoomReset({ onPress }: { onPress: () => void }) {
  return (
    <AriaButton
      data-chart-zoom-reset=""
      aria-label="Show all (reset zoom)"
      onPress={onPress}
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        height: 24,
        padding: "0 10px",
        borderRadius: 12,
        border: "1px solid var(--chart-grid, currentColor)",
        background: "var(--chart-tooltip-bg, Canvas)",
        color: "inherit",
        fontSize: 11.5,
        zIndex: 4,
      }}
    >
      Show all
    </AriaButton>
  );
}
