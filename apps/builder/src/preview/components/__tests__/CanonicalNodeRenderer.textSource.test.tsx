import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedNode } from "@composition/shared";
import { resolveTextSourceText } from "@composition/specs";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

// generic leaf / cutover Button 경로는 renderContext 를 쓰지 않는다 (자식 재귀 없음).
const ctx = {} as unknown as RenderContext;

function domText(node: ResolvedNode, cutover: string[] = []): string {
  const { container } = render(
    <CanonicalNodeRenderer
      node={node}
      renderContext={ctx}
      cutoverPrimitives={new Set(cutover)}
    />,
  );
  return container.textContent ?? "";
}

/**
 * ADR-923 r15m1 — Preview 의 텍스트가 타입별 텍스트 원천 계약 (`resolveTextSourceText`, Skia ·
 * 레이아웃과 같은 단일 지점) 과 같은지 — AI `create_element`/`update_element` 가 열린 props 를 그대로
 * 저장하는 조합으로 고정한다. round 14 까지 Text `{children: "Text", label: "AI Label"}` 은 Preview
 * "Text" / Skia "AI Label" 이었다.
 */
describe("ADR-923 r15m1 — Preview generic/cutover 텍스트 = 텍스트 원천 계약", () => {
  it("AI create_element Text → 저장 `{children: 'Text', label: 'AI Label'}` 은 'Text'", () => {
    const props = { children: "Text", label: "AI Label" };
    expect(domText({ id: "t1", type: "Text", props })).toBe(
      resolveTextSourceText("Text", props),
    );
    expect(domText({ id: "t1", type: "Text", props })).toBe("Text");
  });
  it("Text: Pencil import `text` 만 → 그려지고, children 이 stale text 를 이긴다", () => {
    const pencil = { text: "Pencil text" };
    expect(domText({ id: "t2", type: "Text", props: pencil })).toBe(
      "Pencil text",
    );
    const edited = { children: "edited", text: "pencil" };
    expect(domText({ id: "t3", type: "Heading", props: edited })).toBe(
      resolveTextSourceText("Heading", edited),
    );
    expect(domText({ id: "t3", type: "Heading", props: edited })).toBe(
      "edited",
    );
  });
  it("Text: 배열 children 은 계약 문자열화 ('ab') — Skia 와 동일", () => {
    const props = { children: ["a", "b"] };
    expect(domText({ id: "t4", type: "Text", props })).toBe("ab");
    expect(resolveTextSourceText("Text", props)).toBe("ab");
  });
  it("cutover Button: AI update_element `{label: 'Go'}` 는 children 을 그린다", () => {
    const props = { children: "Button", label: "Go" };
    expect(domText({ id: "b1", type: "Button", props }, ["Button"])).toBe(
      resolveTextSourceText("Button", props),
    );
    expect(domText({ id: "b1", type: "Button", props }, ["Button"])).toBe(
      "Button",
    );
  });
});
