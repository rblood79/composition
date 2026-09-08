import { describe, expect, it } from "vitest";

import {
  canNest,
  collectSubtreeNestingViolations,
  findClosestNestableAncestorIndex,
  resolveNestingViolation,
} from "../nestingRules";

describe("nestingRules — 층 1 Pen 구조", () => {
  it("Text · Icon 은 자식을 가질 수 없다 (toPencilType 이 text/icon_font 로 낸다)", () => {
    expect(
      resolveNestingViolation({ parentType: "Text", childType: "Button" }),
    ).toMatchObject({ layer: "pen-structure", parentType: "Text" });
    expect(
      resolveNestingViolation({ parentType: "Icon", childType: "Text" }),
    ).toMatchObject({ layer: "pen-structure", parentType: "Icon" });
  });

  it("frame · group · body 는 무엇이든 담는다 (Pen frame 으로 export)", () => {
    expect(canNest("frame", "Button")).toBe(true);
    expect(canNest("group", "Text")).toBe(true);
    expect(canNest("body", "Card")).toBe(true);
    expect(canNest("Body", "Form")).toBe(true);
  });
});

describe("nestingRules — 층 2 RAC 합성", () => {
  it("컬렉션 컨테이너는 자기 item 만 읽는다", () => {
    expect(
      resolveNestingViolation({ parentType: "ListBox", childType: "Button" }),
    ).toMatchObject({ layer: "rac-composition", parentType: "ListBox" });
    expect(canNest("ListBox", "ListBoxItem")).toBe(true);
    expect(canNest("TabList", "Tab", ["TabList", "Tabs"])).toBe(true);
    expect(
      resolveNestingViolation({
        parentType: "TabList",
        childType: "TabPanel",
        ancestorTypes: ["TabList", "Tabs"],
      }),
    ).toMatchObject({ layer: "rac-composition" });
  });

  it("합성 부품은 소유자 조상이 있어야 한다 — 직계가 아니어도 된다", () => {
    expect(
      resolveNestingViolation({
        parentType: "frame",
        childType: "TabPanel",
        ancestorTypes: ["frame", "body"],
      }),
    ).toMatchObject({ layer: "rac-composition", childType: "TabPanel" });
    expect(
      canNest("TabPanels", "TabPanel", ["TabPanels", "Tabs", "body"]),
    ).toBe(true);
    expect(canNest("frame", "FieldError", ["frame", "TextField"])).toBe(true);
    expect(canNest("frame", "FieldError", ["frame", "body"])).toBe(false);
  });

  it("context 기반 합성 컨테이너는 레이아웃 래퍼를 사이에 둘 수 있다 — strict 컬렉션은 불가", () => {
    expect(canNest("RadioGroup", "frame")).toBe(true);
    expect(canNest("Tabs", "frame")).toBe(true);
    expect(canNest("ListBox", "frame")).toBe(false);
    expect(canNest("TabList", "frame")).toBe(false);
    // 래퍼 안의 부품도 소유자 조상 규칙은 그대로 본다
    expect(canNest("frame", "Radio", ["frame", "RadioGroup"])).toBe(true);
    expect(canNest("frame", "Radio", ["frame", "body"])).toBe(false);
  });

  it("위반 결과는 문구용 구조 필드를 싣는다", () => {
    expect(
      resolveNestingViolation({ parentType: "ListBox", childType: "Button" })
        ?.allowedChildren,
    ).toContain("ListBoxItem");
    expect(
      resolveNestingViolation({ parentType: "frame", childType: "TabPanel" })
        ?.owners,
    ).toEqual(["Tabs"]);
  });

  it("ref 조상이 있으면 원본을 모르므로 통과시킨다 (Phase 1 한계)", () => {
    expect(canNest("frame", "TabPanel", ["frame", "ref"])).toBe(true);
    expect(canNest("ref", "Button")).toBe(true);
    expect(canNest("Text", "ref")).toBe(true);
  });
});

describe("nestingRules — 층 3 HTML 의미", () => {
  it("interactive 는 button/a 의 자손이 될 수 없다 — 조상 전체", () => {
    expect(
      resolveNestingViolation({ parentType: "Button", childType: "Button" }),
    ).toMatchObject({ layer: "html-content", parentType: "Button" });
    expect(
      resolveNestingViolation({
        parentType: "frame",
        childType: "Checkbox",
        ancestorTypes: ["frame", "Link", "body"],
      }),
    ).toMatchObject({ layer: "html-content", parentType: "Link" });
    expect(canNest("Button", "Text")).toBe(true);
    expect(canNest("Button", "Icon")).toBe(true);
  });

  it("form 은 form 의 자손이 될 수 없다", () => {
    expect(
      resolveNestingViolation({
        parentType: "frame",
        childType: "Form",
        ancestorTypes: ["frame", "Form"],
      }),
    ).toMatchObject({ layer: "html-content", parentType: "Form" });
    expect(canNest("Form", "TextField")).toBe(true);
  });

  it("phrasing 컨테이너 (p · h · label) 에는 블록을 넣을 수 없다", () => {
    expect(
      resolveNestingViolation({ parentType: "Paragraph", childType: "frame" }),
    ).toMatchObject({ layer: "html-content", parentType: "Paragraph" });
    expect(
      resolveNestingViolation({ parentType: "Heading", childType: "Card" }),
    ).toMatchObject({ layer: "html-content" });
    expect(canNest("Paragraph", "Link")).toBe(true);
    expect(canNest("Label", "Text")).toBe(true);
  });
});

describe("nestingRules — 소비처 헬퍼", () => {
  it("findClosestNestableAncestorIndex 는 가장 가까운 유효 조상을 돌려준다", () => {
    // 사슬 body > frame > Button 의 Button 위에 Button 을 떨어뜨림 → Button 자손 금지 →
    // 한 단계 위 frame (index 1) 은 body 아래라 유효
    expect(
      findClosestNestableAncestorIndex("Button", ["Button", "frame", "body"]),
    ).toBe(1);
    // 사슬 body > Link > frame > Button: frame 도 Link 자손이라 막힘 → body (index 3)
    expect(
      findClosestNestableAncestorIndex("Button", [
        "Button",
        "frame",
        "Link",
        "body",
      ]),
    ).toBe(3);
    // 직계가 유효하면 0
    expect(findClosestNestableAncestorIndex("Button", ["frame", "body"])).toBe(
      0,
    );
    // 어디에도 못 두면 -1
    expect(
      findClosestNestableAncestorIndex("TabPanel", ["frame", "body"]),
    ).toBe(-1);
  });

  it("collectSubtreeNestingViolations 는 트리 안 모든 쌍과 부착점을 같이 본다", () => {
    const tree = {
      type: "Button",
      children: [
        { type: "Text" },
        { type: "Button", children: [{ type: "Text" }] },
      ],
    };
    const violations = collectSubtreeNestingViolations(tree, ["frame", "body"]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      layer: "html-content",
      childType: "Button",
      parentType: "Button",
    });

    // 부착점 자체가 위반이면 루트도 잡힌다
    const attached = collectSubtreeNestingViolations({ type: "Button" }, [
      "Link",
      "body",
    ]);
    expect(attached).toHaveLength(1);
    expect(attached[0]).toMatchObject({ parentType: "Link" });
  });
});
