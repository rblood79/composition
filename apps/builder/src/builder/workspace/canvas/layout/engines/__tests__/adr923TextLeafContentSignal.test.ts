import { describe, expect, it } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import {
  calculateContentHeight,
  calculateContentWidth,
  resolveTagWrapLayout,
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
    // r19m1: 빈 라벨도 non-last separator 폭은 남는다 (DOM ::after · Skia) — "" crumb 와 같아야 한다.
    expect(measure("Breadcrumb", { label: "Home" })).toBe(
      measure("Breadcrumb", { children: "" }),
    );
    expect(measure("Breadcrumb", { label: "Home" })).toBeLessThan(base);
    expect(
      measure("Breadcrumb", {
        children: "Home",
        title: "AI wrote a long title",
      }),
    ).toBe(base);
  });
});

/**
 * ADR-923 r19m1 — 집계·간접 분기의 기본 글자. Breadcrumbs 컨테이너 측정은 직접 자식만 봐서 items
 * projection 문서 (자식 = Rows 그룹) 에서 crumb 0 → 항상 "Home"/"Products"/"Detail" 폭을 주입했고
 * (DOM/Skia 는 그 글자를 만들지 않는다), 빈 라벨 crumb 은 non-last separator 폭 (DOM `::after` ·
 * Skia breadcrumb_crumb) 을 잃었다. TagList 는 `label || \`Tag N\`` 로 이 측정만의 기본 글자였다
 * (DOM/Skia 는 toItemProjectionRow 로 itemKey 를 그린다). IllustratedMessage 는 "" 줄을 접지 않았다.
 */
describe("ADR-923 r19m1 — Breadcrumbs 집계 · TagList 라벨 정규화 · IllustratedMessage '' 줄", () => {
  const crumb = (id: string, children: string, isLast: boolean) =>
    ({
      id,
      type: "Breadcrumb",
      props: {
        children,
        _isLast: isLast,
        _separator: "›",
        size: "M",
        style: { width: "fit-content" },
      },
    }) as unknown as CanvasLayoutNode;
  const measureBreadcrumbs = (
    crumbs: CanvasLayoutNode[],
    parentProps: Record<string, unknown> = { size: "M" },
  ) => {
    const rows = {
      id: "bc-rows",
      type: "Rows",
      props: { style: { display: "flex", flexDirection: "row" } },
    } as unknown as CanvasLayoutNode;
    const byId = new Map<string, CanvasLayoutNode[]>([[rows.id, crumbs]]);
    return calculateContentWidth(
      {
        id: "bc",
        type: "Breadcrumbs",
        props: parentProps,
      } as unknown as CanvasLayoutNode,
      [rows],
      (id) => byId.get(id) ?? [],
    );
  };

  it("Breadcrumbs: projection crumb (Rows 아래) 의 실제 라벨 합 — 종전 기본 3 crumb 폭", () => {
    const crumbs = [
      crumb("c1", "A", false),
      crumb("c2", "B", false),
      crumb("c3", "C", true),
    ];
    const w = measureBreadcrumbs(crumbs);
    const sum = crumbs.reduce((acc, c) => acc + calculateContentWidth(c), 0);
    expect(w).toBeGreaterThan(0);
    expect(Math.abs(w - sum)).toBeLessThanOrEqual(crumbs.length); // crumb 별 ceil 오차
    expect(w).toBeLessThan(120); // "Home › Products › Detail" (≈200) 이 아니다
  });

  it("Breadcrumbs: crumb 0 → 0 (기본 crumb 없음)", () => {
    expect(
      calculateContentWidth(
        {
          id: "bc0",
          type: "Breadcrumbs",
          props: { size: "M" },
        } as unknown as CanvasLayoutNode,
        [],
      ),
    ).toBe(0);
    expect(measureBreadcrumbs([])).toBe(0);
  });

  it("Breadcrumbs: 라벨 전부 '' → non-last separator 폭만", () => {
    const sepOnly = calculateContentWidth(crumb("s", "", false));
    expect(sepOnly).toBeGreaterThan(0);
    expect(calculateContentWidth(crumb("l", "", true))).toBe(0);
    const w = measureBreadcrumbs([
      crumb("c1", "", false),
      crumb("c2", "", false),
      crumb("c3", "", true),
    ]);
    expect(Math.abs(w - sepOnly * 2)).toBeLessThanOrEqual(1);
  });

  it("Breadcrumbs: pre-migration 자식 Breadcrumb element 도 같은 계약 (children 만, 마지막은 index)", () => {
    const legacy = [
      { id: "l1", type: "Breadcrumb", props: { children: "Home" } },
      { id: "l2", type: "Breadcrumb", props: { label: "AI only" } },
    ] as unknown as CanvasLayoutNode[];
    const w = calculateContentWidth(
      {
        id: "bcl",
        type: "Breadcrumbs",
        props: { size: "M" },
      } as unknown as CanvasLayoutNode,
      legacy,
    );
    const expected = calculateContentWidth(crumb("x", "Home", false)); // 두 번째는 last + "" → 0
    expect(Math.abs(w - expected)).toBeLessThanOrEqual(1);
  });

  it("TagList: 빈 label 은 DOM/Skia 처럼 itemKey 를 그린다 — 측정도 같은 정규화 (종전 'Tag N')", () => {
    const items = [
      { id: "an-identifier-long-enough-to-wrap-the-row", label: "" },
      { id: "another-identifier-long-enough-to-wrap-row", label: "" },
    ];
    const base = {
      containerWidth: 160,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 0,
    };
    const r = resolveTagWrapLayout({ items, ...base });
    const named = resolveTagWrapLayout({
      items: items.map((it) => ({ ...it, label: it.id })),
      ...base,
    });
    expect(named.rowCount).toBe(2);
    expect(r.rowCount).toBe(2); // "Tag 1"/"Tag 2" 면 한 줄
    expect(r.contentHeight).toBe(named.contentHeight);
  });

  it("IllustratedMessage: heading/description '' → 그 줄과 gap 이 빠진다, 부재는 기본 글자 줄 유지", () => {
    const h = (props: Record<string, unknown>) =>
      calculateContentHeight({
        id: "im",
        type: "IllustratedMessage",
        props: { size: "md", ...props },
      } as unknown as CanvasLayoutNode);
    const full = h({});
    expect(full).toBe(240); // 24 + 120 + 12 + 27 + 12 + 21 + 24
    expect(h({ heading: "No content" })).toBe(full);
    expect(h({ heading: "" })).toBe(full - 12 - 27);
    expect(h({ heading: "", description: "" })).toBe(full - 12 - 27 - 12 - 21);
  });
});
