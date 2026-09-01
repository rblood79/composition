import { describe, expect, it } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import {
  calculateContentWidth,
  resolveTextLeafContent,
  resolveTextLeafWhiteSpace,
  textLeafRendersContent,
} from "../utils";

/**
 * ADR-923 Phase 3 r11h1/r12l3 — 텍스트 leaf 의 내용 추출과 line box 신호.
 * 내용은 React renderable 규칙 (string/number 그대로, 배열은 string/number 만 이어붙임,
 * object/boolean 은 없음) — `String([" ", " "])` 의 쉼표나 "[object Object]" 가 내용으로
 * 잡혀 line box 를 만들면 안 된다. 신호는 white-space 처리 후 남는 내용 (CSS Text 3 §4.1.1).
 */
describe("ADR-923 r12l3 — resolveTextLeafContent", () => {
  it("배열 children 은 string/number 항목만 이어붙인다 (쉼표 없음)", () => {
    expect(resolveTextLeafContent({ children: [" ", " "] })).toBe("  ");
    expect(resolveTextLeafContent({ children: ["a", 1, { x: 1 }, null] })).toBe(
      "a1",
    );
    expect(
      textLeafRendersContent(
        resolveTextLeafContent({ children: [" ", " "] }),
        undefined,
      ),
    ).toBe(false);
  });
  it("object / boolean children 은 내용이 아니다", () => {
    expect(resolveTextLeafContent({ children: { type: "span" } })).toBe("");
    expect(resolveTextLeafContent({ children: true })).toBe("");
    expect(
      textLeafRendersContent(
        resolveTextLeafContent({ children: { type: "span" } }),
        "normal",
      ),
    ).toBe(false);
  });
  it("number 0 은 내용", () => {
    expect(resolveTextLeafContent({ children: 0 })).toBe("0");
    expect(textLeafRendersContent("0", undefined)).toBe(true);
  });
  it("원천은 writer 인벤토리 기준 children → text (첫 비어있지 않은 값); label/title 은 텍스트 leaf 의 writer·Preview 원천이 아니다 (r13m2·r14m2)", () => {
    expect(
      resolveTextLeafContent({ children: "c", label: "l", text: "t" }),
    ).toBe("c");
    // Pencil import writer (`props.text`) — round 13 children-only 가 놓친 원천.
    expect(resolveTextLeafContent({ text: "t", label: "l" })).toBe("t");
    // import 뒤 inspector 편집: children 이 stale text 를 이긴다 (Skia 순서와 동일).
    expect(resolveTextLeafContent({ children: "edited", text: "pencil" })).toBe(
      "edited",
    );
    expect(resolveTextLeafContent({ children: "", text: "t" })).toBe("t");
    expect(resolveTextLeafContent({ children: "", label: "l" })).toBe("");
    expect(resolveTextLeafContent({ title: "T" })).toBe("");
    expect(resolveTextLeafContent(undefined)).toBe("");
  });
});

describe("ADR-923 r13m1·r14m1 — resolveTextLeafWhiteSpace (computed 우선, 정규화)", () => {
  it("computed 가 있으면 computed (inline 을 이미 포함) — trim + 소문자 정규화 (r14m1)", () => {
    expect(
      resolveTextLeafWhiteSpace({ whiteSpace: "pre" }, { whiteSpace: " PRE " }),
    ).toBe("pre");
    expect(
      resolveTextLeafWhiteSpace(
        { whiteSpace: "pre" },
        { whiteSpace: "normal" },
      ),
    ).toBe("normal");
  });
  it("computed 에 키워드 raw 가 남았으면 (resolver 미해석) normal 폴백", () => {
    expect(
      resolveTextLeafWhiteSpace(
        { whiteSpace: " INHERIT " },
        { whiteSpace: " INHERIT " },
      ),
    ).toBe("normal");
  });
  it("inline inherit/unset/initial/revert 는 computed 가 해석한 값", () => {
    for (const kw of ["inherit", "unset", "initial", "revert"]) {
      expect(
        resolveTextLeafWhiteSpace({ whiteSpace: kw }, { whiteSpace: "pre" }),
      ).toBe("pre");
    }
  });
  it("computed 부재 (직접 호출) → inline 구체값; 둘 다 없으면 undefined; computed 없는 키워드는 normal", () => {
    expect(resolveTextLeafWhiteSpace({ whiteSpace: " PRE " }, undefined)).toBe(
      "pre",
    );
    expect(resolveTextLeafWhiteSpace({}, { whiteSpace: "pre-line" })).toBe(
      "pre-line",
    );
    expect(resolveTextLeafWhiteSpace(undefined, undefined)).toBeUndefined();
    expect(
      resolveTextLeafWhiteSpace({ whiteSpace: "inherit" }, undefined),
    ).toBe("normal");
  });
});

describe("ADR-923 r11h1 — textLeafRendersContent (white-space 처리 후 내용)", () => {
  it("normal/nowrap: 공백·탭·개행만이면 line box 없음, nbsp·U+3000 은 내용", () => {
    expect(textLeafRendersContent(" \t\n\r", undefined)).toBe(false);
    expect(textLeafRendersContent("  ", "nowrap")).toBe(false);
    expect(textLeafRendersContent("\u00A0", "normal")).toBe(true);
    expect(textLeafRendersContent("\u3000", "normal")).toBe(true);
  });
  it("pre-line: 공백·탭은 collapsible, segment break 는 보존", () => {
    expect(textLeafRendersContent(" \t ", "pre-line")).toBe(false);
    expect(textLeafRendersContent("\n", "pre-line")).toBe(true);
  });
  it("pre / pre-wrap / break-spaces: 전부 보존 — 대소문자·공백 무관", () => {
    expect(textLeafRendersContent(" ", "pre")).toBe(true);
    expect(textLeafRendersContent(" ", " PRE ")).toBe(true);
    expect(textLeafRendersContent(" ", "pre-wrap")).toBe(true);
    expect(textLeafRendersContent(" ", "break-spaces")).toBe(true);
  });
});

/**
 * ADR-923 r15m1 — 레이아웃의 텍스트 원천은 타입별 계약 (`@composition/specs` `resolveTextSourceText`,
 * Preview · Skia 와 같은 단일 지점). AI `create_element`/`update_element` 의 열린 props 가 만드는
 * 조합에서 텍스트 leaf 가 아닌 기본 군 (Button/Column/TreeItem/Div) 도 `label`/`title` 폭을 싣지
 * 않는다 — round 14 까지 `extractTextContent` 만의 순서 `label → text → children → title …` 이었다.
 */
describe("ADR-923 r15m1 — 기본 군 (비-텍스트 leaf) 의 원천도 타입별 계약", () => {
  const measure = (type: string, props: Record<string, unknown>) =>
    calculateContentWidth({
      id: `w-${type}`,
      type,
      props: { ...props, style: { fontSize: "16px" } },
    } as unknown as CanvasLayoutNode);
  it("Button/Column/TreeItem/Div: AI label·title 장문이 있어도 children 폭", () => {
    const long = "AI wrote a long label into an open props object";
    for (const type of ["Button", "Column", "TreeItem", "Div"]) {
      const base = measure(type, { children: "Y" });
      expect(base).toBeGreaterThan(0);
      expect(measure(type, { children: "Y", label: long })).toBe(base);
      expect(measure(type, { children: "Y", title: long })).toBe(base);
    }
  });
  it("ListBoxItem: label 이 children 을 이긴다 (collection 데이터 SSOT — Preview `label || children`)", () => {
    const labelOnly = measure("ListBoxItem", { label: "Aardvark" });
    expect(labelOnly).toBeGreaterThan(0);
    expect(measure("ListBoxItem", { label: "Aardvark", children: "Y" })).toBe(
      labelOnly,
    );
  });
  it("Text: AI create_element 저장 형태 `{children: 'Text', label: 'AI Label'}` 은 children", () => {
    expect(
      resolveTextLeafContent({ children: "Text", label: "AI Label" }),
    ).toBe("Text");
  });
});

/**
 * ADR-923 r18m1 — 측정의 기본 글자·계약 밖 키 제거. DisclosureHeader 는 `children ?? title ?? "Section"`
 * 으로 헤더가 비었거나 AI 가 `title` 만 쓴 문서에서 "Section" 폭을 쟀고 (Skia·Preview 는 내용 없음),
 * Breadcrumb 은 `children ?? label ?? title` 로 이 측정만의 순서였다 (r15m1 형태).
 */
describe("ADR-923 r18m1 — DisclosureHeader/Breadcrumb 측정도 타입별 계약, 기본 글자 없음", () => {
  const measure = (type: string, props: Record<string, unknown>) =>
    calculateContentWidth({
      id: `w18-${type}`,
      type,
      props: { ...props, style: { fontSize: "16px" } },
    } as unknown as CanvasLayoutNode);
  it("DisclosureHeader: children 만 — 없거나 비었거나 AI title 만이면 0 (종전 'Section' 폭)", () => {
    expect(
      measure("DisclosureHeader", { children: "Section Title" }),
    ).toBeGreaterThan(0);
    expect(measure("DisclosureHeader", {})).toBe(0);
    expect(measure("DisclosureHeader", { children: "" })).toBe(0);
    expect(measure("DisclosureHeader", { title: "AI Title" })).toBe(0);
  });
  it("Breadcrumb: children 만 — AI label/title 은 폭에 실리지 않는다", () => {
    const base = measure("Breadcrumb", { children: "Home" });
    expect(base).toBeGreaterThan(0);
    expect(measure("Breadcrumb", { label: "Home" })).toBe(0);
    expect(
      measure("Breadcrumb", {
        children: "Home",
        title: "AI wrote a long title",
      }),
    ).toBe(base);
  });
});
