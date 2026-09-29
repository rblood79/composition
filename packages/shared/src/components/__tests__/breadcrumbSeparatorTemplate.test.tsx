import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { resolveBreadcrumbSeparatorTemplate } from "../../catalog/slotRoles";
import { Breadcrumbs } from "../Breadcrumbs";
import { Icon } from "../Icon";

/**
 * 2026-09-29 — 데이터 행 Breadcrumb (문서 노드 없음) 은 항목 origin 의 편집 가능한 구분자 Icon 설정을 따른다:
 * origin 없음 = catalog 기본 · 구분자 자식 없음/꺼짐 = 없음 · 이름 = 그 Icon. Canvas projection 과 Preview 행이
 * 같은 `resolveBreadcrumbSeparatorTemplate` 을 부른다.
 */
const ORIGIN = "component-breadcrumb-item-default";
const origin = (children: unknown[]) => ({ type: "Breadcrumb", children });
const label = { type: "Text", metadata: { slotRole: "label" }, props: {} };
const separator = (props: Record<string, unknown>, extra = {}) => ({
  type: "Icon",
  metadata: { slotRole: "separator" },
  props: { slot: "separator", ...props },
  ...extra,
});

describe("resolveBreadcrumbSeparatorTemplate", () => {
  const lookupOf = (nodes: Record<string, unknown>) => (id: string) =>
    nodes[id] as never;

  it("origin 없음 → undefined (catalog 기본)", () => {
    expect(resolveBreadcrumbSeparatorTemplate(undefined, () => undefined)).toBe(
      undefined,
    );
  });

  it("구분자 자식 없음 · 꺼짐 → null", () => {
    expect(
      resolveBreadcrumbSeparatorTemplate(
        undefined,
        lookupOf({ [ORIGIN]: origin([label]) }),
      ),
    ).toBeNull();
    expect(
      resolveBreadcrumbSeparatorTemplate(
        undefined,
        lookupOf({
          [ORIGIN]: origin([
            label,
            separator({ iconName: "slash" }, { enabled: false }),
          ]),
        }),
      ),
    ).toBeNull();
  });

  it("owner slot[0] 의 변형 ref 는 체인 끝 origin 의 구분자 이름", () => {
    expect(
      resolveBreadcrumbSeparatorTemplate(
        ["custom-ref"],
        lookupOf({
          "custom-ref": { type: "ref", ref: ORIGIN },
          [ORIGIN]: origin([label, separator({ iconName: "slash" })]),
        }),
      ),
    ).toEqual({ iconName: "slash" });
  });
});

describe("Breadcrumbs 데이터 행 구분자", () => {
  const items = [
    { id: "a", label: "A", href: "/" },
    { id: "b", label: "B" },
  ];
  const icons = (html: string) =>
    (html.match(/class="react-aria-Icon"/g) ?? []).length;

  it("기본 · 이름: 마지막이 아닌 행마다 Icon 1 · null: Icon 없음", () => {
    expect(icons(renderToStaticMarkup(<Breadcrumbs items={items} />))).toBe(1);
    expect(
      icons(
        renderToStaticMarkup(
          <Breadcrumbs
            items={items}
            separatorTemplate={{ iconName: "slash" }}
          />,
        ),
      ),
    ).toBe(1);
    expect(
      icons(
        renderToStaticMarkup(
          <Breadcrumbs items={items} separatorTemplate={null} />,
        ),
      ),
    ).toBe(0);
  });
});

describe("Icon 은 장식 글리프", () => {
  it("svg 는 aria-hidden", () => {
    expect(renderToStaticMarkup(<Icon iconName="chevron-right" />)).toContain(
      'aria-hidden="true"',
    );
  });
});
