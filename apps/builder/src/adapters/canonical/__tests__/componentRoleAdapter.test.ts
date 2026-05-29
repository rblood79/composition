/**
 * componentRoleAdapter.ts 단위 테스트 — ADR-903 P1 Stage 2
 *
 * 검증 대상:
 *   - componentRole === "master" → reusable: true
 *   - componentRole === "instance" + masterId → ref: <stable path>
 *   - idPathMap miss(broken instance) → ref: masterId UUID + console.warn
 *   - overrides → rootOverrides
 *   - 빈 overrides {} → rootOverrides undefined
 *   - descendants UUID key → stable path remap
 *   - descendants UUID가 idPathMap 미존재 → UUID 그대로 + warn
 *   - 일반 element(componentRole 없음) → 모든 필드 undefined
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { convertComponentRole } from "../componentRoleAdapter";
import type { Element } from "@/types/builder/unified.types";
import type { ElementWithLegacyMirror } from "../legacyElementFields";

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * 최소 필드를 가진 테스트용 Element 생성 헬퍼.
 *
 * `componentRole`/`masterId`/`overrides`/`descendants` 는 canonical schema 로
 * 이전된 legacy mirror 필드 (`ElementWithLegacyMirror`). runtime adapter 가
 * 객체에서 읽으므로 fixture 값은 유지하고 param 타입만 mirror 로 확장한다.
 * `order_num` 은 ADR-125 에서 제거됐으나 동일하게 값만 보존.
 */
type LegacyMirrorOverrides = Partial<ElementWithLegacyMirror> & {
  id: string;
  order_num?: number;
};
function makeEl(overrides: LegacyMirrorOverrides): Element {
  return {
    type: "Button",
    props: {},
    parent_id: null,
    order_num: 0,
    ...overrides,
  } as Element;
}

describe("convertComponentRole — master", () => {
  it("componentRole === 'master' → reusable: true 반환", () => {
    // Arrange
    const el = makeEl({ id: "m1", componentRole: "master" });
    const idPathMap = new Map<string, string>();

    // Act
    const result = convertComponentRole(el, { idPathMap });

    // Assert
    expect(result.reusable).toBe(true);
    expect(result.ref).toBeUndefined();
    expect(result.rootOverrides).toBeUndefined();
    expect(result.descendantsRemapped).toBeUndefined();
  });
});

describe("convertComponentRole — instance ref 변환", () => {
  it("componentRole === 'instance' + masterId → ref: stable path 반환", () => {
    // Arrange
    const masterUuid = "master-uuid-abc";
    const stablePath = "submit-button";
    const el = makeEl({
      id: "i1",
      componentRole: "instance",
      masterId: masterUuid,
    });
    const idPathMap = new Map([[masterUuid, stablePath]]);

    // Act
    const result = convertComponentRole(el, { idPathMap });

    // Assert
    expect(result.ref).toBe(stablePath);
    expect(result.reusable).toBeUndefined();
  });

  it("idPathMap에 masterId 없음(broken instance) → ref: masterId UUID 그대로 + console.warn 호출", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unknownMasterId = "unknown-master-uuid";
    const el = makeEl({
      id: "broken-instance",
      componentRole: "instance",
      masterId: unknownMasterId,
    });
    const idPathMap = new Map<string, string>(); // masterId 없음

    // Act
    const result = convertComponentRole(el, { idPathMap });

    // Assert: UUID 그대로 보존
    expect(result.ref).toBe(unknownMasterId);
    // warn 호출 확인
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(unknownMasterId),
    );
  });
});

describe("convertComponentRole — overrides → rootOverrides.props", () => {
  it("overrides: { fontSize: 14 } → rootOverrides.props", () => {
    // Arrange
    const el = makeEl({
      id: "i2",
      componentRole: "instance",
      masterId: "m2",
      overrides: { fontSize: 14 },
    });
    const idPathMap = new Map([["m2", "master-path"]]);

    // Act
    const result = convertComponentRole(el, { idPathMap });

    // Assert
    expect(result.rootOverrides).toEqual({ props: { fontSize: 14 } });
  });

  it("overrides: {} (빈 객체) → rootOverrides: undefined", () => {
    // Arrange
    const el = makeEl({
      id: "i3",
      componentRole: "instance",
      masterId: "m3",
      overrides: {},
    });
    const idPathMap = new Map([["m3", "master-path-2"]]);

    // Act
    const result = convertComponentRole(el, { idPathMap });

    // Assert
    expect(result.rootOverrides).toBeUndefined();
  });
});

describe("convertComponentRole — descendants UUID → stable path remap", () => {
  it("descendants UUID key → idPathMap에 있으면 stable path key로 변환", () => {
    // Arrange
    const childUuid = "child-uuid-label";
    const childPath = "ok-button/label";
    const el = makeEl({
      id: "i4",
      componentRole: "instance",
      masterId: "m4",
      descendants: {
        [childUuid]: { fontSize: 16 },
      },
    });
    const idPathMap = new Map([
      ["m4", "ok-button"],
      [childUuid, childPath],
    ]);

    // Act
    const result = convertComponentRole(el, { idPathMap });

    // Assert
    expect(result.descendantsRemapped).toEqual({
      [childPath]: { fontSize: 16 },
    });
  });

  it("descendants UUID가 idPathMap에 없으면 UUID 그대로 보존 + console.warn 호출", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unknownChildUuid = "unknown-child-uuid";
    const el = makeEl({
      id: "i5",
      componentRole: "instance",
      masterId: "m5",
      descendants: {
        [unknownChildUuid]: { color: "red" },
      },
    });
    const idPathMap = new Map([["m5", "master-path-3"]]);

    // Act
    const result = convertComponentRole(el, { idPathMap });

    // Assert: UUID 그대로 보존
    expect(result.descendantsRemapped).toEqual({
      [unknownChildUuid]: { color: "red" },
    });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(unknownChildUuid),
    );
  });
});

describe("convertComponentRole — 일반 element(componentRole 없음)", () => {
  it("componentRole 없으면 모든 result 필드가 undefined", () => {
    // Arrange
    const el = makeEl({ id: "plain-1" }); // componentRole 미설정
    const idPathMap = new Map<string, string>();

    // Act
    const result = convertComponentRole(el, { idPathMap });

    // Assert
    expect(result.reusable).toBeUndefined();
    expect(result.ref).toBeUndefined();
    expect(result.rootOverrides).toBeUndefined();
    expect(result.descendantsRemapped).toBeUndefined();
  });
});
