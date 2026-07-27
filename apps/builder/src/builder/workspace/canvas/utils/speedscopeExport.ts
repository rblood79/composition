/**
 * Speedscope 프로파일 export (ADR-153 Phase 1-d)
 *
 * perfMarks 의 measurement trace ring (최근 256개 / ~5초 창) 을 speedscope
 * evented 포맷으로 직렬화한다. 외부 라이브러리 의존 0 — 포맷 직렬화만 수행.
 * 산출 파일은 https://www.speedscope.app 에 드롭하면 flamechart 로 열린다.
 *
 * observe()/markBegin/markEnd 계측은 동기 중첩 구조라 trace 들이 원칙적으로
 * 정합 스택을 이루지만, ring 절삭으로 부모 open 이 유실될 수 있어 부분 겹침은
 * 스택 top 의 종료 시각으로 클램프한다 (evented 포맷은 정합 스택 필수).
 */

import { getMeasurementTraces } from "../../../utils/perfMarks";

interface SpeedscopeFrame {
  name: string;
}

interface SpeedscopeEvent {
  type: "O" | "C";
  frame: number;
  at: number;
}

interface SpeedscopeFile {
  $schema: string;
  shared: { frames: SpeedscopeFrame[] };
  profiles: Array<{
    type: "evented";
    name: string;
    unit: "milliseconds";
    startValue: number;
    endValue: number;
    events: SpeedscopeEvent[];
  }>;
  exporter: string;
}

/** 현재 trace ring 을 speedscope evented 프로파일로 직렬화한다. trace 0건이면 null. */
export function buildSpeedscopeProfile(): SpeedscopeFile | null {
  const traces = [...getMeasurementTraces()];
  if (traces.length === 0) return null;

  // 부모 우선 정렬: start 오름차순, 동시 시작이면 긴 구간(부모) 먼저
  traces.sort((a, b) => a.start - b.start || b.end - a.end);

  const frameIndex = new Map<string, number>();
  const frames: SpeedscopeFrame[] = [];
  const events: SpeedscopeEvent[] = [];
  const stack: Array<{ frame: number; end: number }> = [];

  const frameOf = (label: string): number => {
    let idx = frameIndex.get(label);
    if (idx === undefined) {
      idx = frames.length;
      frames.push({ name: label });
      frameIndex.set(label, idx);
    }
    return idx;
  };

  let minStart = Infinity;
  let maxEnd = -Infinity;

  for (const trace of traces) {
    while (stack.length > 0 && stack[stack.length - 1].end <= trace.start) {
      const top = stack.pop()!;
      events.push({ type: "C", frame: top.frame, at: top.end });
    }
    // 부분 겹침(스택 top 보다 늦게 끝남)은 정합 스택을 깨뜨리므로 클램프
    const parentEnd = stack.length > 0 ? stack[stack.length - 1].end : Infinity;
    const end = Math.min(trace.end, parentEnd);
    const frame = frameOf(trace.label);
    events.push({ type: "O", frame, at: trace.start });
    stack.push({ frame, end });
    minStart = Math.min(minStart, trace.start);
    maxEnd = Math.max(maxEnd, end);
  }
  while (stack.length > 0) {
    const top = stack.pop()!;
    events.push({ type: "C", frame: top.frame, at: top.end });
  }

  return {
    $schema: "https://www.speedscope.app/file-format-schema.json",
    shared: { frames },
    profiles: [
      {
        type: "evented",
        name: "composition perf traces",
        unit: "milliseconds",
        startValue: minStart,
        endValue: maxEnd,
        events,
      },
    ],
    exporter: "composition perfMarks (ADR-153 Phase 1-d)",
  };
}

/**
 * 프로파일을 JSON 파일로 다운로드한다 (HUD export 버튼용).
 * trace 가 없어 export 할 것이 없으면 false 를 반환한다.
 */
export function downloadSpeedscopeProfile(): boolean {
  const profile = buildSpeedscopeProfile();
  if (!profile) return false;

  const blob = new Blob([JSON.stringify(profile)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `composition-perf-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.speedscope.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
