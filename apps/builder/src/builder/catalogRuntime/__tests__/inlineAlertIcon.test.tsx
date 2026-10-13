// @vitest-environment jsdom
/**
 * S2 1.8.0 InlineAlert's variant icon (`InlineAlert.tsx:184-191, 208-262`): informative · positive ·
 * notice · negative draw S2's InfoCircle · CheckmarkCircle · AlertDiamond · AlertTriangle (here the
 * Lucide `info` · `circle-check` · `octagon-alert` · `triangle-alert`), neutral none; an image named
 * by the variant's string, in S2's `--iconPrimary` per fill. It sits at the padding box's top end
 * (S2 floats it inline-end) in both consumers, and the title keeps clear of it (the rule's
 * `variant` blocks — the Canvas part rule, the generated sheet).
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveToken, type TokenRef } from "@composition/rendering";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  CATALOG_INLINE_ALERT_ICON_SIZE,
  catalogInlineAlertIcon,
} from "../../../../../../packages/shared/src/catalog/document/inlineAlertIcon";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogRuleShapes } from "../ruleShapes";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:alert" as NodeId;
const LONG_TITLE =
  "A heading long enough to reach the alert's end and wrap before the icon";

async function open(props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:inline-alert-icon" as const,
        name: "InlineAlert icon",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `inline-alert-icon-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId: catalogPaletteDefinitionId(library, "InlineAlert"),
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          visual: {},
          sizing: { width: { kind: "set", value: 320 } },
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const state = () => {
    const record = [...root.canvasInputs.values()].find(
      (item) => item.sourceId === OWNER,
    )!;
    const heading = [...root.canvasInputs.values()].find(
      (item) => item.bindingId === "heading" && item.parentId === record.id,
    )!;
    const geometry = root.getGeometry([record.id, heading.id]);
    const box = geometry.get(record.id)!;
    const shapes = catalogRuleShapes({
      node: record,
      rect: { width: box.width, height: box.height },
      rule: workspace.runtime.graph.library.rules.get("InlineAlert" as never)!,
      type: "InlineAlert",
      authoredVisual: {},
    });
    const icon = shapes.find((shape) => shape.type === "icon_font") as
      | {
          iconName: string;
          x: number;
          y: number;
          fontSize: number;
          fill: string;
        }
      | undefined;
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(renderCatalogDom(root, record.id));
    return {
      record,
      box,
      heading: geometry.get(heading.id)!,
      // How far the title's box stops before the content end (the icon's room — placed by the
      // rule's `variant` blocks).
      titleEnd:
        box.width -
        BORDER -
        PAD -
        (geometry.get(heading.id)!.x + geometry.get(heading.id)!.width),
      icon,
      dom: host.firstElementChild as HTMLElement,
    };
  };
  return { workspace, state };
}

const ICONS = {
  informative: "info",
  positive: "circle-check",
  notice: "octagon-alert",
  negative: "triangle-alert",
} as const;
const NAMES = {
  informative: "Information",
  positive: "Success",
  notice: "Warning",
  negative: "Error",
} as const;
// InlineAlert rule size M: padding 16, the default variant's thin border (1 px).
const PAD = 16;
const BORDER = 1;

describe("S2 InlineAlert icon", () => {
  for (const variant of Object.keys(ICONS) as (keyof typeof ICONS)[])
    it(`${variant}: its icon at the top end in both consumers, the title's text clear of it`, async () => {
      const { state } = await open({ variant, title: LONG_TITLE });
      const { box, titleEnd, icon, dom } = state();
      const size = CATALOG_INLINE_ALERT_ICON_SIZE;
      // Canvas glyph (padding-box coordinates — the converter adds the border).
      expect(icon).toMatchObject({
        iconName: ICONS[variant],
        x: box.width - BORDER * 2 - PAD - size / 2,
        y: PAD + size / 2,
        fontSize: size,
        fill: resolveToken(`{color.${variant}}` as TokenRef, "light"),
      });
      // DOM glyph: first, an image named by S2's string, at the padding box's top end.
      const svg = dom.firstElementChild as SVGElement;
      expect({
        tag: svg.tagName.toLowerCase(),
        role: svg.getAttribute("role"),
        name: svg.getAttribute("aria-label"),
        top: svg.style.top,
        end: svg.style.insetInlineEnd,
        width: svg.getAttribute("width"),
        alertPosition: dom.style.position,
        paths: svg.querySelectorAll("path, circle").length > 0,
      }).toEqual({
        tag: "svg",
        role: "img",
        name: NAMES[variant],
        top: `${PAD}px`,
        end: `${PAD}px`,
        width: String(size),
        alertPosition: "relative",
        paths: true,
      });
      expect(svg.style.color).toContain("var(--");
      // The title stops before the icon (Canvas — the part rule's placement).
      expect(titleEnd).toBe(size);
    });

  it("neutral: no icon — the title keeps its whole width", async () => {
    const { state } = await open({ variant: "neutral", title: LONG_TITLE });
    const { titleEnd, icon, dom } = state();
    expect(icon).toBeUndefined();
    expect(dom.querySelector("svg.inline-alert-icon")).toBeNull();
    expect(titleEnd).toBe(0);
  });

  it("a variant edit moves the title's end with the icon (neutral ↔ informative)", async () => {
    const { workspace, state } = await open({
      variant: "informative",
      title: LONG_TITLE,
    });
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: OWNER }],
        props: { variant: { kind: "set", value: "neutral" } },
      }),
    );
    const neutral = state();
    expect(neutral.icon).toBeUndefined();
    expect(neutral.titleEnd).toBe(0);
    workspace.undo();
    expect(state().titleEnd).toBe(CATALOG_INLINE_ALERT_ICON_SIZE);
    expect(state().icon?.iconName).toBe("info");
  });

  it("its color is S2's --iconPrimary per fill", async () => {
    const color = (variant: string, fillStyle: string) =>
      catalogInlineAlertIcon({ variant, fillStyle })?.color;
    expect(color("notice", "border")).toBe("{color.notice}");
    expect(color("notice", "subtleFill")).toBe("{color.negative}");
    expect(color("positive", "subtleFill")).toBe("{color.positive}");
    expect(color("negative", "boldFill")).toBe("#ffffff");
    expect(color("notice", "boldFill")).toBe("#000000");
    // Both consumers paint it: a bold alert's glyph is white on the Canvas and in the DOM.
    const { state } = await open({
      variant: "negative",
      fillStyle: "boldFill",
    });
    const { icon, dom } = state();
    expect(icon?.fill).toBe("#ffffff");
    expect((dom.firstElementChild as SVGElement).style.color).toBe(
      "rgb(255, 255, 255)",
    );
  });

  it("the generated sheet keeps the title clear of the icon (all four variants, not neutral)", () => {
    const css = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../../../../packages/shared/src/components/styles/generated/InlineAlert.css",
      ),
      "utf8",
    );
    for (const variant of Object.keys(ICONS))
      expect(css).toMatch(
        new RegExp(
          `\\[data-variant="${variant}"\\] > \\.react-aria-Heading \\{\\s*width: auto;\\s*align-self: stretch;\\s*margin-right: ${CATALOG_INLINE_ALERT_ICON_SIZE}px;`,
        ),
      );
    expect(css).not.toContain('[data-variant="neutral"] > .react-aria-Heading');
  });
});
