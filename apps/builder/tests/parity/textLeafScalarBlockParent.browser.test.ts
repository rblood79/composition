import { beforeAll, describe, expect, it } from "vitest";

import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import {
  diffCase,
  domLeg,
  pipelineLeg,
  type CaseNode,
  type ParityCase,
  type StyleRecord,
} from "./harness";

/**
 * block 부모 아래 텍스트 leaf 의 측정 스칼라 — shrink-to-fit 부모에서 0 붕괴 (2026-09-07)
 *
 * `enrichWithIntrinsicSize` 의 텍스트 스칼라 (`contentMinWidth/contentMaxWidth`) 공급이
 * `(isFlexChild || isGridChild)` 로 게이트돼 있었다 — "block 자식은 stretch 되어 스칼라가 없어도
 * 된다" 는 부모가 definite 일 때만 참이다. 부모가 shrink-to-fit 이면 엔진은 내용 폭을 모른다:
 *
 * | 부모                                              | Chrome | 구 파이프라인 |
 * | ------------------------------------------------- | -----: | ------------: |
 * | block `width: max-content`                        |   82.4 |       **400** |
 * | block `max-content` + Text `paddingLeft 12`       |   94.4 |  **12** (padding 만) |
 * | block `width: min-content`                        |   41.5 |       **400** |
 * | column `align-items: center` > block (Container Align) | 82.4 | **0**    |
 *
 * engine leg 는 스칼라 atom 으로 전부 정합이었다 (엔진 결함 아님 — TS 공급 결함).
 * 대조군: definite block 부모 (stretch — 스칼라가 있어도 block.rs AUTO 분기는 content_w 를 안 읽는다) ·
 * `width: 50%` (확정 해소 — 스칼라 미소비).
 */

const TEXT: StyleRecord = {
  width: "auto",
  fontSize: 16,
  fontFamily: "Arial",
  fontWeight: 400,
  lineHeight: "20px",
};

const txt = (extra: StyleRecord = {}): CaseNode =>
  ({
    label: "txt",
    elementType: "Text",
    text: "Hello World",
    style: { ...TEXT, ...extra },
  }) as CaseNode;

const box = (style: StyleRecord): CaseNode =>
  ({ label: "box", style, children: [0] }) as CaseNode;

const ROOT: CaseNode = {
  label: "root",
  style: { display: "block", width: "400px" },
  children: [1],
} as CaseNode;

const c = (name: string, nodes: CaseNode[]): ParityCase => ({
  name,
  availW: 400,
  availH: -1,
  nodes,
});

const CASES: ParityCase[] = [
  c("block max-content > Text auto → 82.4", [
    txt(),
    box({ display: "block", width: "max-content" }),
    ROOT,
  ]),
  c("block max-content > Text auto paddingLeft 12 → 94.4", [
    txt({ paddingLeft: "12px" }),
    box({ display: "block", width: "max-content" }),
    ROOT,
  ]),
  c("block min-content > Text auto → 41.5 (2줄)", [
    txt(),
    box({ display: "block", width: "min-content" }),
    ROOT,
  ]),
  c("block fit-content > Text auto → 82.4", [
    txt(),
    box({ display: "block", width: "fit-content" }),
    ROOT,
  ]),
  c("Container Align — column align center > block > Text auto → 82.4 @ 158.8", [
    txt(),
    box({ display: "block" }),
    {
      label: "root",
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "400px",
      },
      children: [1],
    } as CaseNode,
  ]),
];

const CONTROLS: ParityCase[] = [
  c("대조군 — definite block w400 > Text auto → stretch 400", [
    txt(),
    box({ display: "block", width: "400px" }),
    ROOT,
  ]),
  c("대조군 — definite block w400 > Text auto paddingLeft 12 → 400", [
    txt({ paddingLeft: "12px" }),
    box({ display: "block", width: "400px" }),
    ROOT,
  ]),
  c("대조군 — block w400 > Text width:50% → 200 (스칼라 미소비)", [
    txt({ width: "50%" }),
    box({ display: "block", width: "400px" }),
    ROOT,
  ]),
];

describe("block 부모 아래 텍스트 leaf 의 측정 스칼라 — shrink-to-fit 부모", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each([...CASES, ...CONTROLS].map((k) => [k.name, k] as const))(
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
