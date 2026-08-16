// @vitest-environment node
/**
 * ADR-158 Phase 4 — 축소된 이벤트 어휘 고정.
 *
 * 구 24종에는 **DOM 별칭 10종**(onClick / onMouseEnter / onKeyDown …)과 **비RAC·
 * 미구현 3종**(onScroll / onResize / onLoad)이 섞여 있었다. 이름이 RAC callback
 * 처럼 생겨서 되돌아오기 쉬운 어휘라, 남은 11종을 정확 집합으로 못 박는다.
 *
 * 트리거 어휘의 정본은 **여기가 아니다** — 인터랙션 규칙은
 * `CAPABILITY_REGISTRY[type].events` 를 쓴다(컴포넌트마다 노출 가능한 callback 이
 * 다르므로). 본 registry 는 컴포넌트를 가리지 않는 평면 목록이고, 현재 유일한
 * 소비자는 `ItemsManager` 의 `event-id` 드롭다운이다.
 */
import { describe, expect, it } from "vitest";

import { EVENT_REGISTRY, isEventType } from "../events.registry";

/** RAC 레퍼런스에 실존하는 callback (breakdown §0 표 ② "유지 후보 11"). */
const KEPT = [
  "onChange",
  "onSubmit",
  "onFocus",
  "onBlur",
  "onPress",
  "onSelectionChange",
  "onAction",
  "onOpenChange",
  "onChangeEnd",
  "onExpandedChange",
  "onRemove",
] as const;

/** DOM 별칭 10 + 비RAC·미구현 3. */
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
] as const;

describe("EVENT_REGISTRY 어휘 (ADR-158 Phase 4)", () => {
  it("RAC 실존 11종만 남는다", () => {
    expect(Object.keys(EVENT_REGISTRY).sort()).toEqual([...KEPT].sort());
  });

  it("은퇴 13종은 되돌아오지 않는다", () => {
    const revived = RETIRED.filter((k) => k in EVENT_REGISTRY);
    expect(
      revived,
      "DOM 별칭·비RAC 어휘가 재도입됐다 — 트리거 정본은 " +
        "`CAPABILITY_REGISTRY[type].events` 이고 본 registry 는 `event-id` " +
        "드롭다운 전용이다.",
    ).toEqual([]);
  });

  it("모든 항목이 레이블을 갖는다 (드롭다운 표기 소스)", () => {
    for (const [key, def] of Object.entries(EVENT_REGISTRY)) {
      expect(def.label, `${key} 레이블 누락`).toBeTruthy();
    }
  });

  it("타입 가드가 축소된 집합을 따른다", () => {
    expect(isEventType("onPress")).toBe(true);
    expect(isEventType("onClick")).toBe(false);
  });
});
