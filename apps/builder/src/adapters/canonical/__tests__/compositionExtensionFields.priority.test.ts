/**
 * builder wrapper 의 **기본 read priority 고정** 계약.
 *
 * `apps/builder` 와 `packages/shared` 는 같은 read-through 로직을 쓰되 **기본
 * priority 가 다르다** — builder = `props-first`, shared = `legacy-first`
 * (ADR-116 breakdown §10.2.4 의 영역별 명시 결정). 종전에는 그 차이 때문에
 * 우선순위 로직 본문이 두 벌이었고, 본 테스트는 본문을 shared 로 일원화한 뒤
 * **builder 쪽 기본값이 그대로 유지되는지**를 못 박는다.
 *
 * **Why 이 테스트가 필요한가 (증상이 조용하다)**: 두 저장 위치 중 하나만 가진
 * 요소에서는 두 기본값이 같은 결과를 낸다. 발산은 `props.*` 와 `element.*` 가
 * **둘 다 있는** legacy 요소에서만 드러나므로 type-check 도 기존 테스트도
 * 잡지 못한다. wrapper 가 `legacy-first` 로 넘어가면 ADR-149 Phase 3-c 가
 * 확정한 undo 정합이 깨진다 — canonical root 에 undo 통합이 없어
 * `props.events` 가 undo-정합 read source 이고, `canvasDeltaMessenger` 의
 * Preview delta 가 그 값을 싣는다.
 */
import { describe, expect, it } from "vitest";

import {
  getElementDataBinding,
  getElementEvents,
} from "../compositionExtensionFields";
import {
  getElementEvents as sharedGetElementEvents,
  getElementDataBinding as sharedGetElementDataBinding,
} from "@composition/shared";

/** 두 저장 위치를 **동시에** 가진 요소 — 기본값 차이가 드러나는 유일한 형태. */
const bothEvents = {
  props: { events: [{ id: "from-props" }] },
  events: [{ id: "from-legacy" }],
};

const bothBindings = {
  props: { dataBinding: { type: "collection", source: "from-props" } },
  dataBinding: { type: "collection", source: "from-legacy" },
};

describe("builder wrapper — 기본 priority 는 props-first 로 고정", () => {
  it("getElementEvents 는 props.events 를 먼저 읽는다", () => {
    expect(getElementEvents(bothEvents)).toEqual([{ id: "from-props" }]);
  });

  it("getElementDataBinding 은 props.dataBinding 을 먼저 읽는다", () => {
    expect(getElementDataBinding(bothBindings)).toEqual({
      type: "collection",
      source: "from-props",
    });
  });

  it("shared 기본값(legacy-first)과 반대여야 한다 — 두 영역이 갈린 것이 설계다", () => {
    // 이 단언이 깨지면 둘 중 하나다: shared 기본값이 바뀌었거나(영역 계약 변경),
    // wrapper 가 기본값 고정을 잃었거나(회귀). 어느 쪽이든 §10.2.4 재판정 대상.
    expect(sharedGetElementEvents(bothEvents)).toEqual([{ id: "from-legacy" }]);
    expect(sharedGetElementDataBinding(bothBindings)).toEqual({
      type: "collection",
      source: "from-legacy",
    });
  });
});

describe("wrapper 는 shared 로직을 그대로 위임한다", () => {
  it("legacy-only 는 props 를 무시한다", () => {
    expect(getElementDataBinding(bothBindings, "legacy-only")).toEqual({
      type: "collection",
      source: "from-legacy",
    });
    expect(
      getElementDataBinding(
        { props: { dataBinding: { source: "p" } } },
        "legacy-only",
      ),
    ).toBeUndefined();
  });

  it("legacy-first 를 명시하면 element 쪽이 이긴다", () => {
    expect(getElementDataBinding(bothBindings, "legacy-first")).toEqual({
      type: "collection",
      source: "from-legacy",
    });
  });

  it("한쪽만 있으면 기본값과 무관하게 같은 값 — 이 형태가 결함을 가린다", () => {
    const propsOnly = { props: { events: [{ id: "only" }] } };
    const legacyOnly = { events: [{ id: "only" }] };
    expect(getElementEvents(propsOnly)).toEqual([{ id: "only" }]);
    expect(getElementEvents(legacyOnly)).toEqual([{ id: "only" }]);
    expect(sharedGetElementEvents(propsOnly)).toEqual([{ id: "only" }]);
    expect(sharedGetElementEvents(legacyOnly)).toEqual([{ id: "only" }]);
  });

  it("미지정은 빈 배열 / undefined", () => {
    expect(getElementEvents({ id: "none" } as never)).toEqual([]);
    expect(getElementDataBinding({ id: "none" } as never)).toBeUndefined();
  });
});
