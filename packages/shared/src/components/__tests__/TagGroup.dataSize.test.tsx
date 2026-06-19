import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TagGroup, Tag } from "../TagGroup";

/**
 * TagGroup size/variant DOM attribute 계약 (2026-06-19, size 미반영 버그).
 *
 * **버그**: TagGroup 의 size/variant prop 을 편집해도 chip(.react-aria-Tag) 시각이 안 바뀐다.
 *   root cause = TagGroup.tsx 가 size/variant 를 `data-type-size`/`data-type-variant` 로 emit 하는데,
 *   매칭 CSS(packages/shared/src/components/styles/TagGroup.css)는 chip 시각을 부모 후손 선택자
 *   `.react-aria-TagGroup[data-tag-size="lg"] .react-aria-Tag { font-size/padding... }` 로 적용한다.
 *   `data-type-size` ≠ `data-tag-size` → 선택자 매칭 실패 → chip 이 항상 기본(md) 시각으로 고정.
 *
 *   regression 출처: 36b397279 (2026-06-05, ADR-912 영역 B "TagGroup source 단일화") 가 TSX 의
 *   attribute 를 `data-tag-*` → `data-type-*` 로 변경했으나 CSS 는 `data-tag-*` 후손 선택자 유지.
 *   field(TextField 등)는 시각 주체가 자기 자신이라 `data-size` 한 단계로 끝나 영향 없었지만,
 *   TagGroup 은 시각 주체가 chip 이라 부모→chip 후손 선택자 attribute 이름 정합이 필수.
 *
 * **수정**: TagGroup.tsx 의 size/variant emit 을 CSS 정본인 `data-tag-size`/`data-tag-variant` 로 환원.
 *
 * 본 테스트는 CSS 의 size/variant 후손 선택자가 기대하는 attribute 이름과 TSX emit 의 정합을 고정한다.
 *   renderToStaticMarkup(jsdom 불필요)로 정적 HTML 의 root TagGroup attribute 를 직접 검사.
 */

/** static children 기반 TagGroup root 의 HTML 을 렌더 (data-binding 없는 외부 사용 경로). */
function renderTagGroupHtml(props: {
  size?: "sm" | "md" | "lg";
  variant?: string;
  labelPosition?: "top" | "side";
}): string {
  return renderToStaticMarkup(
    <TagGroup
      label="Tags"
      size={props.size}
      variant={props.variant as never}
      labelPosition={props.labelPosition}
      selectionMode="multiple"
    >
      <Tag id="t1">Chocolate</Tag>
      <Tag id="t2">Mint</Tag>
    </TagGroup>,
  );
}

/** root(첫 번째) .react-aria-TagGroup 요소의 특정 data-* 속성값 추출. */
function rootAttr(html: string, attr: string): string | null {
  // 첫 div(=AriaTagGroup root) 의 attr="value" 추출
  const re = new RegExp(`${attr}="([^"]*)"`);
  const m = html.match(re);
  return m ? m[1] : null;
}

describe("TagGroup — size/variant DOM attribute = CSS 후손 선택자 정본(data-tag-*)", () => {
  it("size → data-tag-size emit (CSS `.react-aria-TagGroup[data-tag-size]` 매칭, data-type-size 회귀 가드)", () => {
    const html = renderTagGroupHtml({ size: "lg" });
    // CSS 가 chip 시각을 적용하는 attribute 이름. 회귀(data-type-size) 시 null → FAIL.
    expect(rootAttr(html, "data-tag-size")).toBe("lg");
    // data-type-size 는 CSS 매칭이 없는 dead attribute — 존재하면 회귀.
    expect(rootAttr(html, "data-type-size")).toBeNull();
  });

  it("variant → data-tag-variant emit (CSS `.react-aria-TagGroup[data-tag-variant]` 매칭)", () => {
    const html = renderTagGroupHtml({ variant: "primary" });
    expect(rootAttr(html, "data-tag-variant")).toBe("primary");
    expect(rootAttr(html, "data-type-variant")).toBeNull();
  });

  it("labelPosition → data-label-position emit (side 분기 CSS 매칭, 회귀 무관 동작 확인)", () => {
    const html = renderTagGroupHtml({ labelPosition: "side" });
    expect(rootAttr(html, "data-label-position")).toBe("side");
  });

  it("size 기본값(md) 도 data-tag-size emit", () => {
    const html = renderTagGroupHtml({});
    expect(rootAttr(html, "data-tag-size")).toBe("md");
  });
});
