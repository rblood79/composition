/**
 * idPath.ts 단위 테스트 — ADR-903 P1 Stage 2
 *
 * 검증 대상:
 *   - buildIdPathContext: UUID → stable id path 생성 + 역방향 매핑
 *   - 우선순위: customId > componentName > tag
 *   - 형제 동명 → "-N" suffix
 *   - slash sanitize
 *   - 빈 문자열 → "node" fallback
 *   - pathIdMap 역방향 일관성
 */

import { describe, it, expect } from "vitest";
import { buildIdPathContext } from "../idPath";
import type { Element } from "@/types/builder/unified.types";

/**
 * 최소 필드만 가진 테스트용 Element 생성 헬퍼.
 *
 * `order_num` 은 canonical schema 에서 제거됐으나 (ADR-125) legacy fixture/runtime
 * 이 객체에서 읽으므로 값은 유지하고 타입만 옵션 확장으로 흡수한다.
 */
type LegacyElOverrides = Partial<Element> & {
  id: string;
  type: string;
  order_num?: number;
};
function makeEl(overrides: LegacyElOverrides): Element {
  return {
    props: {},
    parent_id: null,
    order_num: 0,
    ...overrides,
  } as Element;
}

describe("buildIdPathContext — 단일 root element", () => {
  it("customId가 있으면 customId를 path로 사용", () => {
    // Arrange
    const el = makeEl({ id: "uuid-1", type: "Button", customId: "ok-button" });

    // Act
    const { idPathMap } = buildIdPathContext([el]);

    // Assert
    expect(idPathMap.get("uuid-1")).toBe("ok-button");
  });

  it("customId 없고 componentName 있으면 componentName 사용", () => {
    // Arrange
    const el = makeEl({
      id: "uuid-2",
      type: "Button",
      componentName: "Submit Button",
    });

    // Act
    const { idPathMap } = buildIdPathContext([el]);

    // Assert
    expect(idPathMap.get("uuid-2")).toBe("Submit Button");
  });

  it("customId·componentName 없으면 tag 사용", () => {
    // Arrange
    const el = makeEl({ id: "uuid-3", type: "Card" });

    // Act
    const { idPathMap } = buildIdPathContext([el]);

    // Assert
    expect(idPathMap.get("uuid-3")).toBe("Card");
  });
});

describe("buildIdPathContext — 부모-자식 2-level path", () => {
  it("부모/자식 형태의 path 생성", () => {
    // Arrange
    const parent = makeEl({ id: "p1", type: "Box" });
    const child = makeEl({
      id: "c1",
      type: "Label",
      parent_id: "p1",
    });

    // Act
    const { idPathMap } = buildIdPathContext([parent, child]);

    // Assert
    expect(idPathMap.get("p1")).toBe("Box");
    expect(idPathMap.get("c1")).toBe("Box/Label");
  });
});

describe("buildIdPathContext — 형제 동명 suffix", () => {
  it("같은 이름의 형제가 3개 → 첫째는 원본, 둘째는 '-2', 셋째는 '-3'", () => {
    // Arrange
    const parent = makeEl({ id: "parent", type: "Box" });
    const btn1 = makeEl({ id: "b1", type: "Button", parent_id: "parent" });
    const btn2 = makeEl({ id: "b2", type: "Button", parent_id: "parent" });
    const btn3 = makeEl({ id: "b3", type: "Button", parent_id: "parent" });

    // Act
    const { idPathMap } = buildIdPathContext([parent, btn1, btn2, btn3]);

    // Assert
    expect(idPathMap.get("b1")).toBe("Box/Button");
    expect(idPathMap.get("b2")).toBe("Box/Button-2");
    expect(idPathMap.get("b3")).toBe("Box/Button-3");
  });
});

describe("buildIdPathContext — slash sanitize", () => {
  it("componentName에 slash 포함 → underscore로 치환", () => {
    // Arrange
    const el = makeEl({
      id: "uuid-slash",
      type: "Card",
      componentName: "header/title",
    });

    // Act
    const { idPathMap } = buildIdPathContext([el]);

    // Assert: slash는 경로 구분자로만 사용되므로 id segment에서 _로 치환
    expect(idPathMap.get("uuid-slash")).toBe("header_title");
  });
});

describe("buildIdPathContext — 빈 문자열 fallback", () => {
  it("tag가 빈 문자열이면 'node' fallback 사용", () => {
    // Arrange
    const el = makeEl({ id: "uuid-empty", type: "" });

    // Act
    const { idPathMap } = buildIdPathContext([el]);

    // Assert
    expect(idPathMap.get("uuid-empty")).toBe("node");
  });
});

describe("buildIdPathContext — 역방향 매핑 pathIdMap 일관성", () => {
  it("pathIdMap.get(idPathMap.get(id)) === id (양방향 일관성)", () => {
    // Arrange
    const parent = makeEl({
      id: "p",
      type: "Box",
      customId: "container",
    });
    const child = makeEl({
      id: "c",
      type: "Button",
      parent_id: "p",
      customId: "submit",
    });

    // Act
    const { idPathMap, pathIdMap } = buildIdPathContext([parent, child]);

    // Assert
    for (const id of ["p", "c"]) {
      const path = idPathMap.get(id);
      expect(path).toBeDefined();
      expect(pathIdMap.get(path!)).toBe(id);
    }
  });
});
