import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { detachInstances } from "../../../../../../packages/shared/src/catalog/commands/components";
import { catalogCanvasNodeData } from "../../../builder/catalogRuntime/canvasBinding";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 체크리스트 §9.3 (6-7) — S2 Card `density` and its card spacing (사용자 결정 2026-11-24 「포함」 ·
 * 「S2 크기별 폭」): the padding is `--card-spacing` (density × size — regular XS 8 · S 12 · M 16 ·
 * L 20 · XL 24, compact − 4 · spacious + 4, XS compact 6), 0 on a quiet card; the CardPreview
 * reaches the card's edges (negative margins); a Content is the spacing below the preview and ¾ of
 * it above the Footer, the Footer ¾ above itself; a standalone card is its size's width (M 240), a
 * CardView's fills its cell. The Canvas (records · geometry) and the DOM (generated sheet · inline)
 * read the same values.
 */
afterEach(() => vi.restoreAllMocks());

async function openCard() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["Card"]);
  const id = h.ids[0] as NodeId;
  const root = () => h.workspace.root;
  const typeOf = (record: { definitionId: string }) =>
    root().typeOf(record as never);
  const record = (type: string): CatalogConsumerNode =>
    [...root().canvasInputs.values()].find(
      (each) =>
        typeOf(each) === type &&
        (type === "Card" ||
          root().canvasInputs.get(each.parentId)?.id === record("Card").id),
    )!;
  const box = (type: string) => {
    const at = record(type);
    return root().getGeometry([at.id]).get(at.id)!;
  };
  const card = () =>
    h.view.container.querySelector<HTMLElement>(".react-aria-Card")!;
  const part = (className: string) =>
    card().querySelector<HTMLElement>(`:scope > .${className}`)!;
  return { h, id, root, record, box, card, part };
}

describe("S2 §9.3 Card density — the card spacing", () => {
  it("pads the card by its density × size, the preview at its edges, the sections spaced", async () => {
    const t = await openCard();
    // Regular M: padding 16 (the generated sheet), width 240.
    expect(t.record("Card").visual.paddingX).toBe(16);
    expect(t.box("Card").width).toBe(240);
    expect(t.card().dataset.density).toBe("regular");
    // The preview reaches the edges (inside the 1px border); the Content starts 16 below it.
    expect(t.box("CardPreview")).toMatchObject({ x: 1, y: 1, width: 238 });
    expect(t.part("react-aria-CardPreview").style.marginLeft).toBe("-16px");
    expect(t.part("react-aria-CardPreview").style.marginTop).toBe("-16px");
    expect(t.part("react-aria-CardPreview").style.marginBottom).toBe("");
    expect(t.part("react-aria-Content").style.paddingTop).toBe("16px");
    expect(t.part("react-aria-Content").style.paddingBottom).toBe("12px");
    expect(t.part("react-aria-Footer").style.paddingTop).toBe("12px");
    expect(t.box("Content").x).toBe(17);
    // Compact M → 12; spacious XL → 28 (and XL's width 400).
    t.h.declare(t.id, { density: "compact" });
    expect(t.record("Card").visual.paddingX).toBe(12);
    expect(t.card().dataset.density).toBe("compact");
    expect(t.part("react-aria-CardPreview").style.marginLeft).toBe("-12px");
    expect(t.part("react-aria-Content").style.paddingBottom).toBe("9px");
    expect(t.box("Content").x).toBe(13);
    // Regular L → S2's 20 (the size block — no longer 24).
    t.h.declare(t.id, { density: "regular", size: "L" });
    expect(t.record("Card").visual.paddingX).toBe(20);
    expect(t.box("Card").width).toBe(320);
    t.h.declare(t.id, { density: "spacious", size: "XL" });
    expect(t.record("Card").visual.paddingX).toBe(28);
    expect(t.box("Card").width).toBe(400);
    expect(t.part("react-aria-Footer").style.paddingTop).toBe("21px");
    // Quiet: no padding, no clip — the spacing still places the sections; the preview takes the
    // card's corner.
    t.h.declare(t.id, { variant: "quiet", size: "M", density: "regular" });
    expect(t.record("Card").visual.paddingX).toBe(0);
    expect(t.record("Card").visual.overflow).toBe("visible");
    expect(t.part("react-aria-CardPreview").style.marginLeft).toBe("");
    expect(t.part("react-aria-CardPreview").style.borderRadius).toBe("10px");
    expect(
      catalogCanvasNodeData(t.root(), t.record("CardPreview").id).box,
    ).toMatchObject({ borderRadius: 10 });
    expect(t.part("react-aria-Content").style.paddingTop).toBe("16px");
    t.h.view.unmount();
  }, 120_000);

  it("re-derives a detached card's sections when its density changes", async () => {
    // (A detached Card's parts are its own nodes — its prop write does not re-resolve them: the
    //  sections follow it through the Card's derived dependents.)
    const t = await openCard();
    t.h.workspace.execute(
      detachInstances({ ids: [t.id], newId: t.h.workspace.newId }),
    );
    t.h.flush();
    expect(t.record("Content").derivedProps?._cardPadTop).toBe(16);
    t.h.declare(t.id, { density: "compact" });
    expect(t.record("Content").derivedProps?._cardPadTop).toBe(12);
    expect(t.record("CardPreview").fillLayout).toMatchObject({
      marginLeft: "-12px",
    });
    expect(t.part("react-aria-Content").style.paddingTop).toBe("12px");
    t.h.view.unmount();
  }, 120_000);

  it("fills a CardView's cell", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["CardView"]);
    const root = h.workspace.root;
    const cards = [...root.canvasInputs.values()].filter(
      (record) => root.typeOf(record as never) === "Card",
    );
    expect(cards.length).toBeGreaterThan(1);
    for (const card of cards) {
      expect(card.fillLayout).toMatchObject({ width: "100%" });
      expect(root.getGeometry([card.id]).get(card.id)!.width).toBeGreaterThan(
        240,
      );
    }
    for (const card of h.view.container.querySelectorAll<HTMLElement>(
      ".react-aria-Card",
    ))
      expect(card.style.width).toBe("100%");
    h.view.unmount();
  }, 120_000);
});
