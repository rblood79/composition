/**
 * @fileoverview ADR-149 Phase 2a — writeEventsToRootCollection unit tests.
 *
 * canonical root collection(doc.events/doc.actions) clean-slate replace 계약 검증.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { useCanonicalDocumentStore } from "../canonicalDocumentStore";
import { writeEventsToRootCollection } from "../rootCollectionEventsWrite";

type LegacyHandler = {
  id: string;
  event: string;
  actions?: Array<{
    id: string;
    type: string;
    config?: Record<string, unknown>;
  }>;
};

describe("ADR-149 Phase 2a — writeEventsToRootCollection", () => {
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
    evId: string,
    aId: string,
    path: string,
  ): LegacyHandler => ({
    id: evId,
    event: "onPress",
    actions: [{ id: aId, type: "navigate", config: { path } }],
  });

  it("대상 element 의 events/actions 를 root collection 에 반영", () => {
    setupActiveDoc();
    writeEventsToRootCollection("btn-1", [pressNavigate("ev1", "a1", "/home")]);

    const doc = getDoc();
    expect(doc.events).toHaveLength(1);
    expect(doc.events?.[0]).toMatchObject({
      id: "ev1",
      type: "event",
      kind: "onPress",
      target: "btn-1",
      actionRef: "a1",
    });
    expect(doc.actions).toHaveLength(1);
    expect(doc.actions?.[0]).toMatchObject({
      id: "a1",
      type: "action",
      kind: "navigate",
    });
  });

  it("clean-slate: 재-write 시 이전 events 대체(append 아님)", () => {
    setupActiveDoc();
    writeEventsToRootCollection("btn-1", [pressNavigate("ev1", "a1", "/home")]);
    writeEventsToRootCollection("btn-1", [
      pressNavigate("ev2", "a2", "/about"),
    ]);

    const doc = getDoc();
    expect(doc.events).toHaveLength(1);
    expect(doc.events?.[0].id).toBe("ev2");
    expect(doc.actions).toHaveLength(1);
    expect(doc.actions?.[0].id).toBe("a2");
  });

  it("다른 element 의 events/actions 는 보존", () => {
    setupActiveDoc();
    writeEventsToRootCollection("btn-1", [pressNavigate("ev1", "a1", "/home")]);
    writeEventsToRootCollection("btn-2", [
      pressNavigate("ev2", "a2", "/about"),
    ]);
    // btn-1 재-write — btn-2 는 무영향이어야 함
    writeEventsToRootCollection("btn-1", [pressNavigate("ev3", "a3", "/x")]);

    const doc = getDoc();
    expect(doc.events?.map((e) => e.id).sort()).toEqual(["ev2", "ev3"]);
    expect(doc.actions?.map((a) => a.id).sort()).toEqual(["a2", "a3"]);
    expect(doc.events?.find((e) => e.target === "btn-2")?.id).toBe("ev2");
  });

  it("빈 events → 해당 element root entry 제거, 타 element 보존", () => {
    setupActiveDoc();
    writeEventsToRootCollection("btn-1", [pressNavigate("ev1", "a1", "/home")]);
    writeEventsToRootCollection("btn-2", [
      pressNavigate("ev2", "a2", "/about"),
    ]);
    writeEventsToRootCollection("btn-1", []);

    const doc = getDoc();
    expect(doc.events?.map((e) => e.id)).toEqual(["ev2"]);
    expect(doc.actions?.map((a) => a.id)).toEqual(["a2"]);
  });

  it("모든 events 제거 시 root field 는 undefined", () => {
    setupActiveDoc();
    writeEventsToRootCollection("btn-1", [pressNavigate("ev1", "a1", "/home")]);
    writeEventsToRootCollection("btn-1", []);

    const doc = getDoc();
    expect(doc.events).toBeUndefined();
    expect(doc.actions).toBeUndefined();
  });

  it("활성 project 없으면 no-op (throw 없음)", () => {
    expect(() =>
      writeEventsToRootCollection("btn-1", [
        pressNavigate("ev1", "a1", "/home"),
      ]),
    ).not.toThrow();
  });
});
