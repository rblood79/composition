/**
 * ADR-124 Phase 1 Gate G1 — `CanonicalUpdateEvent` round-trip 검증.
 *
 * undo/redo 가 prevProps ↔ nextProps 간 정확히 round-trip 되는지 검증.
 * 깊은 nested 노드 (frame 안의 frame 안의 element) 에서도 동일.
 */

import { describe, expect, it } from "vitest";

import type { CompositionDocument } from "@composition/shared";

import {
  applyCanonicalHistoryEventsToDocument,
  buildCanonicalUpdateEvent,
  getCanonicalHistoryEventIds,
} from "../canonicalHistoryEvents";

function makeDoc(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        props: { layoutType: "page" },
        children: [
          {
            id: "body-1",
            type: "frame",
            props: { background: "#fff" },
            children: [
              {
                id: "button-1",
                type: "Button",
                props: { label: "Click", variant: "primary", size: "md" },
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("buildCanonicalUpdateEvent + apply", () => {
  it("round-trip: redo applies nextProps, undo applies prevProps", () => {
    const initial = makeDoc();
    const prevProps = { label: "Click", variant: "primary", size: "md" };
    const nextProps = { label: "Submit", variant: "secondary", size: "lg" };

    const event = buildCanonicalUpdateEvent("button-1", prevProps, nextProps);

    // redo: prevProps -> nextProps
    const afterRedo = applyCanonicalHistoryEventsToDocument(
      initial,
      [event],
      "redo",
    );
    const buttonAfterRedo = (
      afterRedo.children[0].children![0].children![0] as {
        props: Record<string, unknown>;
      }
    ).props;
    expect(buttonAfterRedo).toEqual(nextProps);

    // undo: nextProps -> prevProps
    const afterUndo = applyCanonicalHistoryEventsToDocument(
      afterRedo,
      [event],
      "undo",
    );
    const buttonAfterUndo = (
      afterUndo.children[0].children![0].children![0] as {
        props: Record<string, unknown>;
      }
    ).props;
    expect(buttonAfterUndo).toEqual(prevProps);
  });

  it("redo → undo → redo: deep round-trip identity", () => {
    const initial = makeDoc();
    const prevProps = { label: "Click", size: "md" };
    const nextProps = { label: "Submit", size: "lg" };
    const event = buildCanonicalUpdateEvent("button-1", prevProps, nextProps);

    const r1 = applyCanonicalHistoryEventsToDocument(initial, [event], "redo");
    const u1 = applyCanonicalHistoryEventsToDocument(r1, [event], "undo");
    const r2 = applyCanonicalHistoryEventsToDocument(u1, [event], "redo");

    const finalProps = (
      r2.children[0].children![0].children![0] as {
        props: Record<string, unknown>;
      }
    ).props;
    expect(finalProps).toEqual(nextProps);

    const initialProps = (
      u1.children[0].children![0].children![0] as {
        props: Record<string, unknown>;
      }
    ).props;
    expect(initialProps).toEqual(prevProps);
  });

  it("missing nodeId: returns doc unchanged", () => {
    const initial = makeDoc();
    const event = buildCanonicalUpdateEvent(
      "missing-id",
      { foo: 1 },
      { foo: 2 },
    );
    const result = applyCanonicalHistoryEventsToDocument(
      initial,
      [event],
      "redo",
    );
    expect(result).toBe(initial); // identity preserved when no change
  });

  it("buildCanonicalUpdateEvent clones props (no aliasing)", () => {
    const prevProps = { label: "A" };
    const nextProps = { label: "B" };
    const event = buildCanonicalUpdateEvent("x", prevProps, nextProps);

    expect(event).toEqual({
      type: "update",
      nodeId: "x",
      prevProps: { label: "A" },
      nextProps: { label: "B" },
    });
    if (event.type !== "update") throw new Error("type narrowing failed");
    expect(event.prevProps).not.toBe(prevProps);
    expect(event.nextProps).not.toBe(nextProps);
  });

  it("getCanonicalHistoryEventIds: update event adds nodeId to upsertIds (both directions)", () => {
    const event = buildCanonicalUpdateEvent("button-1", { a: 1 }, { a: 2 });
    const redoIds = getCanonicalHistoryEventIds([event], "redo");
    const undoIds = getCanonicalHistoryEventIds([event], "undo");
    expect(redoIds.upsertIds).toEqual(["button-1"]);
    expect(redoIds.deleteIds).toEqual([]);
    expect(undoIds.upsertIds).toEqual(["button-1"]);
    expect(undoIds.deleteIds).toEqual([]);
  });

  it("multiple update events: applied in sequence", () => {
    const initial = makeDoc();
    const e1 = buildCanonicalUpdateEvent(
      "button-1",
      { label: "Click" },
      { label: "Step1" },
    );
    const e2 = buildCanonicalUpdateEvent(
      "button-1",
      { label: "Step1" },
      { label: "Step2" },
    );

    // redo: e1 -> e2 (forward order)
    const afterRedo = applyCanonicalHistoryEventsToDocument(
      initial,
      [e1, e2],
      "redo",
    );
    expect(
      (
        afterRedo.children[0].children![0].children![0] as {
          props: { label: string };
        }
      ).props.label,
    ).toBe("Step2");

    // undo: e2 -> e1 (reverse order)
    const afterUndo = applyCanonicalHistoryEventsToDocument(
      afterRedo,
      [e1, e2],
      "undo",
    );
    expect(
      (
        afterUndo.children[0].children![0].children![0] as {
          props: { label: string };
        }
      ).props.label,
    ).toBe("Click");
  });
});
