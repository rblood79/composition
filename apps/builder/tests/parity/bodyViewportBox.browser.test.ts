import { beforeAll, describe, expect, it } from "vitest";

import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import { pipelineLeg, type CaseNode, type StyleRecord } from "./harness";

/**
 * **body 는 뷰포트가 아니다** — 상자는 뷰포트, 배치는 내용 (2026-07-28)
 *
 * Chrome 은 페이지를 **두 노드**로 처리한다:
 *
 * | | Chrome | 캔버스 |
 * | --- | --- | --- |
 * | 뷰포트(ICB) | 확정 높이 · clip + scroll | **없음** |
 * | body | `min-height:100vh` · height auto → 내용만큼 자람 | 두 역할 겸함 |
 *
 * `fullTreeLayout` Step 1.5 는 뷰포트 노드가 없어 body 에 `height = pageH` 를 주입해
 * 두 역할을 겸하게 했다. `display:block` 에서는 충돌하지 않지만, body 가 **세로 flex
 * 컨테이너**가 되는 순간 "뷰포트 크기" 가 "main-size 예산" 으로 재해석되어 자식을
 * 압축한다 — 실측(components 페이지, 390×844): 자식 합 1423 이 정확히 844 로 눌리고
 * (ListBox 162→35.6 / GridList 164→29.4 / Card 322→85.6) 카드 내용 305 가 85.6 상자를
 * 넘어 다음 형제 위로 겹쳤다.
 *
 * 그래서 세로 flex body 에만 `min-height` 를 주고(압축 소멸), **보고 높이는 뷰포트
 * 상자로 되돌린다**(clip · `maxScrollTop` 기준 보존).
 *
 * ## leg 구성
 * - **Chrome 오라클**: `viewport(확정) > body(min-height:100%) > 자식` 을 실 DOM 으로
 *   세워 측정. 캔버스 파이프라인의 자식 배치가 이것과 같아야 한다.
 * - **파이프라인**: `calculateFullTreeLayout` 을 root `type:"body"` 로 호출(= 주입 발화).
 *
 * 자식 좌표는 **Chrome 대조**, body 상자 높이는 **빌더 계약**(뷰포트 상자)이라 오라클
 * 대응물이 없다 — 두 축을 따로 단언한다.
 */

const PAGE_W = 390;
const PAGE_H = 400;
const TOL = 1.0;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Chrome 오라클 — `viewport(확정) > body(min-height:100%) > 자식`, 좌표는 body 상대. */
function domViewportBodyLeg(
  bodyStyle: StyleRecord,
  childStyles: StyleRecord[],
): { body: Rect; children: Rect[] } {
  const viewport = document.createElement("div");
  viewport.style.cssText =
    `position:absolute;top:0;left:0;margin:0;padding:0;border:0;box-sizing:border-box;` +
    `width:${PAGE_W}px;height:${PAGE_H}px;overflow:auto;`;

  const body = document.createElement("div");
  body.style.cssText =
    "margin:0;padding:0;border:0;box-sizing:border-box;overflow:auto;";
  for (const [k, v] of Object.entries(bodyStyle)) {
    (body.style as unknown as Record<string, string>)[k] = String(v);
  }
  // 빌더 주입 대응 — 폭은 확정, 블록 축은 하한만 (Chrome body 의 `min-height:100vh`).
  body.style.width = `${PAGE_W}px`;
  body.style.minHeight = "100%";

  const children = childStyles.map((style) => {
    const el = document.createElement("div");
    el.style.cssText = "margin:0;padding:0;border:0;box-sizing:border-box;";
    for (const [k, v] of Object.entries(style)) {
      (el.style as unknown as Record<string, string>)[k] = String(v);
    }
    body.appendChild(el);
    return el;
  });

  viewport.appendChild(body);
  document.body.appendChild(viewport);

  const bodyRect = body.getBoundingClientRect();
  const toRect = (el: Element): Rect => {
    const r = el.getBoundingClientRect();
    return {
      x: r.x - bodyRect.x,
      y: r.y - bodyRect.y,
      w: r.width,
      h: r.height,
    };
  };
  const out = {
    body: { x: 0, y: 0, w: bodyRect.width, h: bodyRect.height },
    children: children.map(toRect),
  };

  document.body.removeChild(viewport);
  return out;
}

/** 파이프라인 leg — root `type:"body"` 로 Step 1.5 주입을 발화시킨다. */
function pipelineBodyLeg(
  bodyStyle: StyleRecord,
  childStyles: StyleRecord[],
): { body: Rect; children: Rect[] } {
  const nodes: CaseNode[] = [
    ...childStyles.map((style, i) => ({ label: `c${i}`, style })),
    {
      label: "body",
      style: bodyStyle,
      elementType: "body",
      children: childStyles.map((_, i) => i),
    },
  ];
  const res = pipelineLeg(nodes, PAGE_W, PAGE_H);
  const rootIdx = nodes.length - 1;
  const toRect = (b: (typeof res)[number]): Rect => ({
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
  });
  return {
    body: toRect(res[rootIdx]),
    children: childStyles.map((_, i) => toRect(res[i])),
  };
}

function diffChildren(
  labelPrefix: string,
  expected: Rect[],
  actual: Rect[],
): string[] {
  const bad: string[] = [];
  for (let i = 0; i < expected.length; i++) {
    for (const f of ["x", "y", "w", "h"] as const) {
      const d = Math.abs(expected[i][f] - actual[i][f]);
      if (d > TOL) {
        bad.push(
          `${labelPrefix}c${i}.${f}: dom=${expected[i][f].toFixed(1)} pipe=${actual[i][f].toFixed(1)} (Δ${d.toFixed(1)})`,
        );
      }
    }
  }
  return bad;
}

const COLUMN_FLEX: StyleRecord = {
  display: "flex",
  flexDirection: "column",
  overflow: "auto",
};

describe("body 뷰포트 상자 ↔ 내용 배치 분리", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  describe("Chrome 대조 — 자식 배치", () => {
    const CASES: {
      name: string;
      body: StyleRecord;
      children: StyleRecord[];
    }[] = [
      {
        // 본 결함의 최소 재현 — 자식 합(1200) > 페이지(400).
        name: "세로 flex + 넘치는 자식: 압축 없음",
        body: COLUMN_FLEX,
        children: [
          { height: "400px" },
          { height: "400px" },
          { height: "400px" },
        ],
      },
      {
        // overflow 가 §4.5 floor 를 없애는 자식(구 구현에서 압축을 전량 흡수하던 3종).
        name: "세로 flex + overflow 자식: 압축 없음",
        body: COLUMN_FLEX,
        children: [
          { height: "300px", overflow: "hidden" },
          { height: "300px" },
          { height: "300px", overflow: "auto" },
        ],
      },
      {
        // 내용이 페이지보다 짧을 때 — min-height 로 body 가 페이지를 채워 정렬이 산다.
        name: "세로 flex + 짧은 내용: justify-content 보존",
        body: { ...COLUMN_FLEX, justifyContent: "center" },
        children: [{ height: "100px" }],
      },
      {
        // 프레임 페이지 content 슬롯 형태 — 엔진 §9.4→§9.7 재분배가 없으면 0 으로 붕괴.
        name: "세로 flex + flexGrow 자식: 페이지를 채운다",
        body: COLUMN_FLEX,
        children: [
          { height: "60px", flexShrink: 0 },
          { flexGrow: 1, minHeight: "0px" },
        ],
      },
      {
        name: "세로 flex + gap: 넘쳐도 gap 유지",
        body: { ...COLUMN_FLEX, rowGap: "20px" },
        children: [
          { height: "300px" },
          { height: "300px" },
          { height: "300px" },
        ],
      },
    ];

    for (const c of CASES) {
      it(c.name, () => {
        const dom = domViewportBodyLeg(c.body, c.children);
        const pipe = pipelineBodyLeg(c.body, c.children);
        expect(diffChildren("", dom.children, pipe.children)).toEqual([]);
      });
    }
  });

  describe("빌더 계약 — body 상자는 뷰포트 크기", () => {
    // clip 높이이자 `maxScrollTop = 내용 extent − 이 높이` 의 기준. 내용 높이를 보고하면
    // 스크롤이 0 이 되고 넘친 내용이 프레임 밖 캔버스로 흘러나온다(도달 수단 없음).
    it("내용이 넘쳐도 페이지 높이", () => {
      const pipe = pipelineBodyLeg(COLUMN_FLEX, [
        { height: "400px" },
        { height: "400px" },
        { height: "400px" },
      ]);
      expect(pipe.body.h).toBeCloseTo(PAGE_H, 1);
      expect(pipe.body.w).toBeCloseTo(PAGE_W, 1);
    });

    it("내용이 짧아도 페이지 높이", () => {
      const pipe = pipelineBodyLeg(COLUMN_FLEX, [{ height: "100px" }]);
      expect(pipe.body.h).toBeCloseTo(PAGE_H, 1);
    });
  });

  describe("대조군 — 세로 flex 가 아닌 body 는 종전 그대로", () => {
    // 주입 축을 넓히면 여기가 깨진다: block/grid 는 확정 높이가 상자 크기로 필요하고,
    // row flex 는 프레임 슬롯의 `height:100%`(`resolvePageSlotStyle`)가 그 확정성에
    // 의존한다 — `min-height` 로 바꾸면 Chrome 도 0 으로 접는다(실측).
    it("block body: 자식은 자연 높이, 상자는 페이지", () => {
      const pipe = pipelineBodyLeg({ overflow: "auto" }, [
        { height: "400px" },
        { height: "400px" },
      ]);
      expect(pipe.children.map((c) => Math.round(c.y))).toEqual([0, 400]);
      expect(pipe.children.map((c) => Math.round(c.h))).toEqual([400, 400]);
      expect(pipe.body.h).toBeCloseTo(PAGE_H, 1);
    });

    it("row flex body: 자식 height:100% 가 페이지 높이로 해소된다", () => {
      const pipe = pipelineBodyLeg({ display: "flex", flexDirection: "row" }, [
        { width: "80px", height: "100%" },
      ]);
      expect(pipe.children[0].h).toBeCloseTo(PAGE_H, 1);
    });
  });
});
