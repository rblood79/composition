import { act } from "@testing-library/react";
import { expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 대조 (2026-11-25) — S2 `Provider` `locale` puts `lang` on its element and the text inside takes
 * that language's font by CSS inheritance (`.claude/rules/text-font.md` §1 3 — the font family is the
 * nearest ancestor's). A frame's `locale` is that Provider: the Text inside a `ja-JP` frame draws the
 * S2 Japanese font on the Canvas (its inherited family) and in the DOM (the record's value, inline) —
 * the Text wrote the document font inline before, over the frame's `:lang()` font.
 */
it("a Text inside a ja-JP frame takes the Japanese font — Canvas record and DOM; the frame's change follows", async () => {
  const library = await buildCodeCatalogLibrary();
  const h = await openAdr280Preview(["frame"]);
  const [frame] = h.ids as [NodeId];
  const text = "project:node:ja-text" as NodeId;
  act(() => {
    h.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: frame },
        entries: [
          {
            kind: "node",
            id: text,
            definitionId: catalogPaletteDefinitionId(library, "Text"),
            children: [],
            props: { children: { kind: "set", value: "日本語" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as unknown as NodeEntry,
        ],
        rootIds: [text],
        newId: h.workspace.newId,
      }),
    );
  });
  h.flush();
  const family = () =>
    String(
      [...h.workspace.root.canvasInputs.values()].find(
        (record) => record.sourceId === text,
      )!.inheritedText?.fontFamily ?? "",
    );
  const domFamily = () => h.element(text)?.style.fontFamily ?? "";
  expect(family()).not.toMatch(/^adobe-clean-han-japanese/);
  h.declare(frame, { locale: "ja-JP" });
  expect(family()).toMatch(/^adobe-clean-han-japanese/);
  expect(domFamily()).toMatch(/^"?adobe-clean-han-japanese/);
  h.declare(frame, { locale: "zh-TW" });
  expect(family()).toMatch(/^adobe-clean-han-traditional/);
  h.view.unmount();
});
