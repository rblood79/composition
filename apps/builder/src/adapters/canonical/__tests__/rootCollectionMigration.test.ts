/**
 * @fileoverview ADR-131 Phase 2 G2 — rootCollectionMigration round-trip 검증.
 *
 * **ADR-131 Phase 8 (2026-05-13)**: data 영역 test 제거 — data SSOT 는
 * `data_tables` / `api_endpoints` / `variables` (별 store). events / actions
 * round-trip 만 보존.
 */

import { describe, expect, it } from "vitest";
import type {
  CompositionDocument,
  SerializedAction,
  SerializedEvent,
} from "@composition/shared";
import type { Element } from "../../../types/builder/unified.types";
import {
  mergeIntoDocument,
  migrateLegacyElementsToRootCollections,
  migrateLegacyEventsToRootEvents,
  rootEventsToLegacyByTarget,
} from "../rootCollectionMigration";

describe("ADR-131 Phase 2 — rootCollectionMigration", () => {
  describe("migrateLegacyEventsToRootEvents", () => {
    it("returns empty result when legacy events undefined or empty", () => {
      expect(migrateLegacyEventsToRootEvents("el-1", undefined)).toEqual({
        events: [],
        actions: [],
      });
      expect(migrateLegacyEventsToRootEvents("el-1", [])).toEqual({
        events: [],
        actions: [],
      });
    });

    it("converts single EventHandler with single action to event + chain head", () => {
      const result = migrateLegacyEventsToRootEvents("btn-1", [
        {
          id: "ev1",
          event: "onPress",
          actions: [{ id: "a1", type: "navigate", config: { path: "/home" } }],
        },
      ]);

      expect(result.events).toEqual<SerializedEvent[]>([
        {
          id: "ev1",
          type: "event",
          kind: "onPress",
          target: "btn-1",
          actionRef: "a1",
        },
      ]);
      expect(result.actions).toEqual<SerializedAction[]>([
        {
          id: "a1",
          type: "action",
          kind: "navigate",
          config: { path: "/home" },
        },
      ]);
    });

    it("chains multiple actions via next[]", () => {
      const result = migrateLegacyEventsToRootEvents("btn-1", [
        {
          id: "ev1",
          event: "onPress",
          actions: [
            { id: "a1", type: "navigate" },
            { id: "a2", type: "showToast" },
            { id: "a3", type: "logEvent" },
          ],
        },
      ]);

      expect(result.events[0].actionRef).toBe("a1");
      expect(result.actions[0].next).toEqual(["a2"]);
      expect(result.actions[1].next).toEqual(["a3"]);
      expect(result.actions[2].next).toBeUndefined();
    });

    it("auto-generates action id when missing", () => {
      const result = migrateLegacyEventsToRootEvents("btn-1", [
        {
          id: "ev1",
          event: "onPress",
          actions: [{ type: "navigate" }, { type: "showToast" }],
        },
      ]);

      expect(result.actions[0].id).toBe("ev1__a0");
      expect(result.actions[1].id).toBe("ev1__a1");
      expect(result.events[0].actionRef).toBe("ev1__a0");
      expect(result.actions[0].next).toEqual(["ev1__a1"]);
    });

    it("converts elseActions to separate chain via fallbackActionRef", () => {
      const result = migrateLegacyEventsToRootEvents("btn-1", [
        {
          id: "ev1",
          event: "onPress",
          actions: [{ id: "a1", type: "navigate" }],
          elseActions: [{ id: "e1", type: "showToast" }],
        },
      ]);

      expect(result.events[0]).toMatchObject({
        actionRef: "a1",
        fallbackActionRef: "e1",
      });
      expect(result.actions.map((a) => a.id)).toEqual(["a1", "e1"]);
    });

    it("preserves condition as object placeholder", () => {
      const fromString = migrateLegacyEventsToRootEvents("btn-1", [
        { id: "ev1", event: "onPress", condition: "user.isLoggedIn" },
      ]);
      expect(fromString.events[0].condition).toEqual({
        expr: "user.isLoggedIn",
      });

      const fromObject = migrateLegacyEventsToRootEvents("btn-1", [
        {
          id: "ev2",
          event: "onPress",
          condition: { custom: "logic" },
        },
      ]);
      expect(fromObject.events[0].condition).toEqual({ custom: "logic" });
    });
  });

  describe("migrateLegacyElementsToRootCollections", () => {
    it("aggregates events / actions across elements", () => {
      const elements: Element[] = [
        {
          id: "btn-1",
          type: "Button",
          props: { label: "Click" },
          events: [
            {
              id: "ev1",
              event: "onPress",
              actions: [{ id: "a1", type: "navigate" }],
            },
          ],
        },
        {
          id: "plain-1",
          type: "Frame",
          props: {},
        },
      ];

      const result = migrateLegacyElementsToRootCollections(elements);
      expect(result.events).toHaveLength(1);
      expect(result.actions).toHaveLength(1);
      expect(result.events[0].target).toBe("btn-1");
    });

    it("yields empty result when no element has events", () => {
      const elements: Element[] = [
        { id: "p1", type: "Frame", props: {} },
        { id: "p2", type: "Text", props: { text: "hi" } },
      ];
      const result = migrateLegacyElementsToRootCollections(elements);
      expect(result).toEqual({ events: [], actions: [] });
    });
  });

  describe("mergeIntoDocument", () => {
    const baseDoc: CompositionDocument = {
      version: "composition-1.0",
      children: [],
    };

    it("yields no events/actions keys when nothing to merge", () => {
      const result = mergeIntoDocument(baseDoc, {});
      expect(result.events).toBeUndefined();
      expect(result.actions).toBeUndefined();
    });

    it("merges new collections without modifying base", () => {
      const result = mergeIntoDocument(baseDoc, {
        events: [
          { id: "ev1", type: "event", kind: "onPress", target: "btn-1" },
        ],
      });
      expect(result.events).toHaveLength(1);
      expect(baseDoc.events).toBeUndefined();
    });

    it("dedupes by id (first wins)", () => {
      const docWithEvents: CompositionDocument = {
        ...baseDoc,
        events: [
          { id: "ev1", type: "event", kind: "onPress", target: "btn-1" },
        ],
      };
      const result = mergeIntoDocument(docWithEvents, {
        events: [
          { id: "ev1", type: "event", kind: "onClick", target: "btn-2" },
          { id: "ev2", type: "event", kind: "onChange", target: "input-1" },
        ],
      });
      expect(result.events).toHaveLength(2);
      expect(result.events?.find((e) => e.id === "ev1")?.kind).toBe("onPress");
      expect(result.events?.find((e) => e.id === "ev2")).toBeDefined();
    });
  });

  describe("round-trip — legacy → root → legacy", () => {
    it("preserves event handler + chain action structure", () => {
      const originalEvents = [
        {
          id: "ev1",
          event: "onPress",
          actions: [
            { id: "a1", type: "navigate", config: { path: "/home" } },
            { id: "a2", type: "showToast", config: { message: "Hi" } },
          ],
          elseActions: [{ id: "e1", type: "logError" }],
        },
      ];

      const forward = migrateLegacyEventsToRootEvents("btn-1", originalEvents);
      const backByTarget = rootEventsToLegacyByTarget(
        forward.events,
        forward.actions,
      );

      const restored = backByTarget.get("btn-1");
      expect(restored).toHaveLength(1);
      expect(restored?.[0]).toMatchObject({
        id: "ev1",
        event: "onPress",
      });
      expect(restored?.[0].actions).toEqual([
        { id: "a1", type: "navigate", config: { path: "/home" } },
        { id: "a2", type: "showToast", config: { message: "Hi" } },
      ]);
      expect(restored?.[0].elseActions).toEqual([
        { id: "e1", type: "logError" },
      ]);
    });

    it("groups multiple events by their target element id", () => {
      const e1 = migrateLegacyEventsToRootEvents("btn-1", [
        { id: "ev1", event: "onPress" },
      ]);
      const e2 = migrateLegacyEventsToRootEvents("btn-2", [
        { id: "ev2", event: "onClick" },
      ]);
      const allEvents = [...e1.events, ...e2.events];
      const grouped = rootEventsToLegacyByTarget(allEvents, []);
      expect(grouped.get("btn-1")?.[0].id).toBe("ev1");
      expect(grouped.get("btn-2")?.[0].id).toBe("ev2");
    });

    it("breaks chain cycle gracefully (DAG safety)", () => {
      const actions: SerializedAction[] = [
        { id: "a1", type: "action", kind: "navigate", next: ["a2"] },
        { id: "a2", type: "action", kind: "showToast", next: ["a1"] }, // cycle
      ];
      const events: SerializedEvent[] = [
        {
          id: "ev1",
          type: "event",
          kind: "onPress",
          target: "btn-1",
          actionRef: "a1",
        },
      ];
      const result = rootEventsToLegacyByTarget(events, actions);
      const restored = result.get("btn-1")?.[0].actions;
      expect(restored).toHaveLength(2);
      expect(restored?.map((a) => a.id)).toEqual(["a1", "a2"]);
    });
  });
});
