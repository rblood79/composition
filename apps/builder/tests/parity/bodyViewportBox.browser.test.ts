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
 * - **파이프라인**: `calculateFullTreeLayout` 을 root `type:"body"` 로 호출(= 주입 실행).
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
    // 엔진 track 배열(["60px","1fr"]) → CSS 문자열. `String(v)` 는 콤마로 이어 붙여
    // 선언 전체가 무효가 된다 (harness.domLeg 와 같은 계약).
    (body.style as unknown as Record<string, string>)[k] = Array.isArray(v)
      ? v.join(" ")
      : String(v);
  }
  // 빌더 주입 대응 — 폭은 확정, 블록 축은 하한만 (Chrome body 의 `min-height:100vh`).
  body.style.width = `${PAGE_W}px`;
  body.style.minHeight = "100%";

  const children = childStyles.map((style) => {
    const el = document.createElement("div");
    el.style.cssText = "margin:0;padding:0;border:0;box-sizing:border-box;";
    for (const [k, v] of Object.entries(style)) {
      (el.style as unknown as Record<string, string>)[k] = Array.isArray(v)
        ? v.join(" ")
        : String(v);
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

/** 파이프라인 leg — root `type:"body"` 로 Step 1.5 주입을 실행시킨다. */
function pipelineBodyLeg(
  bodyStyle: StyleRecord,
  childStyles: StyleRecord[],
  pageH: number = PAGE_H,
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
  const res = pipelineLeg(nodes, PAGE_W, pageH);
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

  describe("breakpoint height 가 아직 정하는 것 / 더는 정하지 않는 것", () => {
    // 수정 후 pageH 의 역할은 셋이다: ① 뷰포트 상자(위 describe) ② 내용이 짧을 때의
    // **하한** ③ 아트보드 사각형(`buildSceneSnapshot`). 잃은 것은 하나 — **내용이 넘칠 때
    // 자식 크기를 정하는 힘**. 그게 이번 수정의 목적이고 Chrome 의 역할 분담이다.
    const TALL = [
      { height: "400px" },
      { height: "400px" },
      { height: "400px" },
    ];

    it("넘칠 때: pageH 를 바꿔도 자식 배치가 그대로", () => {
      const a = pipelineBodyLeg(COLUMN_FLEX, TALL, 400);
      const b = pipelineBodyLeg(COLUMN_FLEX, TALL, 900);
      expect(b.children.map((c) => Math.round(c.y))).toEqual(
        a.children.map((c) => Math.round(c.y)),
      );
      expect(b.children.map((c) => Math.round(c.h))).toEqual(
        a.children.map((c) => Math.round(c.h)),
      );
      // 상자만 따라 움직인다.
      expect(Math.round(a.body.h)).toBe(400);
      expect(Math.round(b.body.h)).toBe(900);
    });

    it("짧을 때: pageH 가 여유를 정한다 (justify-content / flex-grow)", () => {
      // DOM 실측 — H400 자식 y=150 / H900 y=400, grow 자식 400 / 900.
      const c400 = pipelineBodyLeg(
        { ...COLUMN_FLEX, justifyContent: "center" },
        [{ height: "100px" }],
        400,
      );
      const c900 = pipelineBodyLeg(
        { ...COLUMN_FLEX, justifyContent: "center" },
        [{ height: "100px" }],
        900,
      );
      expect(Math.round(c400.children[0].y)).toBe(150);
      expect(Math.round(c900.children[0].y)).toBe(400);

      const g400 = pipelineBodyLeg(
        COLUMN_FLEX,
        [{ flexGrow: 1, minHeight: "0px" }],
        400,
      );
      const g900 = pipelineBodyLeg(
        COLUMN_FLEX,
        [{ flexGrow: 1, minHeight: "0px" }],
        900,
      );
      expect(Math.round(g400.children[0].h)).toBe(400);
      expect(Math.round(g900.children[0].h)).toBe(900);
    });

    it("`height:%` 자식은 어느 배치 문법에서도 해소되지 않는다 (Chrome 동형)", () => {
      // `min-height` 는 블록 축을 definite 로 만들지 않는다 — Chrome 도 0 (실측).
      // Step 1.5 주석이 들던 근거("자식의 height:100% 가 페이지 크기 기준")는 **Chrome 에
      // 없는 의미**였다. catalog 의 `height:"100%"` 2건은 ProgressBar/Meter `.fill` 이고
      // 부모가 확정 높이 트랙이라 무관하다.
      for (const body of [COLUMN_FLEX, { overflow: "auto" }] as StyleRecord[]) {
        for (const pct of ["50%", "100%"]) {
          const dom = domViewportBodyLeg(body, [{ height: pct }]);
          const pipe = pipelineBodyLeg(body, [{ height: pct }]);
          expect(Math.round(dom.children[0].h)).toBe(0);
          expect(diffChildren("", dom.children, pipe.children)).toEqual([]);
        }
      }
    });
  });

  describe("다른 배치 문법의 body 도 같은 규칙 (주입은 축을 가리지 않는다)", () => {
    // 주입을 세로 flex 로 좁히면 나머지 축이 각자 Chrome 과 어긋난 채 남는다 —
    // block/row flex 는 `height:%` 자식이 페이지 기준으로 해소되고(Chrome 0),
    // 프레임 슬롯 정책도 축마다 갈린다. 대신 엔진이 clamp 뒤 값으로 재분배해야 한다.
    it("block body: 자식은 자연 높이, 상자는 페이지", () => {
      const body: StyleRecord = { overflow: "auto" };
      const kids: StyleRecord[] = [{ height: "400px" }, { height: "400px" }];
      const dom = domViewportBodyLeg(body, kids);
      const pipe = pipelineBodyLeg(body, kids);
      expect(diffChildren("", dom.children, pipe.children)).toEqual([]);
      expect(pipe.body.h).toBeCloseTo(PAGE_H, 1);
    });

    it("row flex body: 크기 미지정 슬롯이 stretch 로 페이지를 채운다", () => {
      // 프레임 row 페이지 형태. `resolvePageSlotStyle` 이 블록 축에 `height:100%` 를
      // 주입하지 않게 된 근거 — 주입하면 "크기를 명시" 한 것이라 stretch 가 꺼지고,
      // 그 백분율은 해소되지 않아 0 이 된다(Chrome 동일).
      const body: StyleRecord = { display: "flex", flexDirection: "row" };
      const kids: StyleRecord[] = [{ width: "80px" }, { flexGrow: 1 }];
      const dom = domViewportBodyLeg(body, kids);
      const pipe = pipelineBodyLeg(body, kids);
      expect(Math.round(dom.children[0].h)).toBe(PAGE_H);
      expect(diffChildren("", dom.children, pipe.children)).toEqual([]);
    });

    it("grid body: `1fr` 행이 페이지 여유를 먹는다", () => {
      // `min-height` 로 확정된 블록 축이라 `solve_grid` 재진입이 없으면 60/60 이 된다.
      const body: StyleRecord = {
        display: "grid",
        gridTemplateRows: ["60px", "1fr"],
      };
      const kids: StyleRecord[] = [{}, {}];
      const dom = domViewportBodyLeg(body, kids);
      const pipe = pipelineBodyLeg(body, kids);
      expect(dom.children.map((c) => Math.round(c.h))).toEqual([60, 340]);
      expect(pipe.children.map((c) => Math.round(c.h))).toEqual([60, 340]);
    });

    it("grid body: 넘치는 행은 넘친다", () => {
      const body: StyleRecord = {
        display: "grid",
        gridTemplateRows: ["60px", "1fr"],
      };
      const kids: StyleRecord[] = [{}, { height: "600px" }];
      const dom = domViewportBodyLeg(body, kids);
      const pipe = pipelineBodyLeg(body, kids);
      expect(dom.children.map((c) => Math.round(c.h))).toEqual([60, 600]);
      expect(pipe.children.map((c) => Math.round(c.h))).toEqual([60, 600]);
      expect(pipe.body.h).toBeCloseTo(PAGE_H, 1);
    });
  });
});
