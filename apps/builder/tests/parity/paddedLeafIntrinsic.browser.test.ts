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
 * padding 있는 텍스트 leaf 의 intrinsic 폭 — padding 이중 가산 (Taffy #1018 대응, 2026-09-07)
 *
 * 부모 커널 세 개 (flex `border_main` · block `content_w + pad_border_h` · grid 기여) 는 자식의
 * content 슬롯을 **content-box** 로 읽고 자기가 pad/border 를 더한다. 그런데 leaf 의
 * `resolve_leaf_intrinsic_width` 는 스칼라 + pad_border 의 **border-box** 를 돌려줬다 — 컨테이너
 * 자식이 auto 축에서 content-box 를 돌려주는 계약과 어긋난 유일한 생산자다. 결과: 좌우 padding 이
 * 두 번 더해진다 (pipeline 실측: `paddingLeft 12` Text "Hello World" — Chrome 94.4 / 엔진 107,
 * `12 + 8` — 102.4 / 123). 세로 padding 은 높이 경로가 달라 정상 (25/25).
 *
 * production 도달: Styles 패널에서 Text 에 좌우 padding 을 준 flex/grid 자식 전부 (텍스트 leaf 는
 * TS 가 `contentMinWidth/contentMaxWidth` 스칼라를 공급하고 width 는 auto).
 *
 * `width: fit-content` / `max-content` **부모** 는 넣지 않는다 — pipeline 에서 padding 과 무관하게
 * 부모 폭이 400 (Chrome 94.4) 으로 늘어나는 별개 결함 (TS 가 컨테이너 키워드 폭을 엔진에 안 넘기거나
 * 선해석 — `TAFFY_UPSTREAM_DELTA_2026-09.md` §4-1 2026-09-07 기록). engine leg 는
 * `padded_scalar_leaf_in_fit_content_block_parent` unit 이 잠근다.
 *
 * pipeline leg 만 돈다 — 텍스트 실측정 스칼라가 production 경로이고, engine leg 의 대응 케이스는
 * `shrinkToFitInline` 의 구 `[잔존] 측정 스칼라 leaf 의 padding 이중 계산` (→ positive 전환) 이 잠근다.
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

const root = (style: StyleRecord): CaseNode =>
  ({ label: "root", style, children: [0] }) as CaseNode;

const PARENTS: Array<[string, StyleRecord]> = [
  ["flex row w400", { display: "flex", flexDirection: "row", width: "400px" }],
  [
    "flex row w120 (압박)",
    { display: "flex", flexDirection: "row", width: "120px" },
  ],
  [
    "flex column align start",
    {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      width: "400px",
    },
  ],
  [
    "grid auto col justify start",
    {
      display: "grid",
      gridTemplateColumns: ["auto"],
      justifyItems: "start",
      width: "400px",
    },
  ],
];

const PADS: Array<[string, StyleRecord]> = [
  ["paddingLeft 12", { paddingLeft: "12px" }],
  [
    "paddingLeft 12 + paddingRight 8",
    { paddingLeft: "12px", paddingRight: "8px" },
  ],
  [
    "padding 4px 12px + border 2",
    { padding: "4px 12px", border: "2px solid black" },
  ],
];

const CASES: ParityCase[] = [];
for (const [pn, ps] of PARENTS) {
  for (const [dn, ds] of PADS) {
    CASES.push({
      name: `${pn} > Text ${dn}`,
      availW: 400,
      availH: -1,
      nodes: [txt(ds), root(ps)],
    });
  }
}

const CONTROLS: ParityCase[] = [
  {
    name: "대조군 — padding 없음 / flex row",
    availW: 400,
    availH: -1,
    nodes: [
      txt(),
      root({ display: "flex", flexDirection: "row", width: "400px" }),
    ],
  },
  {
    name: "대조군 — 세로 padding 만 (높이 경로) / flex row",
    availW: 400,
    availH: -1,
    nodes: [
      txt({ paddingTop: "5px", paddingBottom: "3px" }),
      root({ display: "flex", flexDirection: "row", width: "400px" }),
    ],
  },
  {
    name: "대조군 — 명시 width 100 + paddingLeft 12 (스칼라 경로 아님) / flex row",
    availW: 400,
    availH: -1,
    nodes: [
      txt({ width: "100px", paddingLeft: "12px" }),
      root({ display: "flex", flexDirection: "row", width: "400px" }),
    ],
  },
  {
    name: "대조군 — 두 leaf 가 나란히 (형제 x 도 어긋나지 않는다) / flex row",
    availW: 400,
    availH: -1,
    nodes: [
      txt({ paddingLeft: "12px", paddingRight: "8px" }),
      {
        label: "sib",
        elementType: "Text",
        text: "Next",
        style: { ...TEXT },
      } as CaseNode,
      {
        label: "root",
        style: { display: "flex", flexDirection: "row", width: "400px" },
        children: [0, 1],
      } as CaseNode,
    ],
  },
];

describe("padding 있는 텍스트 leaf 의 intrinsic 폭 — 이중 가산 없음", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it.each([...CASES, ...CONTROLS].map((c) => [c.name, c] as const))(
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
