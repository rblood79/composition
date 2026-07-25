/**
 * @fileoverview ADR-158 Phase 1 — writeInteractionRulesToRootCollection unit tests.
 *
 * canonical `events` root collection clean-slate replace 계약 검증.
 * 구 ADR-149 테스트(`rootCollectionEventsWrite.test.ts`)를 계승하되 entry 스키마가
 * `SerializedEvent` + `actions` chain 에서 `InteractionRule` 로 교체됐다 —
 * `actions` root collection 은 더 이상 파생되지 않는다 (dormant).
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument, InteractionRule } from "@composition/shared";
import { useCanonicalDocumentStore } from "../canonicalDocumentStore";
import { writeInteractionRulesToRootCollection } from "../rootCollectionInteractionsWrite";

describe("ADR-158 Phase 1 — writeInteractionRulesToRootCollection", () => {
  function makeDoc(): CompositionDocument {
    return {
      version: "composition-1.0",
      children: [
        { id: "btn-1", type: "Button", props: { label: "A" } },
        { id: "btn-2", type: "Button", props: { label: "B" } },
      ],
    };
  }

  beforeEach(() => {
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
  });

  function setupActiveDoc() {
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", makeDoc());
    store.setCurrentProject("p");
  }

  function getDoc() {
    return useCanonicalDocumentStore.getState().getDocument("p")!;
  }

  const pressNavigate = (
    id: string,
    elementId: string,
    path: string,
  ): InteractionRule => ({
    id,
    type: "interaction",
    elementId,
    trigger: "onPress",
    action: { kind: "navigate", params: { path } },
  });

  it("대상 element 의 규칙을 root collection 에 반영", () => {
    setupActiveDoc();
    writeInteractionRulesToRootCollection("btn-1", [
      pressNavigate("r1", "btn-1", "/home"),
    ]);

    const doc = getDoc();
    expect(doc.events).toHaveLength(1);
    expect(doc.events?.[0]).toMatchObject({
      id: "r1",
      type: "interaction",
      elementId: "btn-1",
      trigger: "onPress",
      action: { kind: "navigate", params: { path: "/home" } },
    });
  });

  it("actions root collection 은 파생하지 않는다 (ADR-158 — action 은 entry 인라인)", () => {
    setupActiveDoc();
    writeInteractionRulesToRootCollection("btn-1", [
      pressNavigate("r1", "btn-1", "/home"),
    ]);

    expect(getDoc().actions).toBeUndefined();
  });

  it("clean-slate: 재-write 시 이전 규칙 대체(append 아님)", () => {
    setupActiveDoc();
    writeInteractionRulesToRootCollection("btn-1", [
      pressNavigate("r1", "btn-1", "/home"),
    ]);
    writeInteractionRulesToRootCollection("btn-1", [
      pressNavigate("r2", "btn-1", "/about"),
    ]);

    const doc = getDoc();
    expect(doc.events).toHaveLength(1);
    expect(doc.events?.[0].id).toBe("r2");
  });

  it("다른 element 의 규칙은 보존", () => {
    setupActiveDoc();
    writeInteractionRulesToRootCollection("btn-1", [
      pressNavigate("r1", "btn-1", "/home"),
    ]);
    writeInteractionRulesToRootCollection("btn-2", [
      pressNavigate("r2", "btn-2", "/about"),
    ]);
    // btn-1 재-write — btn-2 는 무영향이어야 함
    writeInteractionRulesToRootCollection("btn-1", [
      pressNavigate("r3", "btn-1", "/x"),
    ]);

    const doc = getDoc();
    expect(doc.events?.map((r) => r.id).sort()).toEqual(["r2", "r3"]);
    expect(doc.events?.find((r) => r.elementId === "btn-2")?.id).toBe("r2");
  });

  it("빈 배열 → 해당 element entry 제거, 타 element 보존", () => {
    setupActiveDoc();
    writeInteractionRulesToRootCollection("btn-1", [
      pressNavigate("r1", "btn-1", "/home"),
    ]);
    writeInteractionRulesToRootCollection("btn-2", [
      pressNavigate("r2", "btn-2", "/about"),
    ]);
    writeInteractionRulesToRootCollection("btn-1", []);

    expect(getDoc().events?.map((r) => r.id)).toEqual(["r2"]);
  });

  it("모든 규칙 제거 시 root field 는 undefined", () => {
    setupActiveDoc();
    writeInteractionRulesToRootCollection("btn-1", [
      pressNavigate("r1", "btn-1", "/home"),
    ]);
    writeInteractionRulesToRootCollection("btn-1", []);

    expect(getDoc().events).toBeUndefined();
  });

  it("capability 규칙도 동일 계약으로 저장된다", () => {
    setupActiveDoc();
    const rule: InteractionRule = {
      id: "r1",
      type: "interaction",
      elementId: "btn-1",
      trigger: "onPress",
      action: {
        kind: "capability",
        targetId: "modal-1",
        capability: "open",
      },
    };
    writeInteractionRulesToRootCollection("btn-1", [rule]);

    expect(getDoc().events?.[0]).toMatchObject({
      action: { kind: "capability", targetId: "modal-1", capability: "open" },
    });
  });

  it("활성 project 없으면 no-op (throw 없음)", () => {
    expect(() =>
      writeInteractionRulesToRootCollection("btn-1", [
        pressNavigate("r1", "btn-1", "/home"),
      ]),
    ).not.toThrow();
  });
});
