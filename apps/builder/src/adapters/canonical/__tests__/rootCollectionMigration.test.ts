/**
 * @fileoverview ADR-131 Phase 2 G2 — rootCollectionMigration round-trip 검증.
 */

import { describe, expect, it } from "vitest";
import type {
  CompositionDocument,
  SerializedAction,
  SerializedData,
  SerializedEvent,
} from "@composition/shared";
import type {
  DataBinding,
  Element,
} from "../../../types/builder/unified.types";
import {
  mergeIntoDocument,
  migrateLegacyDataBindingToRootData,
  migrateLegacyElementsToRootCollections,
  migrateLegacyEventsToRootEvents,
  rootDataToLegacyByElement,
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

  describe("migrateLegacyDataBindingToRootData", () => {
    it("returns undefined when binding undefined or null", () => {
      expect(
        migrateLegacyDataBindingToRootData("el-1", undefined),
      ).toBeUndefined();
      expect(migrateLegacyDataBindingToRootData("el-1", null)).toBeUndefined();
    });

    it("generates id with db_ prefix + element id", () => {
      const result = migrateLegacyDataBindingToRootData("listbox-1", {
        type: "collection",
        source: "supabase",
        config: { table: "users" },
      });

      expect(result).toEqual<SerializedData>({
        id: "db_listbox-1",
        type: "data",
        kind: "collection",
        source: "supabase",
        config: { table: "users" },
      });
    });
  });

  describe("migrateLegacyElementsToRootCollections", () => {
    it("aggregates events / data / actions across elements", () => {
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
          id: "listbox-1",
          type: "ListBox",
          props: {},
          dataBinding: {
            type: "collection",
            source: "api",
            config: { endpoint: "/items" },
          },
        },
        {
          id: "plain-1",
          type: "Frame",
          props: {},
        },
      ];

      const result = migrateLegacyElementsToRootCollections(elements);
      expect(result.events).toHaveLength(1);
      expect(result.data).toHaveLength(1);
      expect(result.actions).toHaveLength(1);
      expect(result.events[0].target).toBe("btn-1");
      expect(result.data[0].id).toBe("db_listbox-1");
    });

    it("yields empty result when no element has events/dataBinding", () => {
      const elements: Element[] = [
        { id: "p1", type: "Frame", props: {} },
        { id: "p2", type: "Text", props: { text: "hi" } },
      ];
      const result = migrateLegacyElementsToRootCollections(elements);
      expect(result).toEqual({ events: [], data: [], actions: [] });
    });
  });

  describe("mergeIntoDocument", () => {
    const baseDoc: CompositionDocument = {
      version: "composition-1.0",
      children: [],
    };

    it("yields no events/data/actions keys when nothing to merge", () => {
      const result = mergeIntoDocument(baseDoc, {});
      expect(result.events).toBeUndefined();
      expect(result.data).toBeUndefined();
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

    it("dedupes by id (new wins last position-wise but earlier seen wins)", () => {
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
      // 첫 dedupe — existing ev1 보존, 새 ev1 drop
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

    it("preserves dataBinding by element id", () => {
      const original: DataBinding = {
        type: "collection",
        source: "supabase",
        config: { table: "users" },
      };
      const forward = migrateLegacyDataBindingToRootData("listbox-1", original);
      expect(forward).toBeDefined();
      const backByElement = rootDataToLegacyByElement([forward!]);
      expect(backByElement.get("listbox-1")).toEqual(original);
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
      // visited set 로 cycle 차단 — a1 / a2 1번씩만 등장
      expect(restored).toHaveLength(2);
      expect(restored?.map((a) => a.id)).toEqual(["a1", "a2"]);
    });
  });
});
