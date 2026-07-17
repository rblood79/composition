import { beforeAll, describe, expect, it } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { type ParityCase, runParityCase } from "./harness";

/**
 * ADR-156 Phase 1 — tree_golden 회귀 기준선 재현 (G1)
 *
 * tree_golden.rs 의 N1~N10 fixture 를 차등 하니스(harness.ts)로 재현한다. 하니스가
 * 실 DOM 을 truth 로 쓰므로, N6~N10 손계산 기준선이 실 CSS 와 어긋나면 여기서 드러난다.
 */

// ── tree_golden 회귀 기준선 N1~N10 (§2-1, G1) ──
// tree_golden.rs 의 N*_BATCH 를 그대로 이식. 전부 availW=200, availH=-1(auto).
// N1~N5 = Chrome 실측(dualRunLive C-2b). N6~N10 = 손계산 기준선.
const TREE_GOLDEN: ParityCase[] = [
  {
    name: "N1 flex-in-flex",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n1-a", style: { width: "30px", height: "20px" } },
      { label: "n1-b", style: { width: "40px", height: "20px" } },
      {
        label: "n1-row",
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          width: "200px",
          height: "20px",
        },
        children: [0, 1],
      },
      { label: "n1-c", style: { width: "50px", height: "30px" } },
      {
        label: "n1-root",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "200px",
          height: "auto",
        },
        children: [2, 3],
      },
    ],
  },
  {
    name: "N2 flex-in-grid",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n2-a1", style: { width: "40px", height: "15px" } },
      { label: "n2-a2", style: { width: "40px", height: "25px" } },
      {
        label: "n2-cell-a",
        style: { display: "flex", flexDirection: "column", height: "auto" },
        children: [0, 1],
      },
      { label: "n2-b1", style: { width: "40px", height: "30px" } },
      {
        label: "n2-cell-b",
        style: { display: "flex", flexDirection: "column", height: "auto" },
        children: [3],
      },
      {
        label: "n2-root",
        style: {
          display: "grid",
          gridTemplateColumns: ["1fr", "1fr"],
          width: "200px",
          height: "auto",
        },
        children: [2, 4],
      },
    ],
  },
  {
    name: "N3 grid-in-flex",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n3-g1", style: { height: "40px" } },
      { label: "n3-g2", style: { height: "40px" } },
      {
        label: "n3-grid",
        style: {
          display: "grid",
          gridTemplateColumns: ["1fr", "1fr"],
          gridTemplateRows: ["40px"],
          width: "200px",
          height: "40px",
        },
        children: [0, 1],
      },
      { label: "n3-foot", style: { width: "60px", height: "20px" } },
      {
        label: "n3-root",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "200px",
          height: "auto",
        },
        children: [2, 3],
      },
    ],
  },
  {
    name: "N4 gap flex column",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n4-a", style: { width: "100px", height: "30px" } },
      { label: "n4-b", style: { width: "100px", height: "40px" } },
      { label: "n4-c", style: { width: "100px", height: "20px" } },
      {
        label: "n4-root",
        style: {
          display: "flex",
          flexDirection: "column",
          rowGap: "8px",
          width: "200px",
          height: "auto",
        },
        children: [0, 1, 2],
      },
    ],
  },
  {
    name: "N5 dimension 혼재 flex row",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n5-fixed", style: { width: "50px", height: "20px" } },
      { label: "n5-auto", style: { width: "70px", height: "20px" } },
      {
        label: "n5-root",
        style: {
          display: "flex",
          flexDirection: "row",
          columnGap: "10px",
          alignItems: "flex-start",
          width: "200px",
          height: "20px",
        },
        children: [0, 1],
      },
    ],
  },
  {
    name: "N6 padded flex row (box-sizing)",
    availW: 200,
    availH: -1,
    nodes: [
      {
        label: "n6-a",
        style: {
          width: "100px",
          height: "20px",
          paddingLeft: "8px",
          paddingRight: "8px",
        },
      },
      { label: "n6-b", style: { width: "50px", height: "20px" } },
      {
        label: "n6-root",
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          width: "300px",
          height: "100px",
          paddingTop: "10px",
          paddingRight: "10px",
          paddingBottom: "10px",
          paddingLeft: "10px",
        },
        children: [0, 1],
      },
    ],
  },
  {
    name: "N7 auto-height column + flexGrow",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n7-tab", style: { width: "200px", height: "29px" } },
      { label: "n7-inner", style: { width: "50px", height: "24px" } },
      {
        label: "n7-panel",
        style: {
          display: "flex",
          flexDirection: "column",
          height: "auto",
          flexGrow: 1,
        },
        children: [1],
      },
      {
        label: "n7-tabs",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "200px",
          height: "auto",
        },
        children: [0, 2],
      },
      {
        label: "n7-root",
        style: { width: "200px", height: "1000px" },
        children: [3],
      },
    ],
  },
  {
    name: "N8 block fit-content",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n8-inner", style: { width: "120px", height: "40px" } },
      {
        label: "n8-fit",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "fit-content",
          height: "auto",
        },
        children: [0],
      },
      {
        label: "n8-root",
        style: { width: "200px", height: "300px" },
        children: [1],
      },
    ],
  },
  {
    name: "N9 display:none 자식",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n9-label", style: { width: "63px", height: "20px" } },
      { label: "n9-input", style: { width: "200px", height: "30px" } },
      {
        label: "n9-hidden",
        style: { display: "none", width: "100px", height: "16px" },
      },
      {
        label: "n9-root",
        style: {
          display: "flex",
          flexDirection: "column",
          rowGap: "6px",
          width: "200px",
          height: "auto",
        },
        children: [0, 1, 2],
      },
    ],
  },
  {
    name: "N10 flex-start column width:100%",
    availW: 200,
    availH: -1,
    nodes: [
      { label: "n10-full", style: { width: "100%", height: "24px" } },
      { label: "n10-bare", style: { height: "10px" } },
      {
        label: "n10-root",
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          width: "200px",
          height: "auto",
        },
        children: [0, 1],
      },
    ],
  },
];

describe("ADR-156 Phase 1 — 엔진 ↔ CSS 차등 하니스 (G1: tree_golden 재현)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each(TREE_GOLDEN)("$name — 엔진↔CSS 정합", (c) => {
    const bad = runParityCase(c);
    expect(bad, `${c.name} 발산:\n${bad.join("\n")}`).toEqual([]);
  });
});
