import { beforeAll, describe, expect, it } from "vitest";

import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";

import {
  domLeg,
  pipelineLeg,
  type CaseNode,
  type StyleRecord,
} from "./harness";

/**
 * **padding 있는 root 의 1-pass 가정 폭 — root padding 이중 차감** (사용자 live 2026-09-20)
 *
 * `layoutCache` 는 root(body) 의 padding/border 를 뺀 **content-box** 를 `availableWidth` 로
 * 넘기고, DFS 는 그 값을 "root 가 놓인 containing block 폭" 으로 읽어 `estimateChildAvailableSize`
 * 에서 root padding 을 **한 번 더** 뺐다 (390 − 48 = 342 → 294). 1-pass 가 자식 텍스트를 그 폭으로
 * 재서 `%` 폭 텍스트는 (294 × 50%) − padding 에서 줄바꿈이 늘고, Step 4.5 재측정이 건너뛰는
 * `height: 100%` (부모 미결정 → auto, TS 스칼라가 곧 높이) 에서는 그 높이가 그대로 남았다:
 * body(pad 24) > Text `width:50% · height:100% · padding 24 · pre-wrap` — Chrome 218 / Canvas 242.
 *
 * DOM 오라클은 `viewport(확정) > body(padding · min-height:100%) > Text` (bodyViewportBox 와 같은
 * 구성). 파이프라인은 layoutCache 계약대로 content-box 를 넘긴다.
 *
 * 둘째 축 — `%` 높이 측정 leaf 는 Step 4.5 후보다: 1-pass 가정 폭과 실배치 폭이 갈리는 건 root
 * padding 만이 아니다 (flex row 의 `flex: 1` 텍스트 — 가정 390, 실배치 195). 부모 블록 축이
 * 미결정이면 엔진은 TS 스칼라를 그대로 쓰므로 폭 확정 후 높이를 다시 재야 한다 (Chrome 120 / 100).
 */

const PAGE_W = 390;
const PAGE_H = 400;
const BODY_PAD = 40;
const TOL = 1.0;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BODY: StyleRecord = { display: "block", padding: `${BODY_PAD}px` };
const TEXT_BASE: StyleRecord = {
  fontFamily: "Arial",
  fontSize: 16,
  fontWeight: 400,
  lineHeight: "20px",
  whiteSpace: "pre-wrap",
  padding: "10px",
};
// Arial 16: "Hello World Again" ≈ 128px — 50% 폭의 content 135 (정상) 에는 1줄, 95 (이중 차감) 에는 2줄.
//   "Hello World Again Hello World" ≈ 215px — auto 폭의 content 290 에는 1줄, 210 에는 2줄.
const TEXT = "ABCDEFG\nHello World Again\nHello World Again Hello World\nEND";

function domBodyTextLeg(textStyle: StyleRecord): { body: Rect; text: Rect } {
  const viewport = document.createElement("div");
  viewport.style.cssText =
    `position:absolute;top:0;left:0;margin:0;padding:0;border:0;box-sizing:border-box;` +
    `width:${PAGE_W}px;height:${PAGE_H}px;overflow:auto;`;
  const body = document.createElement("div");
  body.style.cssText = `margin:0;border:0;box-sizing:border-box;overflow:auto;width:${PAGE_W}px;min-height:100%;`;
  for (const [k, v] of Object.entries(BODY)) {
    (body.style as unknown as Record<string, string>)[k] = String(v);
  }
  const text = document.createElement("div");
  text.style.cssText = "margin:0;padding:0;border:0;box-sizing:border-box;";
  for (const [k, v] of Object.entries(textStyle)) {
    (text.style as unknown as Record<string, string>)[k] = String(v);
  }
  text.textContent = TEXT;
  body.appendChild(text);
  viewport.appendChild(body);
  document.body.appendChild(viewport);
  const b = body.getBoundingClientRect();
  const t = text.getBoundingClientRect();
  document.body.removeChild(viewport);
  return {
    body: { x: 0, y: 0, w: b.width, h: b.height },
    text: { x: t.x - b.x, y: t.y - b.y, w: t.width, h: t.height },
  };
}

function pipelineBodyTextLeg(textStyle: StyleRecord): {
  body: Rect;
  text: Rect;
} {
  const nodes: CaseNode[] = [
    { label: "text", elementType: "Text", text: TEXT, style: textStyle },
    { label: "body", elementType: "body", style: BODY, children: [0] },
  ];
  // layoutCache 계약 — root padding/border 를 뺀 content-box.
  const res = pipelineLeg(nodes, PAGE_W - BODY_PAD * 2, PAGE_H - BODY_PAD * 2);
  const toRect = (b: (typeof res)[number]): Rect => ({
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
  });
  return { body: toRect(res[1]), text: toRect(res[0]) };
}

const CASES: { name: string; text: StyleRecord }[] = [
  {
    // 본 결함 — `%` 폭 × `%` 높이 (Step 4.5 가 건너뛰어 1-pass 높이가 남는다)
    name: "Text width:50% height:100% — 1-pass 가정 폭이 곧 높이",
    text: { ...TEXT_BASE, width: "50%", height: "100%" },
  },
  {
    // `%` 폭 · auto 높이 — Step 4.5 가 실배치 폭에서 다시 재 마스킹하던 케이스
    name: "Text width:50% height:auto",
    text: { ...TEXT_BASE, width: "50%" },
  },
  {
    // 폭 auto (stretch) — 1-pass 가정 폭 294 vs 실배치 310
    name: "Text width:auto height:100%",
    text: { ...TEXT_BASE, height: "100%" },
  },
  {
    // 대조군 — px 폭은 부모 폭과 무관
    name: "대조군 — Text width:140px height:100%",
    text: { ...TEXT_BASE, width: "140px", height: "100%" },
  },
];

describe("`%` 높이 측정 leaf 는 Step 4.5 재측정 후보", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });

  it("flex row > Text flex:1 height:100% — 실배치 폭 (195) 에서 다시 잰 줄 수", () => {
    const nodes: CaseNode[] = [
      {
        label: "t1",
        elementType: "Text",
        text: TEXT,
        style: { ...TEXT_BASE, flexGrow: 1, flexBasis: "0px", height: "100%" },
      },
      {
        label: "t2",
        elementType: "Text",
        text: "x",
        style: { ...TEXT_BASE, flexGrow: 1, flexBasis: "0px" },
      },
      {
        label: "body",
        elementType: "body",
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
        },
        children: [0, 1],
      },
    ];
    const dom = domLeg(nodes, PAGE_W);
    const pipe = pipelineLeg(nodes, PAGE_W, PAGE_H);
    // body 상자는 빌더 계약 (뷰포트 상자, bodyViewportBox) 이라 자식만 대조한다.
    const bad: string[] = [];
    for (const i of [0, 1]) {
      for (const f of ["x", "y", "w", "h"] as const) {
        const d = Math.abs(dom[i][f] - pipe[i][f]);
        if (d > TOL) {
          bad.push(
            `${nodes[i].label}.${f}: dom=${dom[i][f].toFixed(1)} pipe=${pipe[i][f].toFixed(1)} (Δ${d.toFixed(1)})`,
          );
        }
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
});

describe("definite block 부모 안의 `%` 높이 텍스트 — 엔진이 `%` 를 본다", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });

  // 종전엔 block 자식 텍스트의 `%` 높이를 1-pass 측정 px 로 치환해 엔진이 `%` 를 못 봤다
  //   (frame h300 pad 20: `100%` Chrome 260 / Canvas 100 · `50%` 130 / 100). flex/grid 자식과 같이
  //   `contentHeight` 스칼라 + `%` 유지 — 엔진은 `%` 해소 실패 (미결정 부모) 일 때만 스칼라를 쓴다.
  it.each([
    ["height:100% → 260", "100%"],
    ["height:50% → 130", "50%"],
  ])("block frame h300 pad 20 > Text %s", (_name, height) => {
    const nodes: CaseNode[] = [
      {
        label: "t",
        elementType: "Text",
        text: TEXT,
        style: { ...TEXT_BASE, height },
      },
      {
        label: "frame",
        style: { display: "block", height: "300px", padding: "20px" },
        children: [0],
      },
      {
        label: "body",
        elementType: "body",
        style: { display: "block" },
        children: [1],
      },
    ];
    const dom = domLeg(nodes, PAGE_W);
    const pipe = pipelineLeg(nodes, PAGE_W, PAGE_H);
    const bad: string[] = [];
    for (const i of [0, 1]) {
      for (const f of ["x", "y", "w", "h"] as const) {
        const d = Math.abs(dom[i][f] - pipe[i][f]);
        if (d > TOL) {
          bad.push(
            `${nodes[i].label}.${f}: dom=${dom[i][f].toFixed(1)} pipe=${pipe[i][f].toFixed(1)} (Δ${d.toFixed(1)})`,
          );
        }
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
});

describe("padding 있는 body root — 1-pass 가정 폭 (root padding 이중 차감 금지)", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });

  it.each(CASES.map((k) => [k.name, k] as const))("%s", (_name, k) => {
    const dom = domBodyTextLeg(k.text);
    const pipe = pipelineBodyTextLeg(k.text);
    const bad: string[] = [];
    for (const f of ["x", "y", "w", "h"] as const) {
      const d = Math.abs(dom.text[f] - pipe.text[f]);
      if (d > TOL) {
        bad.push(
          `text.${f}: dom=${dom.text[f].toFixed(1)} pipe=${pipe.text[f].toFixed(1)} (Δ${d.toFixed(1)})`,
        );
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
});
