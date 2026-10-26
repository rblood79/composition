import { describe, expect, it } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * A ratio written on a rule-backed node (the Size section's Ratio lock) reaches the Preview as
 * inline `aspect-ratio` — the rule executor's authored layer used to refuse the key
 * (`CATALOG_DOM_VISUAL_UNSUPPORTED:…:aspectRatio`) and the whole Preview failed to render.
 */
describe("authored aspectRatio on a rule-backed node", () => {
  const ratio = (
    h: Awaited<ReturnType<typeof openAdr280Preview>>,
    identity: string,
  ) => {
    const item = h.workspace.itemOfRecord(identity);
    expect(item, identity).toBeDefined();
    h.workspace.execute(
      setFields({
        targets: [item!.target],
        visual: { aspectRatio: { kind: "set", value: "16 / 9" } },
        label: "Ratio",
      }),
    );
    h.flush();
  };

  it("the instance root (Button)", async () => {
    const h = await openAdr280Preview(["Button"]);
    const element = h.element(h.ids[0] as NodeId)!;
    ratio(h, element.getAttribute("data-catalog-id")!);
    expect(h.element(h.ids[0] as NodeId)!.style.aspectRatio).toBe("16 / 9");
  });

  it("a template position (Card's CardPreview)", async () => {
    const h = await openAdr280Preview(["Card"]);
    const preview = () =>
      h.view.container.querySelector<HTMLElement>(
        '[data-catalog-id$="component-card__preview"]',
      );
    expect(preview()).not.toBeNull();
    ratio(h, preview()!.getAttribute("data-catalog-id")!);
    expect(preview()!.style.aspectRatio).toBe("16 / 9");
  });
});
