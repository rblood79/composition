// @vitest-environment jsdom
/**
 * ADR-314 Phase 2 (G2) — S2 `SkeletonContext` on the catalog records: the nearest loading Skeleton
 * reaches its participants through every record path (its own slot content, an instance inside it,
 * a placed component's template positions), stops at a Button's content, disables the form
 * components inside it (S2 `useFormProps` — 「Skeleton always wins」), and marks the DOM
 * participants `data-skeleton` · `inert`. `isLoading: false` takes all of it back (incremental).
 */
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import {
  BODY,
  openOwnedSkeleton,
  openSkeleton,
  SKELETON,
} from "./support/adr314Skeleton";
import { catalogPaletteInsertPlan } from "../paletteInsert";
import { renderCatalogDom } from "../domBinding";


describe("ADR-314 Phase 2 — the Skeleton context reaches its participants", () => {
  it("a bare Skeleton's own child follows an isLoading edit (the descendants are re-planned)", async () => {
    const { workspace, textRecord } = await openOwnedSkeleton();
    expect(textRecord().derivedProps?.isSkeleton).toBe(true);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: SKELETON }],
        props: { isLoading: { kind: "set", value: false } },
      }),
    );
    expect(textRecord().derivedProps?.isSkeleton).toBeUndefined();
  });

  it("content put inside: its Texts are skeleton, the DOM marks them inert", async () => {
    const h = await openSkeleton(["Image", "Text", "Text"]);
    const texts = h.ofType("Text");
    expect(texts.length).toBe(2);
    for (const text of texts) expect(text.derivedProps?.isSkeleton).toBe(true);
    const html = h.html();
    expect(html).toMatch(/data-skeleton="true"[^>]*inert=""|inert=""[^>]*data-skeleton="true"/);
    expect(html.match(/data-skeleton="true"/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it("a frame inside is no participant — nothing derived", async () => {
    const h = await openSkeleton(["frame"]);
    const frames = h.ofType("frame");
    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames)
      expect(frame.derivedProps?.isSkeleton).toBeUndefined();
  });

  it("isLoading false takes it back on the next step (incremental)", async () => {
    const h = await openSkeleton(["Text"]);
    expect(h.ofType("Text").length).toBe(1);
    h.setLoading(false);
    for (const text of h.ofType("Text"))
      expect(text.derivedProps?.isSkeleton).toBeUndefined();
    expect(h.html()).not.toContain("data-skeleton");
    h.setLoading(true);
    for (const text of h.ofType("Text"))
      expect(text.derivedProps?.isSkeleton).toBe(true);
  });

  it("an instance inside it: a Card and its template Texts are skeleton (the Card inert)", async () => {
    const h = await openSkeleton(["Card"]);
    const [card] = h.ofType("Card");
    expect(card.derivedProps?.isSkeleton).toBe(true);
    // (A Text inside a Button of the Card's footer is the Button's own content — cut, as S2.)
    const underButton = (record: CatalogConsumerNode): boolean => {
      for (
        let parent = h.root.domInputs.get(record.parentId);
        parent && parent.id !== card.id;
        parent = h.root.domInputs.get(parent.parentId)
      )
        if (/Button$/.test(h.root.typeOf(parent))) return true;
      return false;
    };
    const cardTexts = h.ofType("Text", card);
    const content = cardTexts.filter((text) => !underButton(text));
    expect(content.length).toBeGreaterThan(0);
    for (const text of content)
      expect(text.derivedProps?.isSkeleton).toBe(true);
    for (const text of cardTexts.filter(underButton))
      expect(text.derivedProps?.isSkeleton).toBeUndefined();
  });

  it("a Button's content is not (S2 cuts the context) — the Button itself is disabled", async () => {
    const h = await openSkeleton(["Button"]);
    const [button] = h.ofType("Button");
    expect(button.derivedProps?.isDisabled).toBe(true);
    for (const text of h.ofType("Text", button))
      expect(text.derivedProps?.isSkeleton).toBeUndefined();
    h.setLoading(false);
    const [after] = h.ofType("Button");
    expect(after.derivedProps?.isDisabled).not.toBe(true);
  });

  it("a Skeleton draws no element: its author id · class stay off its Fragment (Table inside, client render)", async () => {
    // (2026-11-19 사용자 보고: Skeleton + Table → React 「Invalid prop `id` supplied to React.Fragment」 —
    //  every record has an automatic id, `withHtmlId` put it on the Skeleton's Fragment.)
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const h = await openSkeleton(["Table"]);
    expect(h.skeletonRecord().htmlId).toBeTruthy();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const host = document.createElement("div");
    document.body.append(host);
    const renderer = createRoot(host);
    try {
      await act(async () =>
        renderer.render(renderCatalogDom(h.root, h.skeletonRecord().id)),
      );
      const fragmentWarnings = errors.mock.calls.filter((args) =>
        String(args[0]).includes("React.Fragment"),
      );
      expect(fragmentWarnings).toEqual([]);
      expect(host.querySelector('[role="grid"]')).not.toBeNull();
    } finally {
      await act(async () => renderer.unmount());
      host.remove();
      errors.mockRestore();
    }
  });

  it("a Table inside: its header · cell words are plain (S2 `columnHeaderText` · `cellContent` spans), a Text put in a cell is skeleton", async () => {
    // (2026-11-19 사용자 결정 「S2 와 맞게」: S2 TableView draws a Column's · Cell's `children` in a
    //  plain span — `TableView.tsx` `ColumnContents` · `Cell` — not a `Text`, so a Skeleton around a
    //  table leaves its words. Our Column · Cell origins hold those words as a Text node.)
    const h = await openSkeleton(["Table"]);
    const parentType = (record: CatalogConsumerNode) =>
      h.root.typeOf(h.root.domInputs.get(record.parentId)!);
    const words = h.ofType("Text");
    const cellWords = words.filter((text) => parentType(text) === "Cell");
    const headerWords = words.filter((text) => parentType(text) === "frame");
    expect(cellWords.length).toBe(3);
    expect(headerWords.length).toBe(3);
    for (const text of [...cellWords, ...headerWords])
      expect(text.derivedProps?.isSkeleton, String(text.props.children)).toBeUndefined();
    // (S2's ⋮ · sort arrows are S2 Icons — `SkeletonWrapper`.)
    for (const icon of h.ofType("Icon").filter((icon) => parentType(icon) === "frame"))
      expect(icon.derivedProps?.isSkeleton).toBe(true);
    const html = h.html();
    for (const label of ["Name", "Item 1"])
      expect(html).not.toContain(`data-skeleton-look="text" inert="">${label}`);
    // A Text the author puts in a cell beside its words is S2 `<Cell>…<Text/></Cell>` — skeleton.
    const cell = h.root.domInputs.get(cellWords[0]!.parentId)!;
    h.workspace.selectRecords([cell.id]);
    const plan = catalogPaletteInsertPlan(
      {
        graph: h.workspace.runtime.graph,
        records: h.workspace.root.domInputs,
        selection: () => h.workspace.session.getSnapshot().selection,
        itemOfRecord: (identity) => h.workspace.itemOfRecord(identity),
        pageContent: () => ({ kind: "node", id: BODY }),
        newId: h.workspace.newId,
      },
      "Text",
    );
    if (!plan.command || plan.relocated) throw new Error("Text not in the cell");
    h.workspace.execute(plan.command);
    const inCell = h
      .ofType("Text")
      .filter((text) => text.parentId === cell.id);
    expect(inCell.length).toBe(2);
    expect(inCell[0]!.derivedProps?.isSkeleton).toBeUndefined();
    expect(inCell[1]!.derivedProps?.isSkeleton).toBe(true);
  });

  it("a form field inside is disabled in both consumers (S2 useFormProps)", async () => {
    const h = await openSkeleton(["TextField"]);
    const [field] = h.ofType("TextField");
    expect(field.derivedProps?.isDisabled).toBe(true);
    expect(h.html()).toMatch(/<input[^>]*disabled=""/);
    h.setLoading(false);
    expect(h.html()).not.toMatch(/<input[^>]*disabled=""/);
  });
});
