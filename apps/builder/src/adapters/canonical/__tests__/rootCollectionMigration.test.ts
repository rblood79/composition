/**
 * @fileoverview ADR-131 Phase 2 G2 — rootCollectionMigration round-trip 검증.
 *
 * **ADR-131 Phase 8 (2026-05-13)**: data 영역 test 제거 — data SSOT 는
 * `collections` / `api_endpoints` / `variables` (별 store). events / actions
 * round-trip 만 보존.
 */

import { describe, expect, it } from "vitest";
import type {
  CompositionDocument,
  SerializedAction,
  SerializedEvent,
} from "@composition/shared";
import type { Element } from "../../../types/builder/unified.types";
import type { LegacyRootCollectionDocument } from "../rootCollectionMigration";
import {
  mergeIntoDocument,
  migrateLegacyElementsToRootCollections,
  migrateLegacyEventsToRootEvents,
  migrateRootCollectionToLegacy,
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
    const baseDoc: LegacyRootCollectionDocument = {
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
      const docWithEvents: LegacyRootCollectionDocument = {
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

  // ADR-149 Phase 3-a — 역방향 adapter (HC5)
  describe("migrateRootCollectionToLegacy (reverse, ADR-149 Phase 3-a)", () => {
    it("returns empty when no events for target", () => {
      expect(
        migrateRootCollectionToLegacy("btn-1", undefined, undefined),
      ).toEqual([]);
      expect(
        migrateRootCollectionToLegacy(
          "btn-1",
          [{ id: "ev1", type: "event", kind: "onPress", target: "other" }],
          [],
        ),
      ).toEqual([]);
    });

    it("filters events by target and restores action chain", () => {
      const events: SerializedEvent[] = [
        {
          id: "ev1",
          type: "event",
          kind: "onPress",
          target: "btn-1",
          actionRef: "a1",
        },
        { id: "ev2", type: "event", kind: "onClick", target: "btn-2" },
      ];
      const actions: SerializedAction[] = [
        {
          id: "a1",
          type: "action",
          kind: "navigate",
          config: { path: "/x" },
          next: ["a2"],
        },
        { id: "a2", type: "action", kind: "showToast" },
      ];
      const legacy = migrateRootCollectionToLegacy("btn-1", events, actions);
      expect(legacy).toHaveLength(1);
      expect(legacy[0]).toMatchObject({ id: "ev1", event: "onPress" });
      expect(legacy[0].actions?.map((a) => a.id)).toEqual(["a1", "a2"]);
      expect(legacy[0].actions?.[0]).toMatchObject({
        type: "navigate",
        config: { path: "/x" },
      });
    });

    it("restores condition {expr} → string and fallbackActionRef → elseActions", () => {
      const legacy = migrateRootCollectionToLegacy(
        "btn-1",
        [
          {
            id: "ev1",
            type: "event",
            kind: "onPress",
            target: "btn-1",
            actionRef: "a1",
            fallbackActionRef: "e1",
            condition: { expr: "user.isLoggedIn" },
          },
        ],
        [
          { id: "a1", type: "action", kind: "navigate" },
          { id: "e1", type: "action", kind: "showToast" },
        ],
      );
      expect(legacy[0].condition).toBe("user.isLoggedIn");
      expect(legacy[0].elseActions?.map((a) => a.id)).toEqual(["e1"]);
    });

    it("guards action next[] cycle (visited set)", () => {
      const legacy = migrateRootCollectionToLegacy(
        "btn-1",
        [
          {
            id: "ev1",
            type: "event",
            kind: "onPress",
            target: "btn-1",
            actionRef: "a1",
          },
        ],
        [
          { id: "a1", type: "action", kind: "navigate", next: ["a2"] },
          { id: "a2", type: "action", kind: "showToast", next: ["a1"] },
        ],
      );
      // a1 → a2 → (a1 already visited, stop)
      expect(legacy[0].actions?.map((a) => a.id)).toEqual(["a1", "a2"]);
    });
  });

  // ADR-149 Phase 3-a — round-trip 동등성 (HC5): legacy → forward → reverse → legacy
  describe("round-trip 동등성 (legacy ↔ canonical)", () => {
    function roundTrip(
      target: string,
      legacy: Parameters<typeof migrateLegacyEventsToRootEvents>[1],
    ) {
      const fwd = migrateLegacyEventsToRootEvents(target, legacy);
      return migrateRootCollectionToLegacy(target, fwd.events, fwd.actions);
    }

    it("identity for single event + single action (explicit ids)", () => {
      const legacy = [
        {
          id: "ev1",
          event: "onPress",
          actions: [{ id: "a1", type: "navigate", config: { path: "/home" } }],
        },
      ];
      expect(roundTrip("btn-1", legacy)).toEqual(legacy);
    });

    it("identity preserving fidelity fields (enabled/debounce/throttle/delay)", () => {
      const legacy = [
        {
          id: "ev1",
          event: "onChange",
          enabled: false,
          debounce: 300,
          actions: [
            {
              id: "a1",
              type: "apiCall",
              config: { endpoint: "/api" },
              delay: 100,
              enabled: true,
            },
          ],
        },
        {
          id: "ev2",
          event: "onPress",
          throttle: 500,
          condition: "state.ready === true",
          actions: [{ id: "a2", type: "showToast", config: {} }],
          elseActions: [{ id: "e2", type: "logEvent", config: {} }],
        },
      ];
      expect(roundTrip("btn-1", legacy)).toEqual(legacy);
    });

    it("multi-action chain identity", () => {
      const legacy = [
        {
          id: "ev1",
          event: "onPress",
          actions: [
            { id: "a1", type: "navigate", config: { path: "/a" } },
            { id: "a2", type: "showToast", config: { message: "hi" } },
            { id: "a3", type: "logEvent", config: {} },
          ],
        },
      ];
      expect(roundTrip("btn-1", legacy)).toEqual(legacy);
    });
  });
});
