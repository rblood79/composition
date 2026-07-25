/**
 * @fileoverview ADR-158 Phase 2 — `useInteractionRulesForElement` 스냅샷 안정성 계약.
 *
 * `useSyncExternalStore` 는 상태가 그대로면 `getSnapshot` 이 **동일 reference** 를
 * 돌려주기를 요구한다. filter 결과를 매번 새로 만들면 렌더 → 변경 감지 → 재렌더
 * 무한 루프가 되어 React 가 트리를 버린다 (화면 백지).
 *
 * **회귀 배경 (2026-07-25)**: 규칙 0개 구간은 frozen 빈 배열이라 안전했고 첫 규칙을
 * 추가하는 순간(0→1)에만 재현됐다. 구 `useEventsForTarget` 도 같은 결함이었으나
 * production 소비자가 0개라 드러난 적이 없었다.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { CompositionDocument, InteractionRule } from "@composition/shared";

import { useCanonicalDocumentStore } from "../canonicalDocumentStore";
import { useInteractionRulesForElement } from "../canonicalElementsBridge";
import { writeInteractionRulesToRootCollection } from "../rootCollectionInteractionsWrite";

const rule = (id: string, elementId: string): InteractionRule => ({
  id,
  type: "interaction",
  elementId,
  trigger: "onPress",
  action: { kind: "navigate", params: { path: "/home" } },
});

function makeDoc(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      { id: "btn-1", type: "Button", props: {} },
      { id: "btn-2", type: "Button", props: {} },
    ],
  };
}

describe("ADR-158 — useInteractionRulesForElement 스냅샷 계약", () => {
  beforeEach(() => {
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", makeDoc());
    store.setCurrentProject("p");
  });

  it("규칙이 있을 때 재렌더가 무한 루프로 가지 않는다 (동일 reference)", () => {
    writeInteractionRulesToRootCollection("btn-1", [rule("r1", "btn-1")]);

    const { result, rerender } = renderHook(() =>
      useInteractionRulesForElement("btn-1"),
    );
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
    expect(first).toHaveLength(1);
  });

  it("규칙이 없을 때도 동일 reference", () => {
    const { result, rerender } = renderHook(() =>
      useInteractionRulesForElement("btn-1"),
    );
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
    expect(first).toEqual([]);
  });

  it("0 → 1 전환에서 새 결과를 낸다 (캐시가 갱신을 막지 않는다)", () => {
    const { result, rerender } = renderHook(() =>
      useInteractionRulesForElement("btn-1"),
    );
    expect(result.current).toHaveLength(0);

    writeInteractionRulesToRootCollection("btn-1", [rule("r1", "btn-1")]);
    rerender();

    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe("r1");
  });

  it("다른 element 의 규칙 변경은 이 element 의 결과를 바꾸지 않는다", () => {
    writeInteractionRulesToRootCollection("btn-1", [rule("r1", "btn-1")]);

    const { result, rerender } = renderHook(() =>
      useInteractionRulesForElement("btn-1"),
    );
    const first = result.current;

    writeInteractionRulesToRootCollection("btn-2", [rule("r2", "btn-2")]);
    rerender();

    // source 배열이 바뀌었으므로 재계산되지만 내용은 동일해야 한다
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe("r1");
    expect(first[0].id).toBe("r1");
  });

  it("element 두 개를 번갈아 구독해도 서로의 캐시를 무너뜨리지 않는다", () => {
    writeInteractionRulesToRootCollection("btn-1", [rule("r1", "btn-1")]);
    writeInteractionRulesToRootCollection("btn-2", [rule("r2", "btn-2")]);

    const a = renderHook(() => useInteractionRulesForElement("btn-1"));
    const b = renderHook(() => useInteractionRulesForElement("btn-2"));
    const aFirst = a.result.current;
    const bFirst = b.result.current;

    a.rerender();
    b.rerender();

    expect(a.result.current).toBe(aFirst);
    expect(b.result.current).toBe(bFirst);
    expect(a.result.current[0].id).toBe("r1");
    expect(b.result.current[0].id).toBe("r2");
  });
});
