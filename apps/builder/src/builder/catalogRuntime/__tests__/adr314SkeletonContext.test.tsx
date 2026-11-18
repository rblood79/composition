// @vitest-environment jsdom
/**
 * ADR-314 Phase 2 (G2) — S2 `SkeletonContext` on the catalog records: the nearest loading Skeleton
 * reaches its participants through every record path (its own slot content, an instance inside it,
 * a placed component's template positions), stops at a Button's content, disables the form
 * components inside it (S2 `useFormProps` — 「Skeleton always wins」), and marks the DOM
 * participants `data-skeleton` · `inert`. `isLoading: false` takes all of it back (incremental).
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import {
  openOwnedSkeleton,
  openSkeleton,
  SKELETON,
} from "./support/adr314Skeleton";


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

  it("its own slot content: the sample Texts are skeleton, the DOM marks them inert", async () => {
    const h = await openSkeleton([]);
    const texts = h.ofType("Text");
    expect(texts.length).toBeGreaterThanOrEqual(2);
    for (const text of texts) expect(text.derivedProps?.isSkeleton).toBe(true);
    // (A frame is no participant — nothing derived.)
    for (const frame of h.ofType("frame"))
      expect(frame.derivedProps?.isSkeleton).toBeUndefined();
    const html = h.html();
    expect(html).toMatch(/data-skeleton="true"[^>]*inert=""|inert=""[^>]*data-skeleton="true"/);
    expect(html.match(/data-skeleton="true"/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it("isLoading false takes it back on the next step (incremental)", async () => {
    const h = await openSkeleton([]);
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

  it("a form field inside is disabled in both consumers (S2 useFormProps)", async () => {
    const h = await openSkeleton(["TextField"]);
    const [field] = h.ofType("TextField");
    expect(field.derivedProps?.isDisabled).toBe(true);
    expect(h.html()).toMatch(/<input[^>]*disabled=""/);
    h.setLoading(false);
    expect(h.html()).not.toMatch(/<input[^>]*disabled=""/);
  });
});
