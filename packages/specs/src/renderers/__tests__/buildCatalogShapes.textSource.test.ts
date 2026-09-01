import { describe, expect, it } from "vitest";

import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { SizeSpec, TokenRef } from "../../types";
import { buildCatalogShapes } from "./catalogPaintFixture";

/**
 * ADR-923 r14m2 — buildCatalogShapes 의 텍스트 원천 순서 (writer 인벤토리 기준, Preview 와 대칭):
 * `label` (collection item/field — Preview `label || children`) → `children` (binding content —
 * inspector/factory/overlay) → `text` (Pencil import writer) → `placeholder` (value-empty field leaf).
 * children 이 text 보다 앞: import 뒤 inspector 편집이 children 을 쓰면 stale text 가 아니라 children
 * 을 그린다. round 13 의 binding-선언 기반 label/text 차단 (33 primitive) 은 Pencil `text` 와 item
 * `label` 을 지워 철회됐다 — 순서는 이 단일 지점이 정본이다.
 */
function makeVisual(): ComponentVisualRule {
  return {
    fill: { default: { base: "{color.accent}" as TokenRef } },
    text: "{color.on-accent}" as TokenRef,
    textHover: undefined,
    textWeight: undefined,
    fontFamily: undefined,
    border: undefined,
    borderHover: undefined,
    borderStyle: undefined,
    fillBar: undefined,
    outlineText: undefined,
    outlineBorder: undefined,
    subtleText: undefined,
    selectedText: undefined,
    selectedBorder: undefined,
    emphasizedSelectedText: undefined,
    emphasizedSelectedBorder: undefined,
    leadingIcon: undefined,
    trailingIcon: undefined,
    textAlign: undefined,
  };
}

const SIZE = {
  height: 24,
  fontSize: 12,
  borderRadius: 4,
  paddingX: 6,
  paddingY: 2,
} as unknown as SizeSpec;

function textOf(props: Record<string, unknown>): string | undefined {
  const shape = buildCatalogShapes(makeVisual(), props, SIZE, "default").find(
    (s) => s.type === "text",
  );
  return shape ? (shape as { text?: string }).text : undefined;
}

describe("ADR-923 r14m2 — buildCatalogShapes 텍스트 원천 순서", () => {
  it("label → children → text → placeholder", () => {
    expect(textOf({ label: "L", children: "C", text: "T" })).toBe("L");
    expect(textOf({ children: "C", text: "T" })).toBe("C");
    expect(textOf({ text: "T", placeholder: "P" })).toBe("T");
    expect(textOf({ placeholder: "P" })).toBe("P");
  });
  it("Pencil import writer (`text` 만) 은 그려진다 — round 13 차단 철회", () => {
    expect(textOf({ text: "Hello" })).toBe("Hello");
  });
  it("import 뒤 inspector 편집: children 이 stale text 를 이긴다", () => {
    expect(textOf({ children: "edited", text: "pencil" })).toBe("edited");
  });
  it("빈 children 은 text/placeholder 로 떨어진다; 배열/object children 은 텍스트가 아니다", () => {
    expect(textOf({ children: "", text: "T" })).toBe("T");
    expect(textOf({ children: "", placeholder: "P" })).toBe("P");
    expect(textOf({ children: ["a", "b"], text: "T" })).toBe("T");
    expect(textOf({ children: { type: "span" }, placeholder: "P" })).toBe("P");
    expect(textOf({ children: 0 })).toBe("0");
  });
  it("내용이 없으면 text shape 없음", () => {
    expect(textOf({ children: "" })).toBeUndefined();
    expect(textOf({})).toBeUndefined();
  });
});
