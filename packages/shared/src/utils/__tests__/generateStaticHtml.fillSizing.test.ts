import { describe, expect, it } from "vitest";

import type { CompositionDocument } from "../../types/composition-document.types";
import { generateStaticHtml } from "../export.utils";
import { collectResponsiveCss } from "../responsiveCss";

/**
 * ADR-224 G2 — 정적 export 가 Fill marker (factor · tier null) 를 Preview 와 같은 emitter
 * (`collectResponsiveCss`) 로 CSS 에 낸다. base Fill 2 · tablet = null + 320px · mobile 미지정.
 */
describe("generateStaticHtml — ADR-224 Fill sizing", () => {
  const doc: CompositionDocument = {
    version: 1,
    children: [
      {
        id: "page-1",
        type: "page",
        name: "Home",
        metadata: { type: "page", pageRole: "page" },
        children: [
          {
            id: "row",
            type: "frame",
            // 폭이 정해진 Row — hug 부모면 fraction Fill 은 basis auto 로 내려간다 (별도 테스트)
            props: {
              style: { display: "flex", flexDirection: "row", width: "900px" },
            },
            children: [
              {
                id: "a",
                type: "Button",
                props: { style: {} },
                sizing: { width: { factor: 2 } },
                responsive: {
                  sizing: { tablet: { width: null } },
                  styles: { width: { tablet: "320px" } },
                },
              },
            ],
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;

  const html = generateStaticHtml("proj-1", "Test", doc);
  const css = collectResponsiveCss(doc.children ?? []);

  it("desktop: base Fill 2 → flex-grow 2 · flex-basis 0 · width auto (derived, !important)", () => {
    const desktop = css
      .split("\n")
      .find((line) => line.startsWith('[data-element-id="a"]{'));
    expect(desktop).toContain("flex-grow:2 !important");
    expect(desktop).toContain("flex-basis:0px !important");
    expect(desktop).toContain("width:auto !important");
    expect(html).toContain(desktop!);
  });

  it("tablet: null 해제 → grow 0 · 320px 고정, mobile 은 tablet 을 상속 (미지정)", () => {
    // style override 규칙 (width 만) 과 Fill 파생 규칙 (grow/basis 포함) 이 tier 마다 하나씩 — 후자를 본다
    const tablet = css
      .split("\n")
      .find(
        (line) =>
          line.startsWith("@media (min-width: 768px)") &&
          line.includes("flex-grow"),
      );
    expect(tablet).toContain("flex-grow:0 !important");
    expect(tablet).toContain("flex-basis:auto !important");
    expect(tablet).toContain("width:320px !important");
    const mobile = css
      .split("\n")
      .find(
        (line) =>
          line.startsWith("@media (max-width: 767px)") &&
          line.includes("flex-grow"),
      );
    expect(mobile).toContain("flex-grow:0 !important");
    expect(mobile).toContain("width:320px !important");
    expect(html).toContain(tablet!);
    expect(html).toContain(mobile!);
  });

  it("marker 없는 CSS-only 노드는 Fill 규칙을 내지 않는다 (무편집 출력 불변)", () => {
    const plain = collectResponsiveCss([
      {
        id: "p",
        type: "frame",
        props: { style: { display: "flex" } },
        children: [
          { id: "b", type: "Button", props: { style: { width: "200px" } } },
        ],
      },
    ] as unknown as CompositionDocument["children"]);
    expect(plain).not.toContain('[data-element-id="b"]');
  });
});
