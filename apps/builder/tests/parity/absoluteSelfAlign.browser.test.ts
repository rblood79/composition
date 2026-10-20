import { beforeAll, describe, expect, it } from "vitest";

import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";

import { diff, type Node } from "./treeOracle";

/**
 * ADR-275 Phase 1 (G1) — an absolute box with both insets and a non-stretch `justify-self` /
 * `align-self` takes its fit-content size and is aligned inside the inset-modified containing block
 * (css-position-3 §4.3 · css-align-3). `unsafe center` stays centered when the box overflows; a
 * safe (or unprefixed) alignment shifts the box back into the containing block. Also: intrinsic
 * keyword sizes are not stretched (F10 · F14) and both-auto margins with negative free space follow
 * CSS per axis (F13). Oracle = the same tree in Chrome.
 */
const cb = (
  children: Node[],
  { w = 400, h = 300, display = "block" } = {},
): Node => ({
  label: "cb",
  css: `position:relative;display:${display};width:${w}px;height:${h}px;`,
  style: {
    display,
    position: "relative",
    width: `${w}px`,
    height: `${h}px`,
  },
  children,
});

type Box = {
  /** CSS lengths for left · right · top · bottom. */
  insets: [string, string, string, string];
  align?: string;
  size?: [string, string];
  extraCss?: string;
  extraStyle?: Record<string, unknown>;
  children?: Node[];
  text?: string;
};

const abs = ({
  insets: [l, r, t, b],
  align,
  size,
  extraCss = "",
  extraStyle = {},
  children,
  text,
}: Box): Node => ({
  label: "abs",
  css:
    `position:absolute;left:${l};right:${r};top:${t};bottom:${b};` +
    (align ? `justify-self:${align};align-self:${align};` : "") +
    (size ? `width:${size[0]};height:${size[1]};` : "") +
    extraCss,
  style: {
    display: "block",
    position: "absolute",
    insetLeft: l,
    insetRight: r,
    insetTop: t,
    insetBottom: b,
    ...(align ? { justifySelf: align, alignSelf: align } : {}),
    ...(size ? { width: size[0], height: size[1] } : {}),
    ...extraStyle,
  },
  ...(children ? { children } : {}),
  ...(text ? { text } : {}),
});

const content = (w: number, h: number): Node => ({
  label: "content",
  css: `width:${w}px;height:${h}px;`,
  style: { display: "block", width: `${w}px`, height: `${h}px` },
});

const zero: Box["insets"] = ["0px", "0px", "0px", "0px"];

describe("ADR-275 absolute 자기 정렬 — Chrome oracle", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });

  it.each(["block", "flex", "grid"])(
    "%s 부모 · Fixed 100×50 · unsafe center",
    (display) => {
      const root = cb(
        [
          abs({
            insets: zero,
            align: "unsafe center",
            size: ["100px", "50px"],
          }),
        ],
        { display },
      );
      expect(diff(root, ["abs"])).toEqual([]);
    },
  );

  it("오프셋 +20 / −20 (left 20 · right −20 · top −20 · bottom 20)", () => {
    const root = cb([
      abs({
        insets: ["20px", "-20px", "-20px", "20px"],
        align: "unsafe center",
        size: ["100px", "50px"],
      }),
    ]);
    expect(diff(root, ["abs"])).toEqual([]);
  });

  it("오프셋 10% (left 10% · right −10%)", () => {
    const root = cb([
      abs({
        insets: ["10%", "-10%", "10%", "-10%"],
        align: "unsafe center",
        size: ["100px", "50px"],
      }),
    ]);
    expect(diff(root, ["abs"])).toEqual([]);
  });

  it("Hug (내용 60×20) — 늘이지 않고 가운데", () => {
    const root = cb([
      abs({
        insets: zero,
        align: "unsafe center",
        children: [content(60, 20)],
      }),
    ]);
    expect(diff(root, ["abs", "content"])).toEqual([]);
  });

  it("Hug + 자식 padding 12 · border 2 — border-box 88 × 48 (리뷰 r1 H2)", () => {
    const root = cb([
      abs({
        insets: zero,
        align: "unsafe center",
        extraCss: "padding:12px;border:2px solid red;",
        extraStyle: {
          paddingTop: "12px",
          paddingRight: "12px",
          paddingBottom: "12px",
          paddingLeft: "12px",
          borderTop: "2px",
          borderRight: "2px",
          borderBottom: "2px",
          borderLeft: "2px",
        },
        children: [content(60, 20)],
      }),
    ]);
    expect(diff(root, ["abs", "content"])).toEqual([]);
  });

  it("Hug 글자 leaf — 내용 폭으로 가운데", () => {
    const root = cb([
      abs({ insets: zero, align: "unsafe center", text: "Hello world" }),
    ]);
    expect(diff(root, ["abs"])).toEqual([]);
  });

  it("넘침 Fixed 200×200 in 100×100 — 넘쳐도 가운데 (사용자 결정 4)", () => {
    const root = cb(
      [abs({ insets: zero, align: "unsafe center", size: ["200px", "200px"] })],
      { w: 100, h: 100 },
    );
    expect(diff(root, ["abs"])).toEqual([]);
  });

  it("넘침 Hug (내용 200×150) in 100×100", () => {
    const root = cb(
      [
        abs({
          insets: zero,
          align: "unsafe center",
          children: [content(200, 150)],
        }),
      ],
      { w: 100, h: 100 },
    );
    expect(diff(root, ["abs", "content"])).toEqual([]);
  });

  it("넘침 + 오프셋 10", () => {
    const root = cb(
      [
        abs({
          insets: ["10px", "-10px", "10px", "-10px"],
          align: "unsafe center",
          size: ["200px", "200px"],
        }),
      ],
      { w: 100, h: 100 },
    );
    expect(diff(root, ["abs"])).toEqual([]);
  });

  it("safe (접두 없음) center 넘침 — containing block 안으로 당긴다", () => {
    const root = cb(
      [
        abs({
          insets: ["10px", "-10px", "10px", "-10px"],
          align: "center",
          size: ["200px", "200px"],
        }),
      ],
      { w: 100, h: 100 },
    );
    expect(diff(root, ["abs"])).toEqual([]);
  });

  it("safe center — inset 영역보다 크고 containing block 보다 작음", () => {
    const root = cb(
      [
        abs({
          insets: ["0px", "200px", "0px", "200px"],
          align: "center",
          size: ["150px", "50px"],
        }),
      ],
      { w: 300, h: 300 },
    );
    expect(diff(root, ["abs"])).toEqual([]);
  });

  it("end 정렬 Fixed", () => {
    const root = cb([
      abs({
        insets: ["10px", "30px", "10px", "30px"],
        align: "end",
        size: ["100px", "50px"],
      }),
    ]);
    expect(diff(root, ["abs"])).toEqual([]);
  });

  it("F10 · F14 — width fit-content + margin auto + padding · border 는 가운데", () => {
    const root = cb([
      abs({
        insets: zero,
        size: ["fit-content", "fit-content"],
        extraCss: "margin:auto;padding:12px;border:2px solid red;",
        extraStyle: {
          marginTop: "auto",
          marginRight: "auto",
          marginBottom: "auto",
          marginLeft: "auto",
          paddingTop: "12px",
          paddingRight: "12px",
          paddingBottom: "12px",
          paddingLeft: "12px",
          borderTop: "2px",
          borderRight: "2px",
          borderBottom: "2px",
          borderLeft: "2px",
        },
        children: [content(60, 20)],
      }),
    ]);
    expect(diff(root, ["abs", "content"])).toEqual([]);
  });

  it("F10 — width max-content + 양쪽 inset (margin 0) 은 늘이지 않는다", () => {
    const root = cb([
      abs({
        insets: ["10px", "10px", "10px", "10px"],
        size: ["max-content", "max-content"],
        children: [content(60, 20)],
      }),
    ]);
    expect(diff(root, ["abs", "content"])).toEqual([]);
  });

  it("F13 — margin auto · 음수 여유 (Fixed 200 in 100)", () => {
    const root = cb(
      [
        abs({
          insets: zero,
          size: ["200px", "200px"],
          extraCss: "margin:auto;",
          extraStyle: {
            marginTop: "auto",
            marginRight: "auto",
            marginBottom: "auto",
            marginLeft: "auto",
          },
        }),
      ],
      { w: 100, h: 100 },
    );
    expect(diff(root, ["abs"])).toEqual([]);
  });

  // ADR-275 Phase 2 실측 — 폭 auto block 부모 (block 흐름이 폭을 채운다) · flex 부모가 높이를
  // 늘인 부모: in-flow 자식이 없어도 absolute 자식의 containing block 은 used 크기다.
  it.each([
    ["Right · Bottom", { insetRight: "30px", insetBottom: "10px" }, ""],
    [
      "Center",
      {
        insetLeft: "0px",
        insetRight: "0px",
        insetTop: "0px",
        insetBottom: "0px",
        justifySelf: "unsafe center",
        alignSelf: "unsafe center",
      },
      "justify-self:unsafe center;align-self:unsafe center;",
    ],
  ])("폭 auto block 부모 · flex 가 늘인 부모 — %s", (_, insets, alignCss) => {
    const child: Node = {
      label: "abs",
      css:
        "position:absolute;width:60px;height:20px;" +
        Object.entries(insets)
          .filter(([key]) => key.startsWith("inset"))
          .map(([key, value]) => `${key.slice(5).toLowerCase()}:${value};`)
          .join("") +
        alignCss,
      style: {
        display: "block",
        position: "absolute",
        width: "60px",
        height: "20px",
        ...insets,
      },
    };
    const autoBlock: Node = {
      label: "mid",
      css: "position:relative;height:100px;",
      style: { display: "block", position: "relative", height: "100px" },
      children: [child],
    };
    expect(diff(cb([autoBlock], { w: 400, h: 300 }), ["mid", "abs"])).toEqual([]);
    const stretched: Node = {
      label: "mid",
      css: "position:relative;width:200px;",
      style: { display: "block", position: "relative", width: "200px" },
      children: [{ ...child }],
    };
    expect(
      diff(cb([stretched], { w: 400, h: 300, display: "flex" }), ["mid", "abs"]),
    ).toEqual([]);
  });

  it("회귀 — 정렬 없는 auto 크기는 늘인다", () => {
    const root = cb([
      abs({
        insets: ["10px", "20px", "30px", "40px"],
        children: [content(60, 20)],
      }),
    ]);
    expect(diff(root, ["abs", "content"])).toEqual([]);
  });

  it("회귀 — stretch 정렬은 늘인다", () => {
    const root = cb([
      abs({
        insets: ["10px", "20px", "30px", "40px"],
        align: "stretch",
        children: [content(60, 20)],
      }),
    ]);
    expect(diff(root, ["abs", "content"])).toEqual([]);
  });
});
