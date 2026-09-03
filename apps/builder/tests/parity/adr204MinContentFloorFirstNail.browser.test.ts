import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { useStore } from "@/builder/stores";
import { type Bounds, type CaseNode, domLeg, pipelineLeg } from "./harness";

/**
 * ADR-204 Phase 0 — **G0 first-nail**: §4.5 automatic minimum 의 *specified size suggestion* 절이
 * 엔진에 없다는 것이 Chrome 과의 실제 발산인가.
 *
 * ADR 본문이 세운 원인 가설은 두 겹이다 — ① 소비 가드 (`flex.rs:332` — `main_size == AUTO` 일 때만
 * content 기반 floor) · ② 공급 0 (가상화 collection 의 행이 layout 트리 자식이 아니라 content 제안 0).
 * 둘 중 ①만 이 게이트가 판정한다. **collection 은 쓰지 않는다** — collection 을 쓰면 ①과 ②가 같이
 * 움직여 어느 쪽이 원인인지 갈리지 않는다 (ADR 최초 안의 first-nail 이 그 형태였고, 주축을 AUTO 로
 * 바꾸면 공급도 0 이 되어 아무것도 판정하지 못한다 — Phase 0 에서 설계를 교체했다).
 *
 * 그래서 **자식이 실재하는 일반 상자**로 ①만 분리한다: 콘텐츠가 164 인 item 을 제약 80 의 flex
 * 컨테이너에 두고 주축 크기만 definite ↔ auto 로 바꾼다.
 *
 * | arm            | item 주축      | overflow  | Chrome (§4.5)                       | 가설상 엔진 |
 * | -------------- | -------------- | --------- | ----------------------------------- | ----------- |
 * | definite       | 164px          | visible   | min(specified 164, content 164)=164 | 80 (가드)   |
 * | auto (대조군)  | auto           | visible   | content 164                         | 164         |
 * | scroll (대조군)| 164px          | auto      | floor 0                             | 80          |
 *
 * `definite` 행에서 DOM 164 ≠ pipeline 80 이면 가설 ① 확정 → 대안 C 는 조건부가 아니라 필수.
 * 두 값이 같으면 가드는 Chrome 정합이고 collection 격차의 원인 가설을 다시 세워야 한다.
 */

type Arm = "definite" | "auto" | "scroll";
type Axis = "row" | "column";

/** 제약 flex 컨테이너 > item(overflow) > 164 콘텐츠 상자. item 주축 크기만 arm 별로 바뀐다. */
function floorCase(axis: Axis, arm: Arm): CaseNode[] {
  const isRow = axis === "row";
  // 콘텐츠 원자 — 주축 164 를 실제 자식으로 만든다 (공급 0 인 collection 과 대비되는 지점).
  const content: CaseNode = {
    label: "content",
    style: isRow
      ? { display: "block", width: "164px", height: "20px" }
      : { display: "block", width: "50px", height: "164px" },
  };
  const mainKey = isRow ? "width" : "height";
  const crossKey = isRow ? "height" : "width";
  const item: CaseNode = {
    label: "item",
    style: {
      display: "block",
      [mainKey]: arm === "auto" ? "auto" : "164px",
      [crossKey]: isRow ? "20px" : "50px",
      overflow: arm === "scroll" ? "auto" : "visible",
    },
    children: [0],
  };
  const parent: CaseNode = {
    label: "parent",
    style: {
      display: "flex",
      flexDirection: axis,
      width: isRow ? "80px" : "100px",
      height: isRow ? "40px" : "80px",
    },
    children: [1],
  };
  return [content, item, parent];
}

const AXES: Axis[] = ["row", "column"];
const ARMS: Arm[] = ["definite", "auto", "scroll"];
const AVAIL_W = 400;

interface Row {
  axis: Axis;
  arm: Arm;
  dom: number;
  pipeline: number;
}

const rows: Row[] = [];

function mainOf(axis: Axis, b: Bounds): number {
  return axis === "row" ? b.w : b.h;
}

beforeAll(async () => {
  await initCompositionEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });
  for (const axis of AXES) {
    for (const arm of ARMS) {
      const nodes = floorCase(axis, arm);
      const dom = domLeg(nodes, AVAIL_W);
      const pipeline = pipelineLeg(nodes, AVAIL_W, -1);
      rows.push({
        axis,
        arm,
        dom: mainOf(axis, dom[1]),
        pipeline: mainOf(axis, pipeline[1]),
      });
    }
  }
});

afterAll(async () => {
  const { server } = await import("vitest/browser");
  await server.commands.writeFile(
    "tests/parity/.artifacts/adr204-min-content-floor-first-nail.json",
    JSON.stringify({ measuredAt: new Date().toISOString(), rows }, null, 2),
  );
});

function row(axis: Axis, arm: Arm): Row {
  const r = rows.find((x) => x.axis === axis && x.arm === arm);
  if (!r) throw new Error(`${axis}/${arm} 미측정`);
  return r;
}

describe("ADR-204 G0 — §4.5 specified size suggestion 가드의 Chrome 발산", () => {
  it("캡처 — 2 축 × 3 arm", () => {
    for (const r of rows) {
      console.log(
        `ADR204G0 ${r.axis}/${r.arm} dom=${r.dom.toFixed(1)} pipeline=${r.pipeline.toFixed(1)}`,
      );
    }
    expect(rows).toHaveLength(AXES.length * ARMS.length);
  });

  it.each(AXES)(
    "%s — 대조군 auto: 주축이 AUTO 면 content floor 가 양쪽에서 동작한다",
    (axis) => {
      const r = row(axis, "auto");
      expect(r.dom, `${axis} auto DOM`).toBeGreaterThanOrEqual(163);
      expect(
        Math.abs(r.pipeline - r.dom),
        `${axis} auto Δ (pipeline ${r.pipeline} vs dom ${r.dom})`,
      ).toBeLessThanOrEqual(1);
    },
  );

  it.each(AXES)(
    "%s — 대조군 scroll: scroll container 는 floor 0 이라 양쪽이 부모에 맞춰 준다",
    (axis) => {
      const r = row(axis, "scroll");
      const parentMain = axis === "row" ? 80 : 80;
      expect(r.dom, `${axis} scroll DOM`).toBeLessThanOrEqual(parentMain + 1);
      expect(
        Math.abs(r.pipeline - r.dom),
        `${axis} scroll Δ (pipeline ${r.pipeline} vs dom ${r.dom})`,
      ).toBeLessThanOrEqual(1);
    },
  );

  it.each(AXES)(
    "%s — first-nail: 주축이 definite 일 때 Chrome 과 갈리는가 (갈리면 대안 C 필수)",
    (axis) => {
      const r = row(axis, "definite");
      // 판정만 하고 실패시키지 않는다 — 이 게이트의 산출물은 PASS/FAIL 이 아니라 두 값이다.
      // 다만 두 대조군이 정합인데 이 행만 갈리는 형태여야 가설 ① 이 분리된다.
      const diverges = Math.abs(r.pipeline - r.dom) > 1;
      console.log(
        `ADR204G0-VERDICT ${axis}/definite dom=${r.dom.toFixed(1)} pipeline=${r.pipeline.toFixed(1)} → ${diverges ? "발산 (가드가 원인)" : "정합 (가드는 Chrome 정합)"}`,
      );
      expect(typeof diverges).toBe("boolean");
    },
  );
});
