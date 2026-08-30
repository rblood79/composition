/**
 * ADR-158 G1 정적 가드 — capability registry 구조 계약.
 *
 * G1: "capability registry 전 항목에 RAC controlled prop 근거(`racRef`) 명시 +
 * 정적 테스트로 근거 누락 차단". 본 파일이 그 집행 지점이다.
 */
import { describe, expect, it } from "vitest";

import {
  APP_ACTIONS,
  CAPABILITY_REGISTRY,
  COMMON_CAPABILITIES,
  isCapabilityTarget,
  resolveCapabilities,
  resolveTriggers,
  type CapabilityDef,
} from "../capabilityRegistry";
import { isInteractionRule } from "../interactionRule.types";

const ALL_DEFS: Array<[string, string, CapabilityDef]> = [
  ...Object.entries(COMMON_CAPABILITIES).map(
    ([key, def]) => ["(공통)", key, def] as [string, string, CapabilityDef],
  ),
  ...Object.entries(CAPABILITY_REGISTRY).flatMap(([type, entry]) =>
    Object.entries(entry.capabilities).map(
      ([key, def]) => [type, key, def] as [string, string, CapabilityDef],
    ),
  ),
];

describe("G1 — capability 근거 집행", () => {
  it("모든 capability 에 racRef 가 있다 (근거 없는 등재 차단)", () => {
    const missing = ALL_DEFS.filter(([, , def]) => !def.racRef?.trim()).map(
      ([type, key]) => `${type}.${key}`,
    );
    expect(missing).toEqual([]);
  });

  it("모든 capability 에 label 이 있다", () => {
    const missing = ALL_DEFS.filter(([, , def]) => !def.labelKey?.trim()).map(
      ([type, key]) => `${type}.${key}`,
    );
    expect(missing).toEqual([]);
  });

  it("prop 은 imperative 특례에서만 비어 있을 수 있다", () => {
    const bad = ALL_DEFS.filter(
      ([, , def]) => !def.prop.trim() && !def.imperative,
    ).map(([type, key]) => `${type}.${key}`);
    expect(bad).toEqual([]);
  });

  it('value "!param" 과 param 선언은 1:1 쌍이다', () => {
    const unpaired = ALL_DEFS.filter(
      ([, , def]) => (def.value === "!param") !== Boolean(def.param),
    ).map(([type, key]) => `${type}.${key}`);
    expect(unpaired).toEqual([]);
  });
});

describe("When 축 — 어휘 정합", () => {
  it("모든 trigger 가 RAC callback 명명 규약을 따른다 (DOM 별칭 은퇴)", () => {
    const bad = Object.entries(CAPABILITY_REGISTRY).flatMap(([type, entry]) =>
      entry.events
        .filter((e) => !/^on[A-Z]/.test(e))
        .map((e) => `${type}.${e}`),
    );
    expect(bad).toEqual([]);
  });

  it("은퇴한 DOM 별칭이 어떤 컴포넌트에도 없다", () => {
    const RETIRED = [
      "onClick",
      "onDoubleClick",
      "onMouseEnter",
      "onMouseLeave",
      "onMouseDown",
      "onMouseUp",
      "onKeyDown",
      "onKeyUp",
      "onKeyPress",
      "onInput",
      "onScroll",
      "onResize",
      "onLoad",
    ];
    const found = Object.entries(CAPABILITY_REGISTRY).flatMap(([type, entry]) =>
      entry.events
        .filter((e) => RETIRED.includes(e))
        .map((e) => `${type}.${e}`),
    );
    expect(found).toEqual([]);
  });

  it("모든 등재 컴포넌트가 트리거 또는 capability 중 하나 이상을 제공한다", () => {
    const empty = Object.entries(CAPABILITY_REGISTRY)
      .filter(
        ([, entry]) =>
          entry.events.length === 0 &&
          Object.keys(entry.capabilities).length === 0,
      )
      .map(([type]) => type);
    expect(empty).toEqual([]);
  });
});

describe("보류(deferred) 계약", () => {
  it("deferred 키는 같은 컴포넌트의 capabilities 에 동시 존재하지 않는다", () => {
    const conflict = Object.entries(CAPABILITY_REGISTRY).flatMap(
      ([type, entry]) =>
        (entry.deferred ?? [])
          .filter((k) => k in entry.capabilities)
          .map((k) => `${type}.${k}`),
    );
    expect(conflict).toEqual([]);
  });

  it("deferred 는 공통 capability 를 가리지 않는다 (show/hide/toggle 는 항상 가능)", () => {
    const shadowed = Object.entries(CAPABILITY_REGISTRY).flatMap(
      ([type, entry]) =>
        (entry.deferred ?? [])
          .filter((k) => k in COMMON_CAPABILITIES)
          .map((k) => `${type}.${k}`),
    );
    expect(shadowed).toEqual([]);
  });

  it("보류 컴포넌트도 트리거로는 쓸 수 있다", () => {
    for (const [type, entry] of Object.entries(CAPABILITY_REGISTRY)) {
      if ((entry.deferred?.length ?? 0) > 0) {
        expect(resolveTriggers(type).length, `${type}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("resolve 헬퍼", () => {
  it("미등록 type 도 공통 3종을 갖는다", () => {
    expect(Object.keys(resolveCapabilities("존재하지않는타입"))).toEqual([
      "show",
      "hide",
      "toggle",
    ]);
    expect(isCapabilityTarget("존재하지않는타입")).toBe(true);
  });

  it("등록 type 은 공통 + 고유가 병합된다", () => {
    const tree = resolveCapabilities("Tree");
    expect(Object.keys(tree)).toEqual(
      expect.arrayContaining([
        "show",
        "hide",
        "toggle",
        "selectItem",
        "clearSelection",
        "expand",
        "collapse",
      ]),
    );
  });

  it("미등록 type 은 트리거가 없다", () => {
    expect(resolveTriggers("존재하지않는타입")).toEqual([]);
  });

  it("보류 컴포넌트의 고유 capability 는 노출되지 않는다", () => {
    // Select 는 selectItem 이 deferred — 공통 3종만 남아야 한다
    expect(Object.keys(resolveCapabilities("Select"))).toEqual([
      "show",
      "hide",
      "toggle",
    ]);
  });
});

describe("앱 액션", () => {
  it("navigate / toast 2종만 존재한다 (구 액션 47종 은퇴)", () => {
    expect(Object.keys(APP_ACTIONS)).toEqual(["navigate", "toast"]);
  });
});

describe("InteractionRule 판별", () => {
  it("신규 entry 를 통과시킨다", () => {
    expect(
      isInteractionRule({
        id: "r1",
        type: "interaction",
        elementId: "el-1",
        trigger: "onPress",
        action: { kind: "navigate", params: { path: "/home" } },
      }),
    ).toBe(true);
  });

  it("구 SerializedEvent entry 를 배제한다 (Phase 4 잔존 데이터 방어)", () => {
    expect(
      isInteractionRule({
        id: "e1",
        type: "event",
        kind: "onClick",
        target: "el-1",
        actionRef: "a1",
      }),
    ).toBe(false);
  });

  it("비객체를 배제한다", () => {
    expect(isInteractionRule(null)).toBe(false);
    expect(isInteractionRule("onPress")).toBe(false);
  });
});
