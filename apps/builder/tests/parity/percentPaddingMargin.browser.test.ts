import { beforeAll, describe, expect, it } from "vitest";

import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";

import {
  diffCase,
  domLeg,
  pipelineLeg,
  type CaseNode,
  type ParityCase,
  type StyleRecord,
} from "./harness";

/**
 * **`%` padding / margin 은 엔진이 containing block 폭으로 푼다** (2026-09-20)
 *
 * 파이프라인의 세 직렬화 지점 (`applyCommonEngineStyle` padding · block/flex 어댑터 margin · grid
 * branch margin) 이 `parsePadding(style)` / `parseMargin(style)` 을 containerWidth 없이 불러 `%` 를
 * **0 으로 떨어뜨렸다** — Frame `padding: 10%` 안의 Text 가 Chrome x 39 / Canvas 0. 엔진은 길이
 * 문자열의 `%` 를 `resolve_dimension(ctx_for(avail_w))` 로 이미 푼다 (padding · margin 네 변 모두
 * 포함 블록 inline 크기 기준 — CSS-BOX-4 §3.1 · §4.1). TS 는 `%` 를 문자열 그대로 통과시킨다.
 *
 * 오라클은 실 DOM. 컨테이너 안 자식 좌표 (부모 상대) 와 크기를 본다 — `%` 는 **부모의 폭** (자기 폭
 * 아님) 이고 세로 변도 폭 기준이다.
 */

const BOX: StyleRecord = { width: "100px", height: "40px" };
const ROOT = (children: number[], style: StyleRecord = {}): CaseNode =>
  ({
    label: "root",
    style: { display: "block", width: "400px", ...style },
    children,
  }) as CaseNode;

const c = (name: string, nodes: CaseNode[]): ParityCase => ({
  name,
  availW: 400,
  availH: -1,
  nodes,
});

const CASES: ParityCase[] = [
  c("block frame padding:10% > box → 자식 x/y 40 (폭 400 기준, 세로도)", [
    { label: "child", style: BOX },
    {
      label: "frame",
      style: { display: "block", padding: "10%" },
      children: [0],
    },
    ROOT([1]),
  ]),
  c("block frame paddingLeft:5% paddingTop:10% (longhand) > box", [
    { label: "child", style: BOX },
    {
      label: "frame",
      style: { display: "block", paddingLeft: "5%", paddingTop: "10%" },
      children: [0],
    },
    ROOT([1]),
  ]),
  c("block 자식 margin: 5% 10% → x 40 · y 20", [
    { label: "child", style: { ...BOX, margin: "5% 10%" } },
    ROOT([0]),
  ]),
  c("block 자식 marginLeft:25% (longhand)", [
    { label: "child", style: { ...BOX, marginLeft: "25%" } },
    ROOT([0]),
  ]),
  c("flex row > 자식 padding:5% · marginLeft:10%", [
    { label: "a", style: { ...BOX, padding: "5%" } },
    { label: "b", style: { ...BOX, marginLeft: "10%" } },
    ROOT([0, 1], { display: "flex", flexDirection: "row" }),
  ]),
  c("flex column > 자식 paddingTop:10% (세로 변도 부모 폭 기준)", [
    { label: "a", style: { ...BOX, paddingTop: "10%" } },
    { label: "b", style: BOX },
    ROOT([0, 1], { display: "flex", flexDirection: "column" }),
  ]),
  // grid item 의 `%` 는 grid **area** 폭 (열 200) 기준 — 10. 컨테이너 높이는 명시 — auto 행의 `%`
  //   margin 은 행 기여에서 0 (기준인 area 폭이 열 sizing 뒤라 순환, px margin 은 gridContainerBlockSize
  //   A9~A11 이 잠근다).
  c("grid 2열 h100 > 자식 margin:5% (grid branch 직렬화 · area 폭 기준 10)", [
    { label: "a", style: { ...BOX, margin: "5%" } },
    { label: "b", style: BOX },
    ROOT([0, 1], {
      display: "grid",
      gridTemplateColumns: ["1fr", "1fr"],
      height: "100px",
    }),
  ]),
  c("grid 컨테이너 padding:10% > 자식", [
    { label: "a", style: BOX },
    {
      label: "grid",
      style: {
        display: "grid",
        gridTemplateColumns: ["1fr", "1fr"],
        padding: "10%",
      },
      children: [0],
    },
    ROOT([1]),
  ]),
  c("대조군 — margin: 10px auto (auto 는 그대로)", [
    { label: "child", style: { ...BOX, margin: "10px auto" } },
    ROOT([0]),
  ]),
];

describe("`%` padding / margin — 엔진 containing block 폭 해석 (TS 통과)", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });

  it.each(CASES.map((k) => [k.name, k] as const))(
    "pipeline leg — %s",
    (_name, k) => {
      const bad = diffCase(
        k.nodes,
        domLeg(k.nodes, k.availW),
        pipelineLeg(k.nodes, k.availW, k.availH),
      );
      expect(bad, bad.join("\n")).toEqual([]);
    },
  );
});
