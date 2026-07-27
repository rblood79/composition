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
 * `auto` 트랙은 내용 크기가 **하한**일 뿐이다 — 남는 여유를 나눠 갖는다
 * (CSS-GRID-1 §12.8 "Stretch auto Tracks")
 *
 * 축의 content-distribution 이 `normal`/`stretch` 일 때, 남는 **definite** 여유는 max
 * 트랙 sizing 이 `auto` 인 트랙들에 균등 분배된다. 종전 엔진은 auto 트랙을 자식 intrinsic
 * 으로 측정한 뒤 거기서 멈춰, 컨테이너가 트랙 합보다 커도 트랙이 자라지 않았다.
 *
 * 규칙이 서로 다른 네 갈래로 갈리므로 한 축만 보면 잘못 일반화하기 쉽다:
 *
 * | 조건                                   | 결과                                    |
 * | -------------------------------------- | --------------------------------------- |
 * | distribution = `normal`/`stretch`/미설정 | auto 트랙에 여유 균등 분배              |
 * | `start`/`center`/`end`/`space-*`       | 트랙은 내용 크기 유지, **트랙셋**을 정렬 |
 * | `fr` 트랙 공존                          | fr 이 여유를 먼저 흡수 → auto 는 내용   |
 * | 여유 음수(넘침) / 축이 indefinite       | no-op — 트랙을 줄이지도 않는다          |
 *
 * 참여 자격은 **max 트랙 sizing 이 `auto`** 하나다. `px`/`%`/`minmax(_, px)` 는 제외된다
 * — `auto minmax(50px,80px)` 300 에서 minmax 는 80 에 머물고 auto 가 220 을 가져간다.
 *
 * ## 이 파일이 잠그지 않는 것
 *
 * 컨테이너 축이 definite 인지의 판정 자체는 `gridItemBox.browser.test.ts` 잔존 ② 소관이다
 * (block-level `width:auto` 는 CSS 상 definite 인데 엔진은 미구분 — `1fr` 이 이미 같은
 * 축에서 어긋나 있다). 그래서 여기 케이스는 전부 **명시 크기** 컨테이너다.
 */

const box = (
  label: string,
  style: StyleRecord,
  children?: number[],
): CaseNode => ({ label, style, children }) as CaseNode;

/** 가로축 케이스 — 명시 폭 300, 자식은 40×40 고정. */
function colCase(
  name: string,
  container: StyleRecord,
  kids: StyleRecord[] = [
    { width: "40px", height: "40px" },
    { width: "40px", height: "40px" },
  ],
): ParityCase {
  return {
    name,
    availW: 400,
    availH: 600,
    nodes: [
      ...kids.map((s, i) => box(`c${i}`, s)),
      box(
        "grid",
        { display: "grid", width: "300px", height: "100px", ...container },
        kids.map((_, i) => i),
      ),
      box("root", { display: "block", width: "400px", height: "600px" }, [
        kids.length,
      ]),
    ],
  };
}

/** 세로축 케이스 — 명시 높이 200, 1열, 자식 높이 20/40. */
function rowCase(name: string, container: StyleRecord): ParityCase {
  return colCase(
    name,
    {
      gridTemplateColumns: ["1fr"],
      height: "200px",
      ...container,
    },
    [{ height: "20px" }, { height: "40px" }],
  );
}

const CASES: ParityCase[] = [];

// ── 1. 가로축 × justify-content — 무엇이 stretch 를 켜고 끄는가 ──
for (const jc of [
  "",
  "normal",
  "stretch",
  "start",
  "center",
  "end",
  "space-between",
  "space-around",
  "space-evenly",
]) {
  CASES.push(
    colCase(`cols=auto auto jc="${jc || "미설정"}"`, {
      gridTemplateColumns: ["auto", "auto"],
      ...(jc ? { justifyContent: jc } : {}),
    }),
  );
}

// ── 2. 참여 자격 — max sizing 이 auto 인 트랙만 ──
for (const [tag, cols] of [
  ["auto 100px", ["auto", "100px"]], // auto 가 여유 160 을 독식 → 200
  ["auto 50%", ["auto", "50%"]], // % 는 불참 → auto 150
  ["auto 1fr", ["auto", "1fr"]], // fr 이 먼저 흡수 → auto 는 내용 40
  ["1fr auto", ["1fr", "auto"]],
  ["auto auto auto", ["auto", "auto", "auto"]],
] as Array<[string, string[]]>) {
  CASES.push(
    colCase(
      `cols=${tag}`,
      { gridTemplateColumns: cols },
      cols.map(() => ({ width: "40px", height: "40px" })),
    ),
  );
}

// ── 3. 여유 계산 — gap 은 여유에서 먼저 빠진다 / 넘치면 no-op ──
CASES.push(
  colCase("cols=auto auto + columnGap 20", {
    gridTemplateColumns: ["auto", "auto"],
    columnGap: "20px",
  }),
);
CASES.push(
  colCase(
    "cols=auto auto 넘침(200+200)",
    { gridTemplateColumns: ["auto", "auto"] },
    [
      { width: "200px", height: "40px" },
      { width: "200px", height: "40px" },
    ],
  ),
);
CASES.push(
  colCase(
    "cols=auto auto 비대칭 내용(40/60)",
    { gridTemplateColumns: ["auto", "auto"] },
    [
      { width: "40px", height: "40px" },
      { width: "60px", height: "40px" },
    ],
  ),
);
CASES.push(
  colCase("cols=auto + padding", {
    gridTemplateColumns: ["auto", "auto"],
    paddingLeft: "30px",
    paddingRight: "10px",
  }),
);

// ── 4. 세로축 — 가로와 같은 규칙, 다른 속성(align-content) ──
for (const ac of [
  "",
  "normal",
  "stretch",
  "start",
  "center",
  "end",
  "space-between",
]) {
  CASES.push(
    rowCase(`rows=auto auto ac="${ac || "미설정"}"`, {
      gridTemplateRows: ["auto", "auto"],
      ...(ac ? { alignContent: ac } : {}),
    }),
  );
}
for (const [tag, rows] of [
  ["auto 50px", ["auto", "50px"]],
  ["auto 1fr", ["auto", "1fr"]],
] as Array<[string, string[]]>) {
  CASES.push(rowCase(`rows=${tag}`, { gridTemplateRows: rows }));
}
CASES.push(
  rowCase("rows=auto auto + rowGap 20", {
    gridTemplateRows: ["auto", "auto"],
    rowGap: "20px",
  }),
);

// ── 5. 축이 indefinite 면 no-op — 여유라는 개념 자체가 없다 ──
CASES.push(
  colCase(
    "rows=auto auto height:auto",
    {
      gridTemplateColumns: ["1fr"],
      gridTemplateRows: ["auto", "auto"],
      height: "auto",
    },
    [{ height: "20px" }, { height: "40px" }],
  ),
);

// ── 6. 암묵 트랙 — `grid-auto-rows` 가 크기를 정한다 ──
CASES.push(
  colCase(
    "암묵 행 (gridTemplateRows 미명시) height:200",
    { gridTemplateColumns: ["1fr"], height: "200px" },
    [{ height: "20px" }, { height: "40px" }],
  ),
);

describe("grid auto 트랙 stretch — CSS 대조", () => {
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
   * 트랙이 실제로 자랐는지는 **형제의 좌표**로만 보인다 — 자식 폭은 그대로이므로
   * (§10.1 영역은 containing block 일 뿐) 자식 w 만 보면 stretch 여부를 알 수 없다.
   */
  it("규칙 요약 — 기준값 고정", () => {
    const x1 = (c: ParityCase) => domLeg(c.nodes, c.availW)[1].x;
    const e1 = (c: ParityCase) => engineLeg(c.nodes, c.availW, c.availH)[1].x;

    // 기본: 300 을 두 auto 트랙이 균등 분할 → 두 번째 트랙이 150 에서 시작
    const base = colCase("", { gridTemplateColumns: ["auto", "auto"] });
    expect(x1(base)).toBe(150);
    expect(e1(base)).toBe(150);

    // start: 트랙은 내용 40 유지
    const start = colCase("", {
      gridTemplateColumns: ["auto", "auto"],
      justifyContent: "start",
    });
    expect(x1(start)).toBe(40);
    expect(e1(start)).toBe(40);

    // fr 공존: fr 이 여유를 먼저 가져가 auto 는 내용 40
    const withFr = colCase("", { gridTemplateColumns: ["auto", "1fr"] });
    expect(x1(withFr)).toBe(40);
    expect(e1(withFr)).toBe(40);

    // 혼합 고정: auto 가 여유 160 독식 → 두 번째 트랙 200
    const mixed = colCase("", { gridTemplateColumns: ["auto", "100px"] });
    expect(x1(mixed)).toBe(200);
    expect(e1(mixed)).toBe(200);
  });

  /**
   * 잔존 ① — `minmax(px, px)` 트랙이 growth limit 까지 자라지 않는다 (CSS-GRID-1 §12.6
   * "Maximize Tracks"). 엔진은 base size(=min)에서 멈춘다.
   *
   * §12.8 과 **별개 규칙**이고 순서상 먼저다 — minmax 가 50 에 머무는 바람에 여유가
   * 30 더 잡히고, 그 30 이 auto 트랙으로 흘러간다. 본 변경 전에도 어긋나 있었다
   * (당시 eng=40 — auto 가 아예 안 자람). 고칠 때는 §12.6 을 먼저 넣고 이 스냅샷을
   * 정합 케이스로 올린다.
   */
  it("잔존 ① — minmax(px,px) growth limit 미도달 (실측 스냅샷)", () => {
    const c = colCase("auto minmax(50px,80px)", {
      gridTemplateColumns: ["auto", "minmax(50px,80px)"],
    });
    const dom = domLeg(c.nodes, c.availW);
    const eng = engineLeg(c.nodes, c.availW, c.availH);
    expect(dom[1].x).toBe(220); // minmax 가 80 까지 자라 → auto 220
    expect(eng[1].x).toBe(250); // minmax 50 에 멈춤 → auto 가 30 더 먹음
  });

  /**
   * 잔존 ② — 암묵 트랙의 크기에 `grid-auto-rows` 가 반영되지 않는다.
   *
   * 암묵 행은 자식 intrinsic 으로만 측정된다(`solve_grid` 의 implicit 분기) — 명시한
   * `grid-auto-rows` 는 `grid_layout` 에 넘어가지만 그 행들은 이미 px 로 치환된 뒤라
   * 읽히지 않는다. 이것도 §12.8 이전 문제이며 본 변경 전과 같은 값이다.
   *
   * 다만 **stretch 가드는 여기서 검증된다** — `grid-auto-rows` 가 고정 크기면 auto 가
   * 아니므로 §12.8 대상이 아니고, 엔진도 행을 늘리지 않는다(여유 130 을 나눠 넣었다면
   * `c1.y` 가 85 였을 것이다).
   */
  it("잔존 ② — 암묵 트랙이 grid-auto-rows 를 무시 (실측 스냅샷)", () => {
    const c = colCase(
      "암묵 행 + gridAutoRows:30px",
      {
        gridTemplateColumns: ["1fr"],
        height: "200px",
        gridAutoRows: ["30px"],
      },
      [{ height: "20px" }, { height: "40px" }],
    );
    const dom = domLeg(c.nodes, c.availW);
    const eng = engineLeg(c.nodes, c.availW, c.availH);
    expect(dom[1].y).toBe(30); // 행 = grid-auto-rows 30
    expect(eng[1].y).toBe(20); // 행 = 자식 intrinsic 20 (stretch 는 안 함 — 85 아님)
  });
});
