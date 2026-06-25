import { describe, it, expect } from "vitest";
import {
  createDisclosureDefinition,
  createDisclosureGroupDefinition,
} from "../NavigationComponents";
import type { ComponentCreationContext } from "../../types";

/**
 * 회귀 방지 (2026-06-25): Disclosure factory 의 DisclosureHeader child 가 width:100% +
 * justify-content:flex-start 를 갖는지 검증.
 *
 * **배경**: factory child def 에 style 이 없으면 새로 생성된 DisclosureHeader leaf 가 Skia 에서
 * 콘텐츠 폭(auto)으로 렌더 → DOM(헤더 button width:100%) / 레퍼런스(starter .disclosure-button
 * width 100%)와 발산(사용자: "skia 는 width auto, css/레퍼런스는 100%"). 정렬도 flex-start 정합 필요.
 */

const ctx: ComponentCreationContext = {
  parentElement: null,
  elements: [],
} as unknown as ComponentCreationContext;

type FactoryNode = { type: string; props?: unknown; children?: unknown };

function findHeaders(children: FactoryNode[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const walk = (nodes: FactoryNode[]): void => {
    for (const n of nodes) {
      if (n.type === "DisclosureHeader")
        out.push(n.props as Record<string, unknown>);
      if (Array.isArray(n.children)) walk(n.children as FactoryNode[]);
    }
  };
  walk(children);
  return out;
}

describe("Disclosure factory — DisclosureHeader width:100% + flex-start (3경로 정합)", () => {
  it("createDisclosureDefinition 의 DisclosureHeader 가 width:100% + justify flex-start", () => {
    const def = createDisclosureDefinition(ctx);
    const headers = findHeaders(def.children as FactoryNode[]);
    expect(headers.length).toBeGreaterThanOrEqual(1);
    for (const h of headers) {
      const style = h.style as Record<string, unknown> | undefined;
      expect(style?.width).toBe("100%");
      expect(style?.justifyContent).toBe("flex-start");
    }
  });

  it("createDisclosureGroupDefinition 의 모든 DisclosureHeader 가 width:100% + flex-start", () => {
    const def = createDisclosureGroupDefinition(ctx);
    const headers = findHeaders(def.children as FactoryNode[]);
    expect(headers.length).toBeGreaterThanOrEqual(2);
    for (const h of headers) {
      const style = h.style as Record<string, unknown> | undefined;
      expect(style?.width).toBe("100%");
      expect(style?.justifyContent).toBe("flex-start");
    }
  });
});
