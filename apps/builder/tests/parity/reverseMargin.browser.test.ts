import { beforeAll, describe, expect, it } from "vitest";

import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import {
  diffCase,
  domLeg,
  engineLeg,
  pipelineLeg,
  type CaseNode,
  type ParityCase,
  type StyleRecord,
} from "./harness";

/**
 * reverse 축의 margin start/end 역할 — 반사는 **위치만** 뒤집는다
 *
 * 엔진은 `*-reverse` 를 **정방향 배치 + 기하 반사**로 구현한다 (`tree.rs` 3.9).
 * 반사는 좌표를 뒤집지만, margin 이 아이템의 **어느 쪽에 붙는지**는 바꾸지 못한다.
 * `row-reverse` 의 main-start 는 오른쪽이라 main-start margin = physical
 * `margin-right` 인데, 물리 margin 을 그대로 커널에 넘기면 커널이 `margin-left` 를
 * main-start 로 써서 반사 후 margin 이 반대편에 남는다.
 *
 * 실측(2026-07-27) — 어긋남이 **정확히 margin 값**이라 진단이 쉽다:
 *   `row-reverse` + `marginLeft:20px` → DOM 260 / 구 엔진 240
 *   `column-reverse` + `marginTop:20px` → DOM 160 / 구 엔진 140
 *   `wrap-reverse` + `marginTop:20px` → DOM 260 / 구 엔진 240
 *
 * **auto margin 과 무관한 별개 결함**이다 — 고정 margin 에서도 재현되므로
 * `autoMargin.browser.test.ts` 와 분리해 둔다. 다만 auto 마스크도 같은 축에서
 * 뒤집어야 흡수 쪽이 맞으므로, 여기서 두 형태를 함께 잠근다.
 *
 * 대조군(justify-content / 비대칭 padding)은 반사 자체가 정상임을 보인다 — 어긋난
 * 것은 반사가 아니라 **아이템별 margin 의 축 역할**이다.
 */

const box = (
  label: string,
  style: StyleRecord,
  children?: number[],
): CaseNode => ({ label, style, children }) as CaseNode;

function flexCase(
  name: string,
  container: StyleRecord,
  kids: StyleRecord[],
): ParityCase {
  return {
    name,
    availW: 400,
    availH: 600,
    nodes: [
      ...kids.map((s, i) => box(`c${i}`, s)),
      box(
        "flex",
        { display: "flex", flexWrap: "nowrap", ...container },
        kids.map((_, i) => i),
      ),
      box("root", { display: "block", width: "400px", height: "600px" }, [
        kids.length,
      ]),
    ],
  };
}

const KID: StyleRecord = { width: "40px", height: "40px" };
const CASES: ParityCase[] = [];

// ── 고정 margin — 정방향/역방향 양쪽 (역방향만 어긋났었다) ──
for (const dir of ["row", "row-reverse"]) {
  for (const side of ["marginLeft", "marginRight"]) {
    CASES.push(
      flexCase(
        `${dir} / ${side} 20px`,
        { flexDirection: dir, width: "300px", height: "100px" },
        [{ ...KID, [side]: "20px" }, KID],
      ),
    );
  }
}
for (const dir of ["column", "column-reverse"]) {
  for (const side of ["marginTop", "marginBottom"]) {
    CASES.push(
      flexCase(
        `${dir} / ${side} 20px`,
        { flexDirection: dir, width: "300px", height: "200px" },
        [{ ...KID, [side]: "20px" }, KID],
      ),
    );
  }
}

// ── reverse 축의 cross margin (main 반전과 헷갈리지 않게 대조) ──
CASES.push(
  flexCase(
    "row-reverse / marginTop 20px (cross 는 반전 아님)",
    { flexDirection: "row-reverse", width: "300px", height: "200px" },
    [{ ...KID, marginTop: "20px" }, KID],
  ),
  flexCase(
    "column-reverse / marginLeft 20px (cross 는 반전 아님)",
    { flexDirection: "column-reverse", width: "300px", height: "200px" },
    [{ ...KID, marginLeft: "20px" }, KID],
  ),
);

// ── auto margin × reverse ──
CASES.push(
  flexCase(
    "row-reverse / marginLeft auto",
    { flexDirection: "row-reverse", width: "300px", height: "100px" },
    [{ ...KID, marginLeft: "auto" }, KID],
  ),
  flexCase(
    "row-reverse / marginRight auto",
    { flexDirection: "row-reverse", width: "300px", height: "100px" },
    [{ ...KID, marginRight: "auto" }, KID],
  ),
  flexCase(
    "column-reverse / marginTop auto",
    { flexDirection: "column-reverse", width: "300px", height: "200px" },
    [{ ...KID, marginTop: "auto" }, KID],
  ),
  flexCase(
    "row-reverse / cross marginTop auto",
    {
      flexDirection: "row-reverse",
      alignItems: "flex-start",
      width: "300px",
      height: "200px",
    },
    [{ ...KID, marginTop: "auto" }, KID],
  ),
);

// ── wrap-reverse (cross 축 반전) ──
for (const wrap of ["wrap", "wrap-reverse"]) {
  for (const [tag, m] of [
    ["marginTop 20px", { marginTop: "20px" }],
    ["marginBottom 20px", { marginBottom: "20px" }],
    ["marginTop auto", { marginTop: "auto" }],
  ] as Array<[string, StyleRecord]>) {
    CASES.push({
      name: `${wrap} / ${tag}`,
      availW: 400,
      availH: 600,
      nodes: [
        box("c0", { width: "100px", height: "40px", ...m }),
        box("c1", { width: "100px", height: "40px" }),
        box("c2", { width: "100px", height: "40px" }),
        box(
          "flex",
          {
            display: "flex",
            flexDirection: "row",
            flexWrap: wrap,
            alignItems: "flex-start",
            alignContent: "flex-start",
            width: "250px",
            height: "300px",
          },
          [0, 1, 2],
        ),
        box("root", { display: "block", width: "400px", height: "600px" }, [3]),
      ],
    });
  }
}

// ── 대조군 — 반사 자체는 정상 (컨테이너 수준 정렬/padding) ──
CASES.push(
  flexCase(
    "대조군: row-reverse / justify-content:flex-end",
    {
      flexDirection: "row-reverse",
      justifyContent: "flex-end",
      width: "300px",
      height: "100px",
    },
    [KID, KID],
  ),
  flexCase(
    "대조군: row-reverse / 비대칭 padding",
    {
      flexDirection: "row-reverse",
      width: "300px",
      height: "100px",
      paddingLeft: "30px",
      paddingRight: "10px",
    },
    [KID, KID],
  ),
);

describe("reverse 축 margin 역할 — CSS 대조", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(CASES.map((c) => [c.name, c] as const))(
    "engine leg — %s",
    (_name, c) => {
      const bad = diffCase(
        c.nodes,
        domLeg(c.nodes, c.availW),
        engineLeg(c.nodes, c.availW, c.availH),
      );
      expect(bad, bad.join("\n")).toEqual([]);
    },
  );

  it.each(CASES.map((c) => [c.name, c] as const))(
    "pipeline leg — %s",
    (_name, c) => {
      const bad = diffCase(
        c.nodes,
        domLeg(c.nodes, c.availW),
        pipelineLeg(c.nodes, c.availW, c.availH),
      );
      expect(bad, bad.join("\n")).toEqual([]);
    },
  );
});
