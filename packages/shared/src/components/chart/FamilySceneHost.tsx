/**
 * ADR-306 — family 종류의 DOM host (breakdown §5.3). scatter 와 같은 틀이다: Recharts `ScatterChart`
 * 가 container · 크기 · `aria` 표면을 주고, 숨긴 숫자 축 2 의 domain 을 px 그대로 두어 `Customized`
 * 안에서 scene 의 `marks` · `axes` · `legend` 를 좌표 그대로 그린다 (`renderChartScene` — Skia
 * `chart_scene` 과 같은 순서). Recharts 기본 Funnel · Treemap · Sankey 는 쓰지 않는다 (ADR 대안 A).
 *
 * hover · 키보드는 scene 의 `targets` (breakdown §5.2) — 포인터는 rect 안 또는 가장 가까운 점,
 * 화살표 키는 배열 순서. 진입 animation 은 Recharts 대상이 아니라 한 번의 opacity 전환이고
 * `prefers-reduced-motion` 에서 끈다.
 */
import {
  computeChartScene,
  resolveChartAnimation,
  rowCategoryLabel,
  type ChartMetrics,
  type ChartProps,
  type ChartRow,
  type ChartSize,
  type ChartTarget,
} from "@composition/rendering";
import { useEffect, useMemo, useRef, useState } from "react";
import { Customized, ScatterChart, XAxis, YAxis } from "recharts";
import { Button as AriaButton } from "react-aria-components";
import {
  paintVar,
  renderChartScene,
  renderMark,
  seriesVar,
} from "./svgDecorations";
import {
  brushMarks,
  syncCursorMarks,
  useChartBrush,
  useChartSync,
} from "./chartInteraction";

function hitTarget(
  targets: readonly ChartTarget[],
  x: number,
  y: number,
): number {
  let best = -1;
  let bestDistance = Infinity;
  targets.forEach((target, i) => {
    if (target.arc) {
      // 고리 조각 안 (반지름 · 각도 — 12 시 = 0, 시계 방향).
      const { cx, cy, r0, r1, a0, a1 } = target.arc;
      const d = Math.hypot(x - cx, y - cy);
      const tau = Math.PI * 2;
      const a = (Math.atan2(x - cx, cy - y) + tau) % tau;
      if (d >= r0 && d <= r1 && a >= a0 && a <= a1) {
        best = i;
        bestDistance = -1;
      }
      return;
    }
    if (target.rect) {
      const { rect } = target;
      if (
        x >= rect.x &&
        x <= rect.x + rect.w &&
        y >= rect.y &&
        y <= rect.y + rect.h
      ) {
        best = i;
        bestDistance = -1;
      }
      return;
    }
    if (bestDistance < 0) return;
    const reach = (target.r ?? 0) + 12;
    const distance = Math.hypot(target.x - x, target.y - y);
    if (distance <= reach && distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}

export function FamilySceneHost({
  props,
  rows,
  size,
  metrics,
  label,
  familyEpoch,
  reducedMotion,
}: {
  props: ChartProps;
  rows: readonly ChartRow[];
  size: ChartSize;
  metrics: ChartMetrics;
  label: string;
  /** 로드 · 실패마다 오르는 값 — scene memo 의 키 (메모리 `feedback-memo-key-needs-async-readiness`). */
  familyEpoch: number;
  reducedMotion: boolean;
}) {
  // 같은 내용의 행 재전송은 같은 scene (직렬화 키 — `rowsKey` 선례).
  const rowsKey = useMemo(() => JSON.stringify(rows), [rows]);
  // ADR-306 Phase 6 — candlestick 의 범위 선택 확대 (고른 봉의 행만 — 뷰 상태, 데이터가 바뀌면 풀린다).
  const interactive = props.chartType === "candlestick";
  const [zoom, setZoom] = useState<{ key: string; labels: string[] } | null>(
    null,
  );
  const zoomLive = zoom !== null && zoom.key === rowsKey ? zoom : null;
  const zoomKey = zoomLive ? zoomLive.labels.join("\u0000") : "";
  const viewRows = useMemo(() => {
    if (!zoomLive) return rows;
    const keep = new Set(zoomLive.labels);
    return rows.filter((row) => keep.has(rowCategoryLabel(row, props)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey, zoomKey, props.dimension]);
  const scene = useMemo(
    () => computeChartScene(props, viewRows, size, metrics),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props, rowsKey, zoomKey, size, metrics, familyEpoch],
  );
  const targets = scene.targets ?? [];
  const [active, setActive] = useState<number | null>(null);
  const live = active !== null && active < targets.length ? active : null;
  const target = live !== null ? targets[live] : null;
  // 범위 선택 · 동기화는 범주 이름이 있는 target (봉) 에서.
  const keyed = interactive && targets.every((t) => t.key !== undefined);
  const centers = keyed ? targets.map((t) => t.x) : [];
  const first = targets[0]?.rect;
  const last = targets[targets.length - 1]?.rect;
  const band =
    keyed && first && last
      ? {
          x: first.x,
          y: first.y,
          w: last.x + last.w - first.x,
          h: first.h,
        }
      : scene.plot;
  const brushMode =
    keyed && (props.brush === "select" || props.brush === "zoom")
      ? props.brush
      : null;
  // 봉을 합쳤으면 (표시 예산) 봉 이름이 행 이름과 1 : 1 이 아니라 확대 (행 걸러내기) 를 할 수 없다.
  const canZoom = brushMode === "zoom" && targets.length === viewRows.length;
  const brush = useChartBrush({
    enabled: brushMode !== null,
    centers,
    plot: band,
    horizontal: false,
    keep: !canZoom,
    onCommit: (range) => {
      if (!canZoom || !range) return;
      setZoom({
        key: rowsKey,
        labels: targets.slice(range.from, range.to + 1).map((t) => t.key ?? ""),
      });
    },
  });
  const sync = useChartSync(keyed ? props.syncId : undefined);
  const activeKey = live !== null ? (targets[live]?.key ?? null) : null;
  const publish = sync.publish;
  useEffect(() => {
    publish(activeKey);
  }, [activeKey, publish]);
  const syncIndex =
    sync.received !== null
      ? targets.findIndex((t) => t.key === sync.received)
      : -1;
  const interaction = [
    ...(brush.range
      ? brushMarks({
          range: brush.range,
          centers,
          labels: targets.map((t) => t.key ?? ""),
          values: targets.map((t) => t.value),
          value: () => 0,
          acrossOf: (k) => targets[k].y,
          plot: band,
          horizontal: false,
          dragging: brush.dragging,
          formatValue: (v) => v.toLocaleString(),
        })
      : []),
    ...(syncIndex >= 0
      ? syncCursorMarks({
          at: targets[syncIndex].x,
          plot: band,
          horizontal: false,
          text: targets[syncIndex].title,
        })
      : []),
  ];

  const animation = resolveChartAnimation(props);
  const animate = animation.isAnimationActive && !reducedMotion;
  const marksRef = useRef<SVGGElement | null>(null);
  const shownFor = useRef<string | null>(null);
  useEffect(() => {
    // 진입 한 번 — 같은 차트가 다시 그려질 때 (크기 · 값 변경) 는 되풀이하지 않는다.
    const node = marksRef.current;
    if (!animate || !node || typeof node.animate !== "function") return;
    const key = props.chartType;
    if (shownFor.current === key) return;
    shownFor.current = key;
    node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: animation.animationDuration,
      delay: animation.animationBegin,
      easing: animation.animationEasing,
      fill: "backwards",
    });
  });

  const chart = (
    <ScatterChart
      width={size.width}
      height={size.height}
      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      accessibilityLayer={false}
      aria-label={label}
      style={{ fontSize: metrics.fontSize, overflow: "visible" }}
    >
      <XAxis hide type="number" dataKey="x" domain={[0, size.width]} />
      <YAxis hide type="number" dataKey="y" domain={[size.height, 0]} />
      <Customized
        key="scene"
        component={() => (
          <g
            ref={marksRef}
            data-chart-family={props.chartType}
            data-chart-mark-count={scene.marks.length}
          >
            {renderChartScene(scene)}
          </g>
        )}
      />
    </ScatterChart>
  );

  if (scene.empty || targets.length === 0) return chart;
  return (
    <div
      data-chart-targets=""
      tabIndex={0}
      aria-label={label}
      aria-describedby={undefined}
      style={{ position: "relative", width: size.width, height: size.height }}
      onPointerDown={brush.handlers.onPointerDown}
      onPointerUp={brush.handlers.onPointerUp}
      onPointerCancel={brush.handlers.onPointerCancel}
      onPointerMove={(event) => {
        brush.handlers.onPointerMove?.(event);
        const box = event.currentTarget.getBoundingClientRect();
        const hit = hitTarget(
          targets,
          event.clientX - box.left,
          event.clientY - box.top,
        );
        setActive(hit >= 0 ? hit : null);
      }}
      onPointerLeave={() => setActive(null)}
      onBlur={() => setActive(null)}
      onKeyDown={(event) => {
        // ADR-306 Phase 6 — Shift + 화살표 · Enter · Esc 는 범위 선택이 먼저 (확대 중 Esc 는 전체 보기).
        if (brushMode) {
          if (event.key === "Escape" && zoomLive && !brush.range) {
            setZoom(null);
            return;
          }
          if (
            event.shiftKey ||
            ((event.key === "Enter" || event.key === "Escape") && brush.range)
          ) {
            brush.handlers.onKeyDown?.(event);
            return;
          }
        }
        const step =
          event.key === "ArrowRight" || event.key === "ArrowDown"
            ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowUp"
              ? -1
              : 0;
        if (step === 0) {
          if (event.key === "Escape") setActive(null);
          return;
        }
        event.preventDefault();
        setActive((current) =>
          current === null
            ? step > 0
              ? 0
              : targets.length - 1
            : (current + step + targets.length) % targets.length,
        );
      }}
    >
      {chart}
      {interaction.length > 0 ? (
        <svg
          data-chart-interaction=""
          aria-hidden="true"
          width={size.width}
          height={size.height}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          {interaction.map((mark, i) => renderMark(mark, `interaction-${i}`))}
        </svg>
      ) : null}
      {zoomLive ? (
        <AriaButton
          data-chart-zoom-reset=""
          aria-label="Show all (reset zoom)"
          onPress={() => setZoom(null)}
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
      ) : null}
      {target && props.showTooltip ? (
        <div
          className="react-aria-Chart-tooltip"
          role="status"
          data-chart-target={target.id}
          style={{
            position: "absolute",
            left: Math.min(target.x + 12, Math.max(0, size.width - 160)),
            top: Math.max(0, target.y - 8),
            pointerEvents: "none",
            background: "var(--chart-tooltip-bg, Canvas)",
            color: "var(--chart-tooltip-text, inherit)",
            border: "1px solid var(--chart-tooltip-border, currentColor)",
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: 12,
            whiteSpace: "nowrap",
          }}
        >
          <div>{target.title}</div>
          {target.entries.map((entry, i) => (
            <div key={i} style={{ display: "flex", gap: 6 }}>
              {entry.paint || entry.series !== undefined ? (
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    alignSelf: "center",
                    borderRadius: 2,
                    background: entry.paint
                      ? paintVar(entry.paint)
                      : seriesVar(entry.series!),
                  }}
                />
              ) : null}
              <span>{entry.label}</span>
              <span>{entry.text}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
