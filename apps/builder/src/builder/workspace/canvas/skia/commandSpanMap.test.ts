// CANVAS_PERF_SCALING_2026-11 — span map 의 cursor 해석은 segment 수에 비례하지 않는다.
// splice 는 segment 를 합치지 않아 서로 다른 자리를 고칠 때마다 둘씩 늘어난다. 해석이 segment 를
// 전부 훑으면 편집한 자리 수만큼 pan · zoom 의 span 조회가 느려졌다 (22장 · 25자리 편집 뒤 zoom
// 의 해석 단계 197,814 → 1,641,641).

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CommandSpanMap,
  createSegmentedCommandBuffer,
  replaceCommandRange,
  type RenderCommand,
  type SubtreeSpan,
} from "./renderCommands";
import { resetRenderCounters, snapshotRenderCounters } from "./renderCounters";

afterEach(() => vi.unstubAllEnvs());

/** 결정적 의사 난수 (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let serial = 0;
const marker = () => ({ type: 1, n: serial++ }) as unknown as RenderCommand;
const markers = (length: number) => Array.from({ length }, marker);

function contents(buffer: RenderCommand[]): RenderCommand[] {
  return Array.from({ length: buffer.length }, (_, i) => buffer[i]!);
}

describe("CommandSpanMap — cursor 해석", () => {
  it("무작위 splice 뒤 경계 명령이 남은 span 은 그 명령의 자리, 첫 명령을 잃은 span 은 끝으로 해석된다 (500 건)", () => {
    const random = rng(2611);
    for (let trial = 0; trial < 500; trial += 1) {
      const buffer = createSegmentedCommandBuffer(
        markers(1 + Math.floor(random() * 60)),
      );
      const spans = new CommandSpanMap<SubtreeSpan>(buffer, new Map());
      const bounds = new Map<string, [RenderCommand, RenderCommand]>();
      const addSpans = (count: number) => {
        const now = contents(buffer);
        for (let i = 0; i < count && now.length > 0; i += 1) {
          const start = Math.floor(random() * now.length);
          const end = start + 1 + Math.floor(random() * (now.length - start));
          const key = `s${bounds.size}`;
          spans.set(key, { start, end });
          bounds.set(key, [now[start]!, now[end - 1]!]);
        }
      };
      addSpans(8);
      const splices = 1 + Math.floor(random() * 12);
      for (let s = 0; s < splices; s += 1) {
        const start = Math.floor(random() * (buffer.length + 1));
        const end = start + Math.floor(random() * (buffer.length - start + 1));
        replaceCommandRange(
          buffer,
          start,
          end,
          markers(Math.floor(random() * 8)),
        );
        addSpans(2);
      }
      const now = contents(buffer);
      for (const [key, [first, last]] of bounds) {
        const span = spans.get(key)!;
        const firstAt = now.indexOf(first);
        const lastAt = now.indexOf(last);
        if (firstAt < 0) expect(span.start).toBe(buffer.length);
        else expect(span.start).toBe(firstAt);
        if (lastAt >= 0) expect(span.end).toBe(lastAt + 1);
      }
    }
  });

  it("span 끝에 끼운 명령은 그 span 밖에 놓인다 — 앞 span 의 끝 · 뒤 span 의 시작 모두", () => {
    const base = markers(6);
    const buffer = createSegmentedCommandBuffer(base);
    const spans = new CommandSpanMap<SubtreeSpan>(
      buffer,
      new Map([
        ["left", { start: 0, end: 3 }],
        ["right", { start: 3, end: 6 }],
      ]),
    );
    replaceCommandRange(buffer, 3, 3, markers(2));
    expect(spans.get("left")).toEqual({ start: 0, end: 3 });
    expect(spans.get("right")).toEqual({ start: 5, end: 8 });
  });

  it("같은 배열을 두 번 끼워도 (조각이 겹친다) 앞에 있는 것으로 해석한다", () => {
    const buffer = createSegmentedCommandBuffer(markers(4));
    const shared = markers(3);
    replaceCommandRange(buffer, 1, 1, shared);
    const spans = new CommandSpanMap<SubtreeSpan>(
      buffer,
      new Map([["inserted", { start: 1, end: 4 }]]),
    );
    replaceCommandRange(buffer, buffer.length, buffer.length, shared);
    expect(spans.get("inserted")).toEqual({ start: 1, end: 4 });
    replaceCommandRange(buffer, 0, 1, []);
    expect(spans.get("inserted")).toEqual({ start: 0, end: 3 });
  });

  it("서로 다른 자리 200 곳을 고친 뒤에도 span 하나의 해석 단계는 segment 수의 log 에 머문다", () => {
    vi.stubEnv("NODE_ENV", "development");
    const buffer = createSegmentedCommandBuffer(markers(4000));
    const spans = new CommandSpanMap<SubtreeSpan>(
      buffer,
      new Map(
        Array.from({ length: 400 }, (_, i) => [
          `e${i}`,
          { start: i * 10, end: i * 10 + 10 },
        ]),
      ),
    );
    // 짝수 element 200 개의 명령을 같은 길이로 다시 기록한다 — 자리마다 segment +2.
    for (let i = 0; i < 400; i += 2) {
      const span = spans.get(`e${i}`)!;
      replaceCommandRange(buffer, span.start, span.end, markers(10));
      spans.set(`e${i}`, span);
    }
    resetRenderCounters();
    for (let i = 0; i < 400; i += 1)
      expect(spans.get(`e${i}`)).toEqual({ start: i * 10, end: i * 10 + 10 });
    const steps = snapshotRenderCounters().spanCursorSteps;
    // 400 span × cursor 2 × ⌈log2 401⌉ (= 9) 이 상한. 선형 해석이면 평균 ~200 × 800.
    expect(steps).toBeLessThanOrEqual(400 * 2 * 9);
  });
});
