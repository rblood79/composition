/**
 * ADR-916 Phase 2-B seam 배선 (B2) — 실제 WASM 엔진 dual-run self-diff
 *
 * `dualRunHarness.test.ts` 는 **mock**(주입 layoutFn)으로 diff 산술만 검증한다.
 * 본 테스트는 **실제 두 WASM 엔진**을 로드해 같은 batch 를 먹이는, 지금까지
 * 미구축이던 경로를 실증한다:
 *
 *   1. 자체 vs 자체 self-diff → diff 0 (하네스가 실제 엔진에서도 정확한가)
 *   2. 자체 vs Taffy 비교 → 두 엔진의 실제 layout 차이 측정 (HC3 2단)
 *
 * (2) 의 결과가 (C) createLayoutEngine flag 전환 가능 여부를 결정한다. 자체 엔진의
 * 미해결 영역(flex column height:auto 등)이 실제 배치에서 diff 를 내면, 그 영역이
 * flag 전환 전 선결 과제로 확정된다.
 *
 * ## pkg 의존
 *
 * 두 pkg 는 gitignore 된 wasm-pack 산출물(`--target bundler`)이다. 본 테스트는
 * pkg 존재 + vitest.config 의 `vite-plugin-wasm` 등록을 전제한다. pkg 미빌드 시
 * import 가 실패하므로, CI 파이프라인은 테스트 전 두 pkg 를 빌드해야 한다
 * (`wasm-pack build ... --target bundler`).
 *
 * ## seam 미배선
 *
 * 본 테스트는 self 엔진을 createLayoutEngine seam 에 배선하지 않는다 — dual-run
 * self-diff 를 **측정**만 한다. flag 전환은 (2) 비교 통과 후 별도 단위(C).
 */

import { describe, it, expect } from "vitest";
import { LayoutEngine } from "../../../../../../../../packages/composition-engine/pkg/composition_engine.js";
import { TaffyLayoutEngine } from "../../wasm-bindings/pkg/composition_wasm.js";
import { adaptSelfEngine, adaptTaffyEngine } from "./dualRunEngines";
import { runDualLayout, formatViolations } from "./dualRunHarness";
import type { PersistentBatchNode } from "./persistentTaffyTree";

/**
 * native cargo test(tree.rs)로 이미 검증된 케이스들의 post-order batch.
 *
 * flex ROW + fixed dimensions 만 사용 — 자체 엔진의 미해결 영역(flex column
 * height:auto sentinel)을 피해, 하네스/어댑터 정확성을 격리 검증한다. (자체 vs
 * Taffy 실전 비교에서 미해결 영역을 노출하는 건 별도 넓은 fixture 의 몫.)
 */
const FLEX_ROW_BATCH: PersistentBatchNode[] = [
  {
    elementId: "leaf-a",
    style: { width: "30px", height: "20px" },
    children: [],
  },
  {
    elementId: "leaf-b",
    style: { width: "40px", height: "20px" },
    children: [],
  },
  {
    elementId: "root",
    style: {
      display: "flex",
      flexDirection: "row",
      alignItems: "flex-start",
      width: "200px",
      height: "50px",
    },
    children: [0, 1],
  },
];

const SPACE = { availableWidth: 200, availableHeight: 50 };

describe("dual-run 실제 WASM 엔진 (ADR-916 Phase 2-B seam B2)", () => {
  it("자체 엔진 self-diff → diff 0 (실제 WASM 에서 하네스 정확성 확증)", () => {
    const a = adaptSelfEngine(new LayoutEngine());
    const b = adaptSelfEngine(new LayoutEngine());

    const result = runDualLayout(FLEX_ROW_BATCH, "root", SPACE, a, b);

    expect(result.nodeCount).toBe(FLEX_ROW_BATCH.length);
    expect(result.pass).toBe(true);
    expect(result.numericViolations).toHaveLength(0);
    expect(result.pixelViolations).toHaveLength(0);
  });

  it("자체 엔진 leaf 값이 실제 스타일과 일치 (30x20, 40x20)", () => {
    const e = adaptSelfEngine(new LayoutEngine());
    const handles = e.buildTreeBatch(
      JSON.stringify(
        FLEX_ROW_BATCH.map((n) => ({ style: n.style, children: n.children })),
      ),
    );
    const rootHandle = handles[handles.length - 1];
    e.computeLayout(rootHandle, SPACE.availableWidth, SPACE.availableHeight);
    const layouts = e.getLayoutsBatch(handles);

    const leafA = layouts.get(handles[0]);
    const leafB = layouts.get(handles[1]);
    expect(leafA).toMatchObject({ width: 30, height: 20 });
    expect(leafB).toMatchObject({ width: 40, height: 20 });
    // flex row: leaf-b 는 leaf-a(30px) 뒤 → x=30
    expect(leafA?.x).toBe(0);
    expect(leafB?.x).toBe(30);
  });

  it("Taffy 엔진도 동일 batch 계약으로 로드/계산된다", () => {
    const t = adaptTaffyEngine(new TaffyLayoutEngine());
    expect(t.isAvailable()).toBe(true);
    const handles = t.buildTreeBatch(
      JSON.stringify(
        FLEX_ROW_BATCH.map((n) => ({ style: n.style, children: n.children })),
      ),
    );
    expect(handles).toHaveLength(FLEX_ROW_BATCH.length);
    const rootHandle = handles[handles.length - 1];
    t.computeLayout(rootHandle, SPACE.availableWidth, SPACE.availableHeight);
    const layouts = t.getLayoutsBatch(handles);
    // Taffy leaf 값 확인 (자체 엔진과 동일해야 함)
    expect(layouts.get(handles[0])).toMatchObject({ width: 30, height: 20 });
    expect(layouts.get(handles[1])).toMatchObject({ width: 40, height: 20 });
  });

  it("자체 vs Taffy 실전 비교 — flex row fixed 는 HC3 통과 (측정)", () => {
    const self = adaptSelfEngine(new LayoutEngine());
    const taffy = adaptTaffyEngine(new TaffyLayoutEngine());

    // reference = Taffy(현행), candidate = 자체 엔진
    const result = runDualLayout(FLEX_ROW_BATCH, "root", SPACE, taffy, self);

    // 진단 로그 — 위반 시 어느 노드/필드가 갈리는지
    if (!result.pass) {
      // eslint-disable-next-line no-console
      console.log(formatViolations(result));
    }

    expect(result.nodeCount).toBe(FLEX_ROW_BATCH.length);
    // flex row + fixed dimension 은 두 엔진이 CSS 명세상 동일 결과여야 함
    expect(result.pass).toBe(true);
  });
});

/**
 * ADR-916 Phase 2-B seam 배선 (C-1) — 실전 catalog 대표 패턴 dual-run 진단
 *
 * (C) createLayoutEngine flag 전환은 **실전 배치에서 자체 vs Taffy diff 0** 이
 * 전제다([[feedback-no-dormant-foundation-ahead-of-flip]]). catalog containerStyles
 * 는 flexDirection:"column" / grid / block 을 실제로 쓰므로, 이 세 패턴 + height:auto
 * (컨테이너 intrinsic) 조합이 실전 대표다.
 *
 * ## 측정 결과 (2026-07-04) — flag 전환 **차단**
 *
 * | 패턴                    | 자체 vs Taffy diff        | 상태 |
 * | ----------------------- | ------------------------- | ---- |
 * | block height:auto       | diff 0                    | ✅   |
 * | flex column height:auto | h=0 붕괴 (자식 축소+y겹침) | ❌   |
 * | grid height:auto        | 셀 h +50 (intrinsic 미측정) | ❌   |
 *
 * flex column: 자체 엔진이 avail_h=-1(height:auto sentinel)을 flex main available
 * 로 받아 자식을 shrink → h=0. flex.rs §9.7 이 main available 음수를 미처리
 * (Phase 1 flex.rs 후속). grid: 자체 grid.rs 가 셀 높이를 intrinsic 대신
 * available 로 채움 → intrinsic track 미측정(Phase 1-B grid.rs 후속).
 *
 * **따라서 (C-2) flag 전환은 flex.rs main-negative + grid.rs intrinsic track
 * 선결 후에만 가능.** 본 테스트는 그 선결 경계를 못박는다 — flex.rs/grid.rs
 * 수정 후 아래 `toBe(true)` 로 뒤집히면 flag 전환 준비 완료 신호.
 */
const BLOCK_AUTO_BATCH: PersistentBatchNode[] = [
  { elementId: "b1", style: { height: "30px" }, children: [] },
  { elementId: "b2", style: { height: "40px" }, children: [] },
  {
    elementId: "root",
    style: { display: "block", width: "200px", height: "auto" },
    children: [0, 1],
  },
];

const FLEX_COLUMN_AUTO_BATCH: PersistentBatchNode[] = [
  { elementId: "c1", style: { width: "100px", height: "30px" }, children: [] },
  { elementId: "c2", style: { width: "100px", height: "40px" }, children: [] },
  {
    elementId: "root",
    style: {
      display: "flex",
      flexDirection: "column",
      width: "200px",
      height: "auto",
    },
    children: [0, 1],
  },
];

const GRID_AUTO_BATCH: PersistentBatchNode[] = [
  { elementId: "g1", style: { height: "50px" }, children: [] },
  { elementId: "g2", style: { height: "50px" }, children: [] },
  {
    elementId: "root",
    style: {
      display: "grid",
      gridTemplateColumns: ["1fr", "1fr"],
      width: "200px",
      height: "auto",
    },
    children: [0, 1],
  },
];

/** height:auto → 컨테이너 available height sentinel(-1). */
const AUTO_SPACE = { availableWidth: 200, availableHeight: -1 };

describe("dual-run 실전 catalog 진단 (ADR-916 Phase 2-B seam C-1)", () => {
  it("block height:auto → 자체 vs Taffy diff 0 (flag 전환 준비됨)", () => {
    const self = adaptSelfEngine(new LayoutEngine());
    const taffy = adaptTaffyEngine(new TaffyLayoutEngine());
    const result = runDualLayout(
      BLOCK_AUTO_BATCH,
      "root",
      AUTO_SPACE,
      taffy,
      self,
    );
    if (!result.pass) {
      // eslint-disable-next-line no-console
      console.log("block:", formatViolations(result));
    }
    expect(result.pass).toBe(true);
  });

  it("flex column height:auto → 자체 vs Taffy diff 0 (선결 해소: flex.rs main-negative)", () => {
    const self = adaptSelfEngine(new LayoutEngine());
    const taffy = adaptTaffyEngine(new TaffyLayoutEngine());
    const result = runDualLayout(
      FLEX_COLUMN_AUTO_BATCH,
      "root",
      AUTO_SPACE,
      taffy,
      self,
    );
    // flex.rs §9.7/§9.3 main available 음수(sentinel) intrinsic 처리 land 후 통과.
    // (이전: 자체가 avail_h=-1 을 shrink 로 오처리 → 자식 h=0 붕괴 diff 발생.)
    if (!result.pass) {
      // eslint-disable-next-line no-console
      console.log("flex column:", formatViolations(result));
    }
    expect(result.pass).toBe(true);
  });

  it("grid height:auto → 현재 diff 발생 (flag 전환 선결: grid.rs intrinsic track)", () => {
    const self = adaptSelfEngine(new LayoutEngine());
    const taffy = adaptTaffyEngine(new TaffyLayoutEngine());
    const result = runDualLayout(
      GRID_AUTO_BATCH,
      "root",
      AUTO_SPACE,
      taffy,
      self,
    );
    // 자체 grid.rs 는 셀 높이를 intrinsic 대신 available 로 채움 → 셀 h 갈림.
    // grid.rs intrinsic track 측정 후 이 기대를 pass=true 로 뒤집는다.
    expect(result.pass).toBe(false);
    const heightViolated = result.numericViolations.some(
      (v) => v.field === "height",
    );
    expect(heightViolated).toBe(true);
  });
});
