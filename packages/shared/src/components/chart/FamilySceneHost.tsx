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
  type ChartMetrics,
  type ChartProps,
  type ChartRow,
  type ChartSize,
  type ChartTarget,
} from "@composition/rendering";
import { useEffect, useMemo, useRef, useState } from "react";
import { Customized, ScatterChart, XAxis, YAxis } from "recharts";
import { paintVar, renderChartScene, seriesVar } from "./svgDecorations";

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
  const scene = useMemo(
    () => computeChartScene(props, rows, size, metrics),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props, rowsKey, size, metrics, familyEpoch],
  );
  const targets = scene.targets ?? [];
  const [active, setActive] = useState<number | null>(null);
  const live = active !== null && active < targets.length ? active : null;
  const target = live !== null ? targets[live] : null;

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
      onPointerMove={(event) => {
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
      {target ? (
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
