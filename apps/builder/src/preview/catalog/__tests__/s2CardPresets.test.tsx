import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 체크리스트 §9.3 (6-7) — S2 AssetCard · UserCard · ProductCard and a Card with S2's
 * CollectionCardPreview as palette origins (the root a Card — no type of their own). Each is S2's
 * Card.md example: AssetCard (density regular — a square preview, the title's ActionMenu), UserCard
 * (spacious — a 3:1 banner, the Avatar over its edge at the card's size: M 64 up 32 · XL 80 up 40),
 * ProductCard (spacious — a 5:1 banner, the thumbnail over it: M 40 up 20 · XL 56 up 28, the Footer's
 * Button at the card's size), CollectionCard (4 images, the first across the 3 columns at 3:2).
 */
afterEach(() => vi.restoreAllMocks());

async function open(type: string) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview([type]);
  const id = h.ids[0] as NodeId;
  const root = () => h.workspace.root;
  const records = () => [...root().canvasInputs.values()];
  const typeOf = (record: { definitionId: string }) =>
    root().typeOf(record as never);
  const card = () => records().find((record) => typeOf(record) === "Card")!;
  const child = (
    type: string,
    where?: (props: Record<string, unknown>) => boolean,
  ) =>
    records().find(
      (record) =>
        record.parentId === card().id &&
        typeOf(record) === type &&
        (!where || where(record.props)),
    )!;
  const box = (record: { id: string }) =>
    root().getGeometry([record.id]).get(record.id)!;
  const dom = () =>
    h.view.container.querySelector<HTMLElement>(".react-aria-Card")!;
  return { h, id, root, records, typeOf, card, child, box, dom };
}

describe("S2 §9.3 Card presets — AssetCard · UserCard · ProductCard · CollectionCard", () => {
  it("AssetCard: a regular square-preview card with the title's ActionMenu", async () => {
    const t = await open("AssetCard");
    expect(t.card().props).toMatchObject({ size: "M", density: "regular" });
    expect(t.dom().dataset.density).toBe("regular");
    expect(t.box(t.card()).width).toBe(240);
    const preview = t.child("CardPreview");
    const image = t.records().find((record) => record.parentId === preview.id)!;
    expect(t.box(image).width).toBe(t.box(image).height);
    const trigger = t
      .records()
      .find(
        (record) =>
          t.typeOf(record) === "ActionButton" &&
          record.props.icon === undefined &&
          record.props.isQuiet === true,
      )!;
    expect(trigger.props.size).toBe("S");
    expect(t.dom().textContent).toContain("Desert Sunset");
    expect(t.dom().querySelector("button[aria-label]")).not.toBeNull();
    t.h.view.unmount();
  }, 120_000);

  it("UserCard: a spacious card, the Avatar over the banner's edge at the card's size", async () => {
    const t = await open("UserCard");
    expect(t.card().props).toMatchObject({ density: "spacious" });
    const avatar = t.child("Avatar");
    const preview = t.child("CardPreview");
    expect(avatar.props.size).toBe(64);
    expect(t.box(preview).width / t.box(preview).height).toBeCloseTo(3, 1);
    expect(t.box(avatar).y).toBeCloseTo(
      t.box(preview).y + t.box(preview).height - 32,
      1,
    );
    // (The Avatar's element is its own `div` — the card's second child, after the preview.)
    const domAvatar = t.dom().children[1] as HTMLElement;
    expect(domAvatar.style.marginTop).toBe("-32px");
    expect(domAvatar.style.position).toBe("relative");
    t.h.declare(t.id, { size: "XL" });
    expect(t.child("Avatar").props.size).toBe(80);
    expect(t.box(t.child("Avatar")).y).toBeCloseTo(
      t.box(t.child("CardPreview")).y +
        t.box(t.child("CardPreview")).height -
        40,
      1,
    );
    t.h.view.unmount();
  }, 120_000);

  it("ProductCard: the thumbnail over the 5:1 banner, the Button at the card's size", async () => {
    const t = await open("ProductCard");
    const thumbnail = t.child("Image", (props) => props.slot === "thumbnail");
    const preview = t.child("CardPreview");
    expect(t.box(thumbnail)).toMatchObject({ width: 40, height: 40 });
    expect(t.box(thumbnail).y).toBeCloseTo(
      t.box(preview).y + t.box(preview).height - 20,
      1,
    );
    const domThumb = t
      .dom()
      .querySelector<HTMLElement>(":scope > .react-aria-Image")!;
    expect(domThumb.style.marginTop).toBe("-20px");
    // (S2 `borderRadius: default` — the Card's part rule.)
    expect(domThumb.style.borderRadius).toBe("8px");
    expect(thumbnail.visual.radius).toBeGreaterThan(0);
    const button = t.records().find((record) => t.typeOf(record) === "Button")!;
    expect(button.props.size).toBe("M");
    t.h.declare(t.id, { size: "XL" });
    const big = t.child("Image", (props) => props.slot === "thumbnail");
    expect(t.box(big)).toMatchObject({ width: 56, height: 56 });
    expect(big.fillLayout).toMatchObject({ marginTop: "-28px" });
    expect(
      t.records().find((record) => t.typeOf(record) === "Button")!.props.size,
    ).toBe("XL");
    t.h.view.unmount();
  }, 120_000);

  it("CollectionCard: four images, the first across the three columns", async () => {
    const t = await open("CollectionCard");
    const preview = t.child("CardPreview");
    const grid = t.records().find((record) => record.parentId === preview.id)!;
    const images = t.records().filter((record) => record.parentId === grid.id);
    expect(images).toHaveLength(4);
    const [first, ...rest] = images.map((image) => t.box(image));
    expect(first!.width).toBeCloseTo(t.box(grid).width, 0);
    expect(first!.width / first!.height).toBeCloseTo(1.5, 1);
    for (const each of rest) expect(each.width).toBeCloseTo(each.height, 0);
    expect(t.dom().textContent).toContain("20 photos");
    t.h.view.unmount();
  }, 120_000);
});
