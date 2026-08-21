/**
 * Cutover internal leaf — marker props passthrough contract (ADR-151 후속, 2026-07-17)
 *
 * 배경: CanonicalNodeRenderer 의 cutover 경로는 비위임 internal leaf 를
 * `<PrimitiveComponent {...markerProps} ...>` 로 렌더한다 — marker
 * (data-element-id/data-canonical-id)가 **컴포넌트 props** 로 전달되므로, 컴포넌트가
 * rest 를 root 에 전개하지 않으면 marker 가 DOM 에서 소실된다. 소실 시 preview 의
 * 측정 하니스와 클릭 선택(App.tsx `closest("[data-element-id]")`)이 해당 요소를 못
 * 찾는다. IllustratedMessage("preview 미렌더" 로 관측됐던 실체)·Skeleton 2종이
 * 이 결함이었고, 본 테스트는 비위임 internal leaf 전수를 lock 한다.
 *
 * 대상 = INTERNAL_RENDERERS(CanonicalNodeRenderer.tsx) 중 DELEGATING 집합
 * (renderFacetDeclaration.ts)에 없는 leaf 7종. delegating renderer 는 wrapper div 가
 * marker 를 보유하므로 대상 아님.
 */

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Icon } from "../Icon";
import { Badge } from "../Badge";
import { Skeleton } from "../Skeleton";
import { IllustratedMessage } from "../IllustratedMessage";
import { StatusLight } from "../StatusLight";
import { Avatar } from "../Avatar";
import { ProgressCircle } from "../ProgressCircle";

const MARKER = {
  "data-element-id": "probe-el",
  "data-canonical-id": "probe-cn",
};

type AnyComponent = React.ComponentType<Record<string, unknown>>;

const NON_DELEGATING_INTERNAL_LEAVES: Array<{
  name: string;
  component: AnyComponent;
  props: Record<string, unknown>;
}> = [
  { name: "icon", component: Icon as AnyComponent, props: {} },
  { name: "badge", component: Badge as AnyComponent, props: { children: "b" } },
  { name: "skeleton", component: Skeleton as AnyComponent, props: {} },
  {
    name: "skeleton (componentVariant 분기)",
    component: Skeleton as AnyComponent,
    props: { componentVariant: "button" },
  },
  {
    name: "skeleton (multi-line 분기)",
    component: Skeleton as AnyComponent,
    props: { lines: 3 },
  },
  {
    name: "illustrated",
    component: IllustratedMessage as AnyComponent,
    props: { heading: "h" },
  },
  {
    name: "statuslight",
    component: StatusLight as AnyComponent,
    props: { children: "on" },
  },
  {
    name: "avatar",
    component: Avatar as AnyComponent,
    props: { initials: "AB" },
  },
  {
    name: "progresscircle",
    component: ProgressCircle as AnyComponent,
    props: { value: 40 },
  },
];

describe("cutover internal leaf marker passthrough (ADR-151 후속)", () => {
  it.each(NON_DELEGATING_INTERNAL_LEAVES)(
    "$name — data-element-id 를 DOM 에 방출한다",
    ({ component, props }) => {
      const html = renderToStaticMarkup(
        React.createElement(component, { ...props, ...MARKER }),
      );
      expect(html).toContain('data-element-id="probe-el"');
    },
  );
});

/** design-data 감사 §2-F isDisabled 노출 (2026-08-21) — Badge 는 data-disabled attr 로
 *  generated `[data-disabled]` CSS(opacity 0.38)에 연결된다 (raw prop 누출 없음). */
describe("Badge — isDisabled → data-disabled (§2-F, 2026-08-21)", () => {
  it("isDisabled true → data-disabled attr / false → 부재", () => {
    const on = renderToStaticMarkup(<Badge isDisabled>b</Badge>);
    expect(on).toContain("data-disabled");
    const off = renderToStaticMarkup(<Badge>b</Badge>);
    expect(off).not.toContain("data-disabled");
    // raw isDisabled 속성 누출 없음 (React unknown-attr 경고 축)
    expect(on).not.toContain("isdisabled");
  });
});
