/**
 * ADR-183 Phase 3 — 레이아웃 explain 판독 채널 계약.
 *
 * G3 게이트의 실행 형태: `layout-engine.md` 오진 대표 3건 (캐시-새로고침 /
 * 형제 성장 / 미결정 main) 이 **판독 출력만으로** 판별되는지를 시나리오로
 * 잠근다. 출력 문구가 판별 정보를 잃으면 여기가 RED — explain 이 "판정이
 * 없었다" 로 거짓 안심을 주는 회귀(R2)의 TS 쪽 감시다.
 *
 * 트레이스는 엔진의 자기 보고다 — 정합 oracle 은 Chrome parity fixture (R4).
 */

import { describe, expect, it } from "vitest";

import type { EngineTraceNode } from "../../wasm-bindings/compositionEngine";
import { createLayoutExplain, formatLayoutExplain } from "./layoutExplain";
import type { ExplainableTree } from "./layoutExplain";

function traceNode(partial: Partial<EngineTraceNode>): EngineTraceNode {
  return { handle: 7, enabled: true, dropped: 0, events: [], ...partial };
}

describe("formatLayoutExplain — 기본 계약", () => {
  it("첫 줄에 oracle 이 Chrome parity 임을 명시한다 (R4)", () => {
    const out = formatLayoutExplain("el-1", traceNode({}));
    const firstLine = out.split("\n")[0];
    expect(firstLine).toContain("el-1");
    expect(firstLine).toContain("Chrome parity");
  });

  it("게이트 off(enabled:false)와 '판정 없음(events 빈 배열)'을 구분한다", () => {
    const off = formatLayoutExplain("el-1", traceNode({ enabled: false }));
    expect(off).toContain("게이트가 꺼져");

    const empty = formatLayoutExplain("el-1", traceNode({ enabled: true }));
    expect(empty).not.toContain("게이트가 꺼져");
    expect(empty).toContain("기록된 판정 없음");
  });

  it("트레이스 null(미등록/미지원)을 별도 안내한다", () => {
    expect(formatLayoutExplain("el-x", null)).toContain("조회 실패");
  });

  it("[TS] 공급 스칼라를 엔진 판정과 분리된 줄로 병기한다 (HC4)", () => {
    const out = formatLayoutExplain(
      "el-1",
      traceNode({}),
      JSON.stringify({ contentMinWidth: 162, contentMaxWidth: 350 }),
    );
    const tsLine = out.split("\n").find((l) => l.startsWith("[TS]"));
    expect(tsLine).toBeDefined();
    expect(tsLine).toContain("contentMinWidth=162");
    expect(tsLine).toContain("contentMaxWidth=350");
  });

  it("측정 패스 이벤트는 본 solve 와 구분 태그된다 (R5)", () => {
    const out = formatLayoutExplain(
      "el-1",
      traceNode({
        events: [
          {
            measure_pass: true,
            type: "IntrinsicMeasure",
            hit: false,
            generation: 412,
            min: 162,
            max: 350,
          },
        ],
      }),
    );
    expect(out).toContain("[측정]");
  });

  it("dropped 초과분을 표시한다 — 잘린 트레이스를 완전한 것으로 읽지 않게", () => {
    // dropped 는 상한(64건) 보존 뒤의 초과 집계라 events 와 항상 동반한다.
    const out = formatLayoutExplain(
      "el-1",
      traceNode({
        dropped: 12,
        events: [
          {
            measure_pass: false,
            type: "IncrementalSkip",
            reason: "Dirty",
            avail: [350, 400],
          },
        ],
      }),
    );
    expect(out).toContain("12");
    expect(out).toMatch(/상한|잘/);
  });
});

describe("G3 — 오진 대표 3건이 출력으로 판별된다", () => {
  it("① 캐시-새로고침: AvailChanged 가 재부모화/부모 리사이즈 서명으로 읽힌다", () => {
    // 오진: "새로고침하면 정상 → store/canonical 데이터 문제". 실제로는 증분
    // skip 키(available)가 stale 한 것 — 데이터는 멀쩡하다.
    const out = formatLayoutExplain(
      "el-1",
      traceNode({
        events: [
          {
            measure_pass: false,
            type: "IncrementalSkip",
            reason: "AvailChanged",
            avail: [350, 400],
          },
        ],
      }),
    );
    expect(out).toContain("AvailChanged");
    expect(out).toMatch(/재부모화|부모 리사이즈/);
    expect(out).toContain("레이아웃 캐시");
  });

  it("② 형제 성장: HIT 가 '재계산 없이 직전 반환값 재사용' 으로 읽힌다", () => {
    // 오진: "편집하지 않은 형제가 자란다 → 그 컴포넌트 결함". 실제로는 skip
    // 이 잘못된 값을 돌려주는 것 — HIT 출력이 "이 노드는 재계산되지 않았다"
    // 를 보여주면 편집 대상이 아니라 skip 경로를 보게 된다.
    const out = formatLayoutExplain(
      "el-sibling",
      traceNode({
        events: [
          {
            measure_pass: false,
            type: "IncrementalSkip",
            reason: "Hit",
            avail: [350, 400],
          },
        ],
      }),
    );
    expect(out).toContain("HIT");
    expect(out).toMatch(/재계산 없이|직전 반환값/);
  });

  it("③ 미결정 main: avail 의 -1 센티넬이 '미결정' 으로 읽힌다", () => {
    // 오진: "justify-content 가 무시된다 → 정렬 구현 결함". height:auto 컨테이너의
    // main 은 미결정이라 여유 공간 자체가 없다 — no-op 이 CSS 정답.
    const out = formatLayoutExplain(
      "el-1",
      traceNode({
        events: [
          {
            measure_pass: false,
            type: "IncrementalSkip",
            reason: "Dirty",
            avail: [350, -1],
          },
        ],
      }),
    );
    expect(out).toContain("미결정");
    expect(out).not.toContain("(-1)"); // 숫자 노출이 아니라 이름으로 읽혀야 한다
  });
});

describe("createLayoutExplain — 게이트 흐름", () => {
  function fakeTree(overrides: Partial<ExplainableTree> = {}): ExplainableTree {
    return {
      hasNode: () => true,
      enableLayoutTrace: () => true,
      getLayoutTraceForElement: () =>
        traceNode({
          events: [
            {
              measure_pass: false,
              type: "IncrementalSkip",
              reason: "NoPrev",
              avail: [350, 400],
            },
          ],
        }),
      getLastJson: () => undefined,
      ...overrides,
    };
  }

  it("게이트 off 상태 1회차: 켜고 재현 안내를 반환한다 (Decision 1 — 살아 있는 트리)", () => {
    let enabled = false;
    const tree = fakeTree({
      enableLayoutTrace: (e) => {
        enabled = e;
        return true;
      },
      getLayoutTraceForElement: (_id) =>
        enabled ? traceNode({ enabled: true }) : traceNode({ enabled: false }),
    });
    const explain = createLayoutExplain(() => [tree]);

    const first = explain("el-1");
    expect(enabled).toBe(true);
    expect(first).toMatch(/재현|다시 호출/);
  });

  it("게이트 on 상태: 판정을 포맷해 반환한다", () => {
    const explain = createLayoutExplain(() => [fakeTree()]);
    const out = explain("el-1");
    expect(out).toContain("NoPrev");
  });

  it("어느 트리에도 없는 elementId 는 미등록 안내를 반환한다", () => {
    const explain = createLayoutExplain(() => [
      fakeTree({ hasNode: () => false }),
    ]);
    expect(explain("el-ghost")).toContain("미등록");
  });

  it("disable() 은 모든 트리의 게이트를 끈다 (R3 — 힙 반환)", () => {
    const calls: boolean[] = [];
    const tree = fakeTree({
      enableLayoutTrace: (e) => {
        calls.push(e);
        return true;
      },
    });
    const explain = createLayoutExplain(() => [tree, fakeTree(), tree]);
    explain.disable();
    expect(calls).toContain(false);
  });
});
