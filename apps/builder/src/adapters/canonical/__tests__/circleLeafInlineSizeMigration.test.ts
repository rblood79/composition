import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { migrateCircleLeafInlineSize } from "../circleLeafInlineSizeMigration";

/**
 * 정원형 leaf(Avatar / ProgressCircle) stale inline width/height strip migration 가드
 * (2026-07-14 — size 변경이 selection 영역에 미반영되던 버그).
 *
 * factory 가 박아둔 inline width/height(32)가 있으면 enrichWithIntrinsicSize 가 early return
 * 하여 size→diameter(catalog sizes.height) 분기가 안 돈다 → size 를 바꿔도 layout bounds 가
 * 32 고정 → selection 박스 미갱신. 본 migration 은 hydration 시점에 그 잔재를 strip 한다.
 *
 * **사용자 조정값은 보존** — factory 기본값(32)과 정확히 일치할 때만 strip.
 */

function node(
  type: string,
  id: string,
  props: Record<string, unknown> = {},
  children?: CanonicalNode[],
): CanonicalNode {
  return {
    type,
    id,
    props,
    ...(children ? { children } : {}),
  } as CanonicalNode;
}

function doc(children: CanonicalNode[]): CompositionDocument {
  return { version: "composition-1.0", children } as CompositionDocument;
}

function findNode(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children ?? [], id);
    if (found) return found;
  }
  return undefined;
}

function styleOf(
  d: CompositionDocument,
  id: string,
): Record<string, unknown> | undefined {
  const n = findNode(d.children, id);
  return (n?.props as Record<string, unknown> | undefined)?.style as
    | Record<string, unknown>
    | undefined;
}

describe("migrateCircleLeafInlineSize", () => {
  describe("stale factory inline(32) strip", () => {
    it("ProgressCircle 의 width/height 32 를 제거 (catalog sizes 가 크기 결정하도록)", () => {
      const before = doc([
        node("ProgressCircle", "pc", {
          size: "lg",
          style: { width: 32, height: 32 },
        }),
      ]);
      const after = migrateCircleLeafInlineSize(before);
      const style = styleOf(after, "pc");

      expect(style).toBeDefined();
      expect("width" in style!).toBe(false);
      expect("height" in style!).toBe(false);
    });

    it("Avatar 의 width/height 32 를 제거", () => {
      const before = doc([
        node("Avatar", "av", {
          size: "xl",
          initials: "A",
          style: { width: 32, height: 32 },
        }),
      ]);
      const style = styleOf(migrateCircleLeafInlineSize(before), "av");
      expect("width" in style!).toBe(false);
      expect("height" in style!).toBe(false);
    });

    it('"32px" 문자열 형태도 잔재로 인식', () => {
      const before = doc([
        node("Avatar", "av", { style: { width: "32px", height: "32px" } }),
      ]);
      const style = styleOf(migrateCircleLeafInlineSize(before), "av");
      expect("width" in style!).toBe(false);
      expect("height" in style!).toBe(false);
    });

    it("중첩 자식(AvatarGroup > Avatar)도 DFS 로 strip", () => {
      const before = doc([
        node("AvatarGroup", "grp", { style: { display: "flex" } }, [
          node("Avatar", "a1", {
            style: { width: 32, height: 32, marginLeft: -8 },
          }),
          node("Avatar", "a2", {
            style: { width: 32, height: 32, marginLeft: -8 },
          }),
        ]),
      ]);
      const after = migrateCircleLeafInlineSize(before);
      for (const id of ["a1", "a2"]) {
        const style = styleOf(after, id)!;
        expect("width" in style).toBe(false);
        expect("height" in style).toBe(false);
        // 겹침 효과(marginLeft)는 catalog 미보유 값 → 보존
        expect(style.marginLeft).toBe(-8);
      }
      // 부모 AvatarGroup 의 inline 은 대상 아님
      expect(styleOf(after, "grp")!.display).toBe("flex");
    });
  });

  describe("사용자 조정값 보존", () => {
    it("32 가 아닌 크기는 의도된 override → 유지", () => {
      const before = doc([
        node("Avatar", "av", { size: "md", style: { width: 48, height: 48 } }),
      ]);
      const style = styleOf(migrateCircleLeafInlineSize(before), "av");
      expect(style!.width).toBe(48);
      expect(style!.height).toBe(48);
    });

    it("한쪽만 조정된 경우 그쪽만 보존 (독립 판정)", () => {
      const before = doc([
        node("ProgressCircle", "pc", { style: { width: 64, height: 32 } }),
      ]);
      const style = styleOf(migrateCircleLeafInlineSize(before), "pc")!;
      expect(style.width).toBe(64); // 사용자 조정 → 보존
      expect("height" in style).toBe(false); // factory 잔재 → strip
    });

    it("width/height 외 inline 은 항상 보존", () => {
      const before = doc([
        node("Avatar", "av", {
          style: { width: 32, height: 32, marginLeft: -8, opacity: 0.5 },
        }),
      ]);
      const style = styleOf(migrateCircleLeafInlineSize(before), "av")!;
      expect(style.marginLeft).toBe(-8);
      expect(style.opacity).toBe(0.5);
    });
  });

  describe("비대상 / 멱등", () => {
    it("대상 아닌 type 은 미변경 (Image 는 자연 치수 컴포넌트 — strip 금지)", () => {
      const before = doc([
        node("Image", "img", { style: { width: 32, height: 32 } }),
      ]);
      const after = migrateCircleLeafInlineSize(before);
      expect(after).toBe(before); // 동일 참조
      expect(styleOf(after, "img")!.width).toBe(32);
    });

    it("strip 대상 없으면 동일 참조 반환 (멱등)", () => {
      const before = doc([node("Avatar", "av", { size: "lg", style: {} })]);
      expect(migrateCircleLeafInlineSize(before)).toBe(before);
    });

    it("두 번 적용해도 결과 동일 (멱등)", () => {
      const before = doc([
        node("Avatar", "av", { style: { width: 32, height: 32 } }),
      ]);
      const once = migrateCircleLeafInlineSize(before);
      const twice = migrateCircleLeafInlineSize(once);
      expect(twice).toBe(once); // 두 번째는 변경 없음 → 동일 참조
    });

    it("style 자체가 없는 노드도 안전", () => {
      const before = doc([node("ProgressCircle", "pc", { size: "sm" })]);
      expect(migrateCircleLeafInlineSize(before)).toBe(before);
    });
  });
});
