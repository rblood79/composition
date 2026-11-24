/**
 * 2026-11-24 (사용자 「B 로 진행해 — S2 레퍼런스 대로」): S2 `Text` (`src/Content.tsx`) has no font
 * of its own — no `size` prop, its class is only the `styles` the author or an owner's context
 * gives. Without one the words take the parent's font (CSS inheritance), as RAC's bare `span`.
 *
 * - Canvas: a Text with no size reads its parent's DOM font (`domFont`) — size and weight.
 * - DOM: no `data-size`, and the generated sheet's base block writes no font size.
 * - An owner's size step (a Cell's `controlFont()`) and the author's own font size still win.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DefinitionId,
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { headingBinding } from "../../../../../../packages/shared/src/catalog/bindings/Heading.binding";
import { textBinding } from "../../../../../../packages/shared/src/catalog/bindings/Text.binding";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;
const FRAME = "project:node:font-frame" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const node = (
  id: string,
  definitionId: string,
  children: string[],
  props: Record<string, ReturnType<typeof set<string | number>>> = {},
  visual: Record<string, ReturnType<typeof set<number>>> = {},
) => ({
  kind: "node" as const,
  id: id as NodeId,
  definitionId: definitionId as DefinitionId,
  children: children as NodeId[],
  props,
  visual,
  sizing: {},
  descendantOverrides: [],
});

async function workspaceWithFrame() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:text-inherits" as EntryId<"project">,
        name: "Text inherits",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `text-inherits-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node(
          FRAME,
          "lib:definition:type-frame",
          ["project:node:framed-words"],
          {},
          { fontSize: set(20), fontWeight: set(700) },
        ),
        node("project:node:framed-words", "lib:definition:text", [], {
          children: set("Framed"),
        }),
        node("project:node:page-words", "lib:definition:text", [], {
          children: set("On page"),
        }),
      ],
      rootIds: [FRAME, "project:node:page-words" as NodeId],
      newId: workspace.newId,
    }),
  );
  const record = (text: string) => {
    const found = [...workspace.root.canvasInputs.values()].find(
      (item) => item.props.children === text,
    ) as CatalogConsumerNode | undefined;
    expect(found, text).toBeDefined();
    return found!;
  };
  const fontOf = (text: string) => {
    const found = record(text);
    return {
      size: Number(found.derivedProps?.fontSize ?? found.visual.fontSize),
      weight: Number(found.derivedProps?.fontWeight ?? found.visual.fontWeight),
    };
  };
  return { workspace, record, fontOf };
}

describe("S2 Text — no font of its own, the parent's by inheritance", () => {
  it("takes its frame's font size and weight, else the page's", async () => {
    const { fontOf, record } = await workspaceWithFrame();
    expect(fontOf("Framed")).toEqual({ size: 20, weight: 700 });
    // (The page body declares no font: the document's base text — 16 · 400 at the DOM root's line
    //  height 1.5, not the Canvas `normal`.)
    expect(fontOf("On page")).toEqual({ size: 16, weight: 400 });
    expect(record("On page").derivedProps?.lineHeight).toBe(1.5);
    // (No size step of its own — the DOM writes no `data-size`.)
    expect(record("Framed").props.size).toBeUndefined();
  });

  it("follows a frame font edit and its undo", async () => {
    const { workspace, fontOf } = await workspaceWithFrame();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: FRAME }],
        visual: { fontSize: set(24) },
      }),
    );
    expect(fontOf("Framed").size).toBe(24);
    workspace.undo();
    expect(fontOf("Framed").size).toBe(20);
  });

  it("keeps the author's own font size over the frame's", async () => {
    const { workspace, fontOf } = await workspaceWithFrame();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:framed-words" as NodeId }],
        visual: { fontSize: set(12) },
      }),
    );
    expect(fontOf("Framed").size).toBe(12);
  });

  it("has no Size editor and no default size (S2 Text has no `size`)", () => {
    const size = textBinding.props.accepts.size as {
      default?: unknown;
      editorHidden?: boolean;
    };
    expect(size.default).toBeUndefined();
    expect(size.editorHidden).toBe(true);
  });

  it("the generated sheet's base Text block writes no font size", () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        "../../packages/shared/src/components/styles/generated/Text.css",
      ),
      "utf8",
    );
    const base = css.slice(css.indexOf(".react-aria-Text {"));
    const block = base.slice(0, base.indexOf("}"));
    expect(block).not.toMatch(/font-size|line-height/);
  });
});

/**
 * S2 `Heading` (`src/Content.tsx`) — RAC's bare `h{level}`: no font of its own, the browser's h
 * rule under it (HTML 「Rendering」: h1 2em · h2 1.5em · h3 1.17em · h4 1em · h5 .83em · h6 .67em of
 * the parent's). An owner's size step (a Dialog's title) and the author's own value win. Its
 * weight stays the sheet's 600 and its margin 0 (사용자 2026-11-24 「0 으로 진행해」).
 */
describe("S2 Heading — the parent's font by the h rule's scale", () => {
  async function withHeading(level?: number, size?: string) {
    const ctx = await workspaceWithFrame();
    ctx.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: FRAME },
        entries: [
          node(
            "project:node:frame-heading",
            "lib:definition:heading",
            ["project:node:heading-words"],
            {
              children: set(""),
              ...(level ? { level: set(level) } : {}),
              ...(size ? { size: set(size) } : {}),
            },
          ),
          node("project:node:heading-words", "lib:definition:text", [], {
            children: set("Heading words"),
          }),
        ],
        rootIds: ["project:node:frame-heading" as NodeId],
        newId: ctx.workspace.newId,
      }),
    );
    const heading = () =>
      [...ctx.workspace.root.canvasInputs.values()].find(
        (item) => item.sourceId === "project:node:frame-heading",
      )!;
    const headingFont = () => ({
      size: Number(
        heading().derivedProps?.fontSize ?? heading().visual.fontSize,
      ),
      weight: Number(heading().visual.fontWeight),
    });
    return { ...ctx, heading, headingFont };
  }

  it("an h3 (RAC's default) is 1.17 × its frame's 20, bold 700, no size", async () => {
    const { headingFont, heading, fontOf } = await withHeading();
    // (`text-font.md` §1 — the browser's h rule: bold, 2026-11-24 「700 으로 규칙 확정」.)
    expect(headingFont()).toEqual({ size: 23.4, weight: 700 });
    expect(heading().props.size).toBeUndefined();
    // (A Text in it takes the heading's font — the DOM's inheritance.)
    expect(fontOf("Heading words")).toEqual({ size: 23.4, weight: 700 });
  });

  it("follows its level (h1 2 ×) and a level edit", async () => {
    const { workspace, headingFont, fontOf } = await withHeading(1);
    expect(headingFont().size).toBe(40);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:frame-heading" as NodeId }],
        props: { level: set(6) },
      }),
    );
    expect(headingFont().size).toBeCloseTo(13.4);
    expect(fontOf("Heading words").size).toBeCloseTo(13.4);
  });

  it("a section's title is S2 `sectionHeading` — 14 · bold, not the h3 scale", async () => {
    const ctx = await workspaceWithFrame();
    ctx.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node("project:node:section-header", "lib:definition:type-Header", [
            "project:node:section-heading",
          ]),
          node("project:node:section-heading", "lib:definition:heading", [], {
            children: set("Section"),
          }),
        ],
        rootIds: ["project:node:section-header" as NodeId],
        newId: ctx.workspace.newId,
      }),
    );
    expect(ctx.fontOf("Section")).toEqual({ size: 14, weight: 700 });
  });

  it("an owner's size step keeps its own font", async () => {
    const { headingFont } = await withHeading(undefined, "S");
    expect(headingFont().size).toBe(14);
  });

  it("has no Size editor and no default size (S2 Heading has no `size`)", () => {
    const size = headingBinding.props.accepts.size as {
      default?: unknown;
      editorHidden?: boolean;
    };
    expect(size.default).toBeUndefined();
    expect(size.editorHidden).toBe(true);
  });

  it("the generated sheet's base Heading block writes no font size", () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        "../../packages/shared/src/components/styles/generated/Heading.css",
      ),
      "utf8",
    );
    const base = css.slice(css.indexOf(".react-aria-Heading {"));
    expect(base.slice(0, base.indexOf("}"))).not.toMatch(
      /font-size|line-height/,
    );
  });
});

const readRepo = (path: string) =>
  readFileSync(resolve(process.cwd(), "../..", path), "utf8");

/** Place a palette component on the page (as the palette does). */
async function placedPalette(type: string) {
  const { workspace, record } = await workspaceWithFrame();
  const definitionId = catalogPaletteDefinitionId(
    workspace.runtime.graph.library,
    type,
  ) as LibraryDefinitionId;
  const id = `project:node:placed-${type}` as NodeId;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id,
          definitionId,
          children: [],
          props: catalogCreationProps(
            workspace.runtime.graph,
            definitionId,
            type,
            {},
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [id],
      newId: workspace.newId,
    }),
  );
  return { workspace, record, id };
}

/** `text-font.md` (사용자 결정 2026-11-24) — the S2 reference cases the sweep found. */
describe("text-font rule — S2 reference cases", () => {
  it("the current Breadcrumb's words carry S2 `currentStyles` bold in the record", async () => {
    const { record } = await placedPalette("Breadcrumbs");
    const weight = (text: string) => {
      const found = record(text);
      return Number(found.derivedProps?.fontWeight ?? found.visual.fontWeight);
    };
    expect(weight("Page")).toBe(700);
    expect(weight("Home")).toBe(400);
  });

  it("a Disclosure's Heading is the browser's h3 of its row; its trigger has its own title font", async () => {
    const { workspace } = await placedPalette("Disclosure");
    const heading = [...workspace.root.canvasInputs.values()].find(
      (item) => workspace.root.typeOf(item) === "Heading",
    )!;
    // (S2 `headingStyle` declares no font: the row's 16 × 1.17, bold.)
    expect(Number(heading.derivedProps?.fontSize)).toBeCloseTo(18.72);
    expect(Number(heading.visual.fontWeight)).toBe(700);
    // (S2 `buttonStyles` `fontSize: title` — the words stay 16 · bold.)
    const inputs = [...workspace.root.canvasInputs.values()];
    const trigger = inputs.find(
      (item) =>
        workspace.root.typeOf(item) === "Button" && item.parentId === heading.id,
    )!;
    const title = inputs.find(
      (item) =>
        workspace.root.typeOf(item) === "Text" && item.parentId === trigger.id,
    )!;
    expect(Number(title.derivedProps?.fontSize ?? title.visual.fontSize)).toBe(16);
    expect(Number(title.visual.fontWeight)).toBe(700);
    const css = readRepo(
      "packages/shared/src/components/styles/generated/Disclosure.css",
    );
    const block = (selector: string) => {
      const at = css.indexOf(`${selector} {`);
      return at < 0 ? "" : css.slice(at, css.indexOf("}", at));
    };
    expect(block(".react-aria-Disclosure .react-aria-Heading")).not.toMatch(
      /font-size/,
    );
    expect(
      block(".react-aria-Disclosure .react-aria-Button[slot='trigger']"),
    ).not.toMatch(/font-size:\s*inherit/);
    for (const [size, step] of [
      ["S", "sm"],
      ["M", "base"],
      ["L", "lg"],
      ["XL", "xl"],
    ])
      expect(
        block(
          `.react-aria-Disclosure[data-size="${size}"] .react-aria-Button[slot='trigger']`,
        ),
      ).toMatch(new RegExp(`font-size: var\\(--catalog-token-text-${step}\\)`));
  });

  it("an owner's Heading weight is S2's: ContextualHelp `heading-xs` extra-bold 800, the `title-*` owners bold 700", async () => {
    // (S2 `spectrum-theme` fontWeight: `heading` = extra-bold 800 · `title` = bold 700.)
    const weightOf = async (type: string) => {
      const { workspace } = await placedPalette(type);
      const heading = [...workspace.root.canvasInputs.values()].find(
        (item) => workspace.root.typeOf(item) === "Heading",
      )!;
      return Number(heading.derivedProps?.fontWeight ?? heading.visual.fontWeight);
    };
    // S2 `ContextualHelp.tsx:44-48` `font: 'heading-xs'`.
    expect(await weightOf("ContextualHelp")).toBe(800);
    // S2 `Dialog.tsx:58-61` `title-2xl` · `IllustratedMessage.tsx:126-134` `title-*` ·
    //   `InlineAlert.tsx:171-173` `title-sm`.
    expect(await weightOf("Dialog")).toBe(700);
    expect(await weightOf("AlertDialog")).toBe(700);
    expect(await weightOf("FullscreenDialog")).toBe(700);
    expect(await weightOf("IllustratedMessage")).toBe(700);
    expect(await weightOf("InlineAlert")).toBe(700);
  });

  it("an owner's Heading size is S2's: the Dialogs' `title-2xl` 22, ContextualHelp `heading-xs` 18, CustomDialog none (RAC's h2)", async () => {
    const fontOf = async (type: string) => {
      const { workspace } = await placedPalette(type);
      const heading = [...workspace.root.canvasInputs.values()].find(
        (item) => workspace.root.typeOf(item) === "Heading",
      )!;
      return {
        size: Number(heading.derivedProps?.fontSize ?? heading.visual.fontSize),
        line: Number(heading.visual.lineHeight) * Number(heading.derivedProps?.fontSize ?? heading.visual.fontSize),
      };
    };
    // S2 `Dialog.tsx:58-61` (`HeadingContext` `:189`) — AlertDialog · FullscreenDialog are Dialogs.
    for (const type of ["Dialog", "AlertDialog", "FullscreenDialog"]) {
      const font = await fontOf(type);
      expect(font.size, type).toBe(22);
      expect(font.line, type).toBeCloseTo(26);
    }
    // S2 `ContextualHelp.tsx:44-48` `heading-xs` (18 · 22).
    expect((await fontOf("ContextualHelp")).size).toBe(18);
    // S2 `CustomDialog.tsx` gives its Heading nothing: RAC Dialog's title slot is an h2
    //   (`Dialog.mjs:136` level 2) — 1.5 × its parent's 16.
    expect((await fontOf("CustomDialog")).size).toBe(24);
  });

  it("no app reset or sheet takes the browser's h font away", () => {
    const publish = readRepo("apps/publish/src/styles/index.css");
    for (const block of publish.matchAll(/h6\s*\{([^}]*)\}/g))
      expect(block[1]).not.toMatch(/font-size|font-weight/);
    const content = readRepo(
      "packages/shared/src/components/styles/Content.css",
    );
    const heading = content.slice(content.indexOf(".react-aria-Heading {"));
    expect(heading.slice(0, heading.indexOf("}"))).not.toMatch(/font-/);
  });
});
