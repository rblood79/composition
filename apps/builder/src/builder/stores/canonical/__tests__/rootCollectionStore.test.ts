/**
 * @fileoverview ADR-131 Phase 3 — Root collection store mutation tests.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type {
  CompositionDocument,
  SerializedAction,
  SerializedEvent,
} from "@composition/shared";
import { useCanonicalDocumentStore } from "../canonicalDocumentStore";

describe("ADR-131 Phase 3 — canonicalDocumentStore root collection mutations", () => {
  function makeDoc(): CompositionDocument {
    return {
      version: "composition-1.0",
      children: [
        {
          id: "btn-1",
          type: "Button",
          props: { label: "Click" },
        },
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

  describe("events collection", () => {
    it("addEvent appends new event", () => {
      setupActiveDoc();
      const ev: SerializedEvent = {
        id: "ev1",
        type: "event",
        kind: "onPress",
        target: "btn-1",
      };
      useCanonicalDocumentStore.getState().addEvent(ev);

      const doc = useCanonicalDocumentStore.getState().getDocument("p")!;
      expect(doc.events).toEqual([ev]);
    });

    it("addEvent skips duplicate id", () => {
      setupActiveDoc();
      const ev: SerializedEvent = {
        id: "ev1",
        type: "event",
        kind: "onPress",
        target: "btn-1",
      };
      const store = useCanonicalDocumentStore.getState();
      store.addEvent(ev);
      store.addEvent({ ...ev, kind: "onClick" });

      const doc = useCanonicalDocumentStore.getState().getDocument("p")!;
      expect(doc.events).toHaveLength(1);
      expect(doc.events?.[0].kind).toBe("onPress");
    });

    it("updateEvent patches and ignores id/type changes", () => {
      setupActiveDoc();
      const store = useCanonicalDocumentStore.getState();
      store.addEvent({
        id: "ev1",
        type: "event",
        kind: "onPress",
        target: "btn-1",
      });
      store.updateEvent("ev1", {
        kind: "onClick",
        actionRef: "a1",
        // structural invariant — should be ignored
        id: "EVIL",
        type: "event",
      });

      const doc = useCanonicalDocumentStore.getState().getDocument("p")!;
      expect(doc.events?.[0]).toMatchObject({
        id: "ev1",
        kind: "onClick",
        actionRef: "a1",
      });
    });

    it("updateEvent no-op when id not found", () => {
      setupActiveDoc();
      const before = useCanonicalDocumentStore.getState().documentVersion;
      useCanonicalDocumentStore.getState().updateEvent("missing", {
        kind: "onClick",
      });
      const after = useCanonicalDocumentStore.getState().documentVersion;
      expect(after).toBe(before);
    });

    it("removeEvent deletes entry", () => {
      setupActiveDoc();
      const store = useCanonicalDocumentStore.getState();
      store.addEvent({
        id: "ev1",
        type: "event",
        kind: "onPress",
        target: "btn-1",
      });
      store.removeEvent("ev1");

      const doc = useCanonicalDocumentStore.getState().getDocument("p")!;
      expect(doc.events).toBeUndefined();
    });

    it("setEvents replaces collection and clears with undefined/[]", () => {
      setupActiveDoc();
      const store = useCanonicalDocumentStore.getState();
      const evs: SerializedEvent[] = [
        { id: "ev1", type: "event", kind: "onPress", target: "btn-1" },
        { id: "ev2", type: "event", kind: "onClick", target: "btn-1" },
      ];
      store.setEvents(evs);
      expect(
        useCanonicalDocumentStore.getState().getDocument("p")!.events,
      ).toHaveLength(2);

      store.setEvents([]);
      expect(
        useCanonicalDocumentStore.getState().getDocument("p")!.events,
      ).toBeUndefined();
    });
  });

  // ADR-131 Phase 8 (2026-05-13): data collection test 제거.
  // data SSOT 는 `data_tables` / `api_endpoints` / `variables`.

  describe("actions collection", () => {
    it("addAction + updateAction (next chain) + removeAction", () => {
      setupActiveDoc();
      const store = useCanonicalDocumentStore.getState();
      const a1: SerializedAction = {
        id: "a1",
        type: "action",
        kind: "navigate",
        config: { path: "/home" },
      };
      const a2: SerializedAction = {
        id: "a2",
        type: "action",
        kind: "showToast",
      };
      store.addAction(a1);
      store.addAction(a2);
      store.updateAction("a1", { next: ["a2"] });

      const doc = useCanonicalDocumentStore.getState().getDocument("p")!;
      expect(doc.actions).toHaveLength(2);
      expect(doc.actions?.[0].next).toEqual(["a2"]);

      store.removeAction("a1");
      const doc2 = useCanonicalDocumentStore.getState().getDocument("p")!;
      expect(doc2.actions).toHaveLength(1);
      expect(doc2.actions?.[0].id).toBe("a2");
    });
  });

  describe("documentVersion bumping", () => {
    it("each successful mutation increments version exactly once", () => {
      setupActiveDoc();
      const store = useCanonicalDocumentStore.getState();
      const v0 = useCanonicalDocumentStore.getState().documentVersion;

      store.addEvent({
        id: "ev1",
        type: "event",
        kind: "onPress",
        target: "btn-1",
      });
      expect(useCanonicalDocumentStore.getState().documentVersion).toBe(v0 + 1);

      store.updateEvent("ev1", { kind: "onClick" });
      expect(useCanonicalDocumentStore.getState().documentVersion).toBe(v0 + 2);

      store.removeEvent("ev1");
      expect(useCanonicalDocumentStore.getState().documentVersion).toBe(v0 + 3);
    });

    it("no-op mutations do not bump version", () => {
      setupActiveDoc();
      const before = useCanonicalDocumentStore.getState().documentVersion;
      const store = useCanonicalDocumentStore.getState();
      // 미존재 id
      store.removeEvent("missing");
      store.updateEvent("missing", { kind: "x" });
      store.removeAction("missing");
      // 빈 set → 이미 undefined 이므로 no-op
      store.setEvents(undefined);
      store.setActions(undefined);
      expect(useCanonicalDocumentStore.getState().documentVersion).toBe(before);
    });
  });

  describe("clone-on-write — original doc reference unchanged", () => {
    it("mutation produces new doc reference (Map entry replaced)", () => {
      setupActiveDoc();
      const before = useCanonicalDocumentStore.getState().getDocument("p");
      useCanonicalDocumentStore.getState().addEvent({
        id: "ev1",
        type: "event",
        kind: "onPress",
        target: "btn-1",
      });
      const after = useCanonicalDocumentStore.getState().getDocument("p");
      expect(after).not.toBe(before);
      expect(before?.events).toBeUndefined(); // 이전 doc 보존 (immutable)
    });
  });
});
