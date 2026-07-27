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
 * grid item 의 박스 모델 — 그리드 영역 안에서의 크기/margin/정렬
 *
 * 그리드 영역은 자식의 **containing block 일 뿐**이다. 영역 크기가 자식 크기를
 * 강제하지도, 자식의 min/max 를 무효화하지도 않는다 (CSS-GRID §10.1/§10.2 +
 * CSS-ALIGN-3 §4.1/§4.2). 종전 엔진은 네 갈래로 어긋나 있었다:
 *
 * 1. **명시 크기가 무시되고 트랙 폭으로 stretch** — `width:40px` 자식이 150 트랙에서
 *    150. 세로축은 이 규칙("explicit 가 stretch 를 이긴다")을 받았는데 가로축만 못
 *    받은 비대칭이었다. `%`/min-max 도 같이 삼켜졌다.
 * 2. **margin 미소비** — 양축 모두. `marginLeft:20px` 가 x 에 반영 안 됨, stretch 폭도
 *    영역에서 margin 을 빼지 않음.
 * 3. **auto margin 미흡수** (§10.2) — flex §8.1 과 동형인데 grid 에는 없었다.
 * 4. **자식 min/max 미적용 + 넘침을 자름** — block·flex 부모에서는 각 커널이 이미
 *    적용하는데 grid 만 통째로 빠져 있었다 (실측 대조: block·flex 10/10 정합 vs
 *    grid 5/5 발산). 그리고 `.min(cell)` 클램프가 넘치는 아이템을 잘랐다 (CSS 는
 *    넘친다 — 150 트랙 안의 `width:300px` 는 300).
 *
 * 넘칠 때의 위치 정렬(center/end)이 음수 offset 이라는 것도 flex 축과 같은 규칙이다.
 */

const box = (
  label: string,
  style: StyleRecord,
  children?: number[],
): CaseNode => ({ label, style, children }) as CaseNode;

function gridCase(
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
        "grid",
        {
          display: "grid",
          gridTemplateColumns: ["150px", "150px"],
          gridTemplateRows: ["100px"],
          width: "300px",
          height: "100px",
          ...container,
        },
        kids.map((_, i) => i),
      ),
      box("root", { display: "block", width: "400px", height: "600px" }, [
        kids.length,
      ]),
    ],
  };
}

const CASES: ParityCase[] = [];

// ── 1. 명시 크기 × 정렬 — 크기는 유지되고 정렬은 영역 안에서만 ──
for (const size of [
  { tag: "w40 h40", s: { width: "40px", height: "40px" } },
  { tag: "w40 h-auto", s: { width: "40px" } },
] as Array<{ tag: string; s: StyleRecord }>) {
  for (const js of ["", "start", "center", "end", "stretch"]) {
    CASES.push(
      gridCase(`${size.tag} / justify-self:${js || "(기본)"}`, {}, [
        { ...size.s, ...(js ? { justifySelf: js } : {}) },
      ]),
    );
  }
}
for (const as of ["", "start", "center", "end", "stretch"]) {
  CASES.push(
    gridCase(`h40 / align-self:${as || "(기본)"}`, {}, [
      { width: "40px", height: "40px", ...(as ? { alignSelf: as } : {}) },
    ]),
  );
}
// auto width + stretch 계열은 셀을 채운다 (명시 크기가 없으므로 stretch 유효)
CASES.push(
  gridCase("w-auto / justify-self:(기본) → 셀 채움", {}, [{ height: "40px" }]),
  gridCase("w-auto / justify-self:stretch → 셀 채움", {}, [
    { height: "40px", justifySelf: "stretch" },
  ]),
);

// ── 2. 컨테이너 justify-items / align-items ──
for (const ji of ["start", "center", "end", "stretch"]) {
  CASES.push(
    gridCase(`justify-items:${ji} / 명시 width`, { justifyItems: ji }, [
      { width: "40px", height: "40px" },
    ]),
  );
}
for (const ai of ["start", "center", "end", "stretch"]) {
  CASES.push(
    gridCase(`align-items:${ai} / 명시 height`, { alignItems: ai }, [
      { width: "40px", height: "40px" },
    ]),
  );
}

// ── 3. 백분율 — 영역 기준으로 풀린다 ──
CASES.push(
  gridCase("width:50% (트랙 150 의 절반)", {}, [
    { width: "50%", height: "40px" },
  ]),
  gridCase("height:50% (트랙 100 의 절반)", {}, [
    { width: "40px", height: "50%" },
  ]),
);

// ── 4. margin — 양축 소비 + margin box 정렬 ──
CASES.push(
  gridCase("marginLeft 20 + 명시 width", {}, [
    { width: "40px", height: "40px", marginLeft: "20px" },
  ]),
  gridCase("marginLeft 20 + auto width (stretch 가 margin 만큼 축소)", {}, [
    { height: "40px", marginLeft: "20px" },
  ]),
  gridCase("marginTop 20 + 명시 height", {}, [
    { width: "40px", height: "40px", marginTop: "20px" },
  ]),
  gridCase("marginTop 20 + auto height (stretch 축소)", {}, [
    { width: "40px", marginTop: "20px" },
  ]),
  gridCase("4방향 margin + 명시 크기", {}, [
    {
      width: "40px",
      height: "40px",
      marginTop: "10px",
      marginRight: "5px",
      marginBottom: "15px",
      marginLeft: "20px",
    },
  ]),
  gridCase("margin + justify-self:end (margin box 기준 정렬)", {}, [
    { width: "40px", height: "40px", marginRight: "20px", justifySelf: "end" },
  ]),
  gridCase("margin + align-self:center", {}, [
    { width: "40px", height: "40px", marginTop: "20px", alignSelf: "center" },
  ]),
);

// ── 5. auto margin (§10.2 — 정렬보다 먼저) ──
CASES.push(
  gridCase("marginLeft auto", {}, [
    { width: "40px", height: "40px", marginLeft: "auto" },
  ]),
  gridCase("marginRight auto", {}, [
    { width: "40px", height: "40px", marginRight: "auto" },
  ]),
  gridCase("가로 양쪽 auto → 중앙", {}, [
    { width: "40px", height: "40px", marginLeft: "auto", marginRight: "auto" },
  ]),
  gridCase("marginTop auto", {}, [
    { width: "40px", height: "40px", marginTop: "auto" },
  ]),
  gridCase("세로 양쪽 auto → 중앙", {}, [
    { width: "40px", height: "40px", marginTop: "auto", marginBottom: "auto" },
  ]),
  gridCase("auto margin 이 justify-self:start 를 이김", {}, [
    { width: "40px", height: "40px", marginLeft: "auto", justifySelf: "start" },
  ]),
  gridCase("auto margin 이 justify-self:center 를 이김", {}, [
    {
      width: "40px",
      height: "40px",
      marginRight: "auto",
      justifySelf: "center",
    },
  ]),
);

// ── 6. 자식 자신의 min/max — 영역이 무효화하지 않는다 ──
CASES.push(
  gridCase("maxWidth 60 + width auto (stretch 를 clamp)", {}, [
    { maxWidth: "60px", height: "40px" },
  ]),
  gridCase("maxHeight 30 + height auto (stretch 를 clamp)", {}, [
    { width: "40px", maxHeight: "30px" },
  ]),
  gridCase("maxWidth 60 + width 100", {}, [
    { width: "100px", maxWidth: "60px", height: "40px" },
  ]),
  gridCase("minWidth 200 + width 40 (트랙 넘침)", {}, [
    { width: "40px", minWidth: "200px", height: "40px" },
  ]),
  gridCase("minHeight 200 + height 40 (트랙 넘침)", {}, [
    { width: "40px", height: "40px", minHeight: "200px" },
  ]),
);

// ── 7. 넘침 — 자르지 않고, 위치 정렬은 음수 offset ──
CASES.push(
  gridCase("width 300 (트랙 150 초과) — 넘친다", {}, [
    { width: "300px", height: "40px" },
  ]),
  gridCase("height 300 (트랙 100 초과) — 넘친다", {}, [
    { width: "40px", height: "300px" },
  ]),
  gridCase("넘침 + justify-self:center → 음수 offset", {}, [
    { width: "300px", height: "40px", justifySelf: "center" },
  ]),
  gridCase("넘침 + justify-self:end → 음수 offset", {}, [
    { width: "300px", height: "40px", justifySelf: "end" },
  ]),
  gridCase("넘침 + align-self:center → 음수 offset", {}, [
    { width: "40px", height: "300px", alignSelf: "center" },
  ]),
);

// ── 8. 트랙 종류가 달라도 같은 규칙 ──
CASES.push(
  gridCase("fr 트랙 / 명시 width", { gridTemplateColumns: ["1fr", "1fr"] }, [
    { width: "40px", height: "40px" },
    { width: "40px", height: "40px" },
  ]),
  gridCase(
    "gap 있는 fr 트랙 / 명시 width",
    { gridTemplateColumns: ["1fr", "1fr"], columnGap: "20px" },
    [
      { width: "40px", height: "40px" },
      { width: "40px", height: "40px" },
    ],
  ),
);

// ── 9. 중첩 — 명시 크기 grid item 이 그 자신 컨테이너 ──
CASES.push({
  name: "명시 width grid item 이 flex 컨테이너",
  availW: 400,
  availH: 600,
  nodes: [
    box("leaf", { width: "20px", height: "20px" }),
    box(
      "c0",
      {
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        width: "40px",
        height: "40px",
      },
      [0],
    ),
    box(
      "grid",
      {
        display: "grid",
        gridTemplateColumns: ["150px", "150px"],
        gridTemplateRows: ["100px"],
        width: "300px",
        height: "100px",
      },
      [1],
    ),
    box("root", { display: "block", width: "400px", height: "600px" }, [2]),
  ],
});

// ── 10. 실 컴포넌트 구조 (ProgressBar/Meter/Slider 계열) ──
CASES.push({
  name: "ProgressBar 실구조 (1fr auto / auto auto)",
  availW: 320,
  availH: -1,
  nodes: [
    box("label", {
      width: "60px",
      height: "20px",
      gridColumnStart: "1",
      gridColumnEnd: "2",
      gridRowStart: "1",
      gridRowEnd: "2",
    }),
    box("value", {
      width: "30px",
      height: "20px",
      gridColumnStart: "2",
      gridColumnEnd: "3",
      gridRowStart: "1",
      gridRowEnd: "2",
    }),
    box("track", {
      width: "100%",
      height: "8px",
      gridColumnStart: "1",
      gridColumnEnd: "3",
      gridRowStart: "2",
      gridRowEnd: "3",
    }),
    box(
      "grid",
      {
        display: "grid",
        width: "320px",
        gridTemplateColumns: ["1fr", "auto"],
        gridTemplateRows: ["auto", "auto"],
      },
      [0, 1, 2],
    ),
  ],
});

describe("grid item 박스 모델 — CSS 대조", () => {
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

  /**
   * 잔존 ① — auto 크기 자식의 intrinsic 이 0 일 때 셀을 채운다.
   *
   * CSS 는 shrink-to-fit 이라 **내용 없는** 자식이 0 이 되지만, 엔진은 0 붕괴 방지로
   * 셀을 채운다 (ADR-156 §Residual — intrinsic shrink-to-fit 은 JS 측정 협업 영역).
   * 이 폴백을 빼면 빈 컨테이너가 캔버스에서 사라진다. 내용이 있는 자식은 그 폭이
   * `real_size` 로 들어오므로 정상 동작한다.
   */
  it("잔존 ① — 빈 auto-width 자식의 shrink-to-fit (실측 스냅샷)", () => {
    const c = gridCase("empty auto width + justify-self:end", {}, [
      { height: "40px", justifySelf: "end" },
    ]);
    const dom = domLeg(c.nodes, c.availW);
    const eng = engineLeg(c.nodes, c.availW, c.availH);
    expect(dom[0].w).toBe(0); // CSS: 내용 없음 → 0
    expect(dom[0].x).toBe(150); // 0 폭이 트랙 끝에
    expect(eng[0].w).toBe(150); // 엔진: 0 붕괴 방지로 셀 채움
    expect(eng[0].x).toBe(0);
  });

  /**
   * 잔존 ② — `auto` 트랙에 남는 여유의 균등 분배 미구현.
   *
   * `align-content`/`justify-content` 의 기본값 `normal`(= grid 에선 `stretch`)은 auto
   * 트랙을 여유만큼 키운다. 엔진은 auto 트랙을 내용 크기로만 잡는다 — 세로축 잔존과
   * 같은 뿌리이며 `gridAlignContent.browser.test.ts` 가 세로축 스냅샷을 갖고 있다.
   */
  it("잔존 ② — auto 트랙 여유 균등 분배 미구현 (실측 스냅샷)", () => {
    const c = gridCase(
      "auto auto 트랙",
      { gridTemplateColumns: ["auto", "auto"] },
      [
        { width: "40px", height: "40px" },
        { width: "40px", height: "40px" },
      ],
    );
    const dom = domLeg(c.nodes, c.availW);
    const eng = engineLeg(c.nodes, c.availW, c.availH);
    expect(dom[1].x).toBe(150); // CSS: 두 auto 트랙이 300 을 균등 분할
    expect(eng[1].x).toBe(40); // 엔진: 트랙 = 자식 내용 크기(40)
  });

  /**
   * 잔존 ③ — **block-level** 박스의 `justify-self` 미지원.
   *
   * CSS-ALIGN-3 §5.1 은 `justify-self` 를 grid item 뿐 아니라 block-level 박스에도
   * 적용한다. 엔진의 block 경로는 이 속성을 읽지 않는다 — grid/flex 와 다른 별개
   * 코드 경로라 본 fixture 의 수정 범위 밖이다.
   */
  it("잔존 ③ — block-level justify-self 미지원 (실측 스냅샷)", () => {
    const c: ParityCase = {
      name: "block 부모 + justify-self:center",
      availW: 400,
      availH: 600,
      nodes: [
        box("c0", {
          width: "300px",
          height: "40px",
          justifySelf: "center",
        }),
        box("p", { display: "block", width: "150px", height: "100px" }, [0]),
        box("root", { display: "block", width: "400px", height: "600px" }, [1]),
      ],
    };
    const dom = domLeg(c.nodes, c.availW);
    const eng = engineLeg(c.nodes, c.availW, c.availH);
    expect(dom[0].x).toBe(-75); // CSS: 넘치는 박스를 중앙 정렬 (unsafe)
    expect(eng[0].x).toBe(0); // 엔진: justify-self 무시
  });
});
