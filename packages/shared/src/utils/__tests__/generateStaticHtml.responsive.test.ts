import { describe, expect, it } from "vitest";

import type { CompositionDocument } from "../../types/composition-document.types";
import { generateStaticHtml } from "../export.utils";

/**
 * ADR-154 Phase 3-c — Publish(generateStaticHtml) 반응형 @media 출력.
 *
 * R2(3경로 발산 차단): Preview 와 동일 collectResponsiveCss SSOT 로 @media emit,
 * 런타임 JS 는 inline 적용 → @media !important 가 이긴다(R6). selector 매칭용
 * data-element-id 마커를 런타임에 세팅하는지 확인.
 */
describe("generateStaticHtml — responsive @media", () => {
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
            id: "el-hero",
            type: "frame",
            props: { style: { flexDirection: "row", width: 200 } },
            responsive: {
              styles: {
                flexDirection: { tablet: "column" },
                width: { mobile: 80 },
              },
            },
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;

  const html = generateStaticHtml("proj-1", "Test", doc);

  it("@media override 규칙을 <style> 에 emit (tablet flexDirection + mobile width)", () => {
    expect(html).toContain(
      `@media (min-width: 768px) and (max-width: 1279px){[data-element-id="el-hero"]{flex-direction:column !important`,
    );
    expect(html).toContain(
      `@media (max-width: 767px){[data-element-id="el-hero"]{`,
    );
    expect(html).toContain(`width:80px !important`);
  });

  it("런타임 JS 가 data-element-id 마커를 세팅 (selector 매칭)", () => {
    expect(html).toContain("dom.dataset.elementId = node.id");
  });

  it("responsive 부재 문서는 @media 규칙 미emit", () => {
    const plain: CompositionDocument = {
      version: 1,
      children: [
        {
          id: "page-1",
          type: "page",
          name: "Home",
          metadata: { type: "page", pageRole: "page" },
          children: [
            { id: "el-plain", type: "frame", props: { style: { width: 100 } } },
          ],
        },
      ],
    } as unknown as CompositionDocument;
    const plainHtml = generateStaticHtml("p", "Plain", plain);
    expect(plainHtml).not.toContain("!important");
    expect(plainHtml).not.toContain('[data-element-id="el-plain"]');
  });
});
