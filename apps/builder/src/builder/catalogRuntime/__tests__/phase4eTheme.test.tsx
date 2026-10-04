import "fake-indexeddb/auto";
import { lightColors, resolveToken } from "@composition/rendering";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
  ProjectEntry,
  ThemeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  createTheme,
  insertNodes,
  setThemeToken,
  updateTheme,
} from "../../../../../../packages/shared/src/catalog/commands";
import { renderHook } from "@testing-library/react";
import { installThemeMaps } from "../../../utils/theme/themeMaps";
import { createCatalogThemesHost } from "../../panels/themes/catalog/catalogThemesHost";
import { catalogAuthoredVisual, catalogLibraryVisual } from "../libraryVisual";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import {
  CATALOG_DEFAULT_THEME_PRESET,
  catalogThemeState,
  catalogThemesView,
} from "../theme";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4d-4 Themes: the active theme reaches resolution — its preset and tokens are
 * installed into the token maps, library token values are read again in the root's color mode,
 * and a theme step (and its undo) builds a new root. A project without a theme applies the default
 * preset (the Preview CSS's `--tint` default, not the build-time literal).
 */
const BODY = "project:node:home-body" as NodeId;
const BUTTON = "project:node:button" as NodeId;
const PRIMARY = "project:node:primary" as NodeId;
const THEME = "project:theme:t1" as EntryId<"theme">;
const read = (ref: string, mode: "light" | "dark") =>
  resolveToken(ref as `{color.${string}}`, mode) as string;

afterEach(() => installThemeMaps(null));

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:theme" as EntryId<"project">,
        name: "Theme",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-theme-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      theme: catalogThemeState,
    },
  );
  const button: NodeEntry = {
    kind: "node",
    id: BUTTON,
    definitionId: "lib:definition:type-Button",
    children: [],
    props: { variant: { kind: "set", value: "accent" } },
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  // The default (primary) variant: its fill is `{color.neutral}`, which dark mode changes.
  const primary: NodeEntry = { ...button, id: PRIMARY, props: {} };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [button, primary],
      rootIds: [BUTTON, PRIMARY],
      newId: workspace.newId,
    }),
  );
  const fillOf = (id: NodeId) => () => {
    const record = workspace.root.recordsOfSource(id)[0];
    return workspace.root.domInputs.get(record)?.visual.fill;
  };
  const fill = fillOf(BUTTON);
  // The accent variant's fill is built from `{color.accent}` (`lib:token:color_accent_light`).
  return {
    workspace,
    fill,
    primaryFill: fillOf(PRIMARY),
    fillRef: "{color.accent}",
  };
}

const theme = (preset: Partial<ThemeEntry["preset"]> = {}): ThemeEntry => ({
  kind: "theme",
  id: THEME,
  name: "Brand",
  tokenIds: [],
  preset: { ...CATALOG_DEFAULT_THEME_PRESET, ...preset },
});

describe("ADR-248 Phase 4e-4d-4 Themes", () => {
  it("a library token keeps the theme token it was read from", async () => {
    const library = await buildCodeCatalogLibrary();
    const token = [...library.tokens.values()].find(
      (item) => item.ref === "{color.accent}",
    );
    expect(token?.value).toBe(read("{color.accent}", "light"));
  });

  it("no theme applies the default preset (the Preview's tint derivation, not the build literal)", async () => {
    const literal = read("{color.accent}", "light");
    const { workspace, fill, fillRef } = await open();
    expect(workspace.root.colorMode).toBe("light");
    expect(fill()).toBe(read(fillRef, "light"));
    const derived = read("{color.accent}", "light");
    expect(derived).not.toBe(literal);
    expect(derived).toBe("#3660f0");
    expect(catalogThemesView(workspace.runtime.graph)).toMatchObject({
      active: "catalog:theme:default",
      order: ["catalog:theme:default"],
    });
  });

  it("activating a dark theme builds a dark root; its tint and tokens reach the drawn values; undo restores", async () => {
    const { workspace, fill, primaryFill, fillRef } = await open();
    const defaultFill = fill();
    const lightNeutral = primaryFill();
    const defaultAccent = read("{color.accent}", "light");
    const before = workspace.root;
    workspace.execute(
      createTheme({ theme: theme({ darkMode: "dark" }), activate: true }),
    );
    expect(workspace.root).not.toBe(before);
    expect(workspace.root.colorMode).toBe("dark");
    expect(fill()).toBe(read(fillRef, "dark"));
    expect(primaryFill()).toBe(read("{color.neutral}", "dark"));
    expect(primaryFill()).not.toBe(lightNeutral);

    // The tint reaches the maps; the fill follows its token in light mode.
    workspace.execute(
      updateTheme({ id: THEME, preset: { darkMode: "light", tint: "red" } }),
    );
    expect(workspace.root.colorMode).toBe("light");
    const red = fill();
    expect(red).toBe(read(fillRef, "light"));
    expect(red).not.toBe(defaultFill);

    // A theme `color.accent` token replaces the tint (the accent derived from that hex).
    workspace.execute(
      setThemeToken({
        themeId: THEME,
        name: "color.accent",
        value: { tokenType: "color", value: "#00aa00" },
        newId: workspace.newId,
      }),
    );
    expect(fill()).toBe(read(fillRef, "light"));
    expect(fill()).not.toBe(red);

    workspace.undo();
    expect(fill()).toBe(red);
    workspace.undo();
    workspace.undo();
    expect(workspace.root.colorMode).toBe("light");
    expect(fill()).toBe(defaultFill);
    expect(primaryFill()).toBe(lightNeutral);
    expect(lightColors.accent).toBe(defaultAccent);
  });

  it("a rule-backed node's definition values stay unauthored in a dark red xl theme", async () => {
    const { workspace } = await open();
    const card = "project:node:card" as NodeId;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: card,
            definitionId: "lib:definition:type-Card",
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [card],
        newId: workspace.newId,
      }),
    );
    workspace.execute(
      createTheme({
        theme: theme({ darkMode: "dark", tint: "red", radius: "xl" }),
        activate: true,
      }),
    );
    const record = workspace.root.domInputs.get(
      workspace.root.recordsOfSource(card)[0],
    )!;
    expect(record.ruleId).toBeTruthy();
    // Its radius token reads the xl scale (16, the build-time value is 12), and the definition
    // value the executor compares against reads it the same way.
    expect(record.visual.radius).toBe(16);
    expect(catalogLibraryVisual(workspace.root, record).radius).toBe(16);
    expect(catalogAuthoredVisual(workspace.root, record)).toEqual({});
  });

  it("a step that does not touch the theme keeps the root", async () => {
    const { workspace } = await open();
    workspace.execute(createTheme({ theme: theme(), activate: true }));
    const root = workspace.root;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: "project:node:second" as NodeId,
            definitionId: "lib:definition:type-Button",
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: ["project:node:second" as NodeId],
        newId: workspace.newId,
      }),
    );
    expect(workspace.root).toBe(root);
  });
});

describe("ADR-248 Phase 4e-4d-4 Themes panel host", () => {
  const project = (workspace: CatalogWorkspace) =>
    workspace.runtime.graph.getEntry(workspace.projectId) as ProjectEntry;

  it("the first edit of the virtual default theme creates an active theme with it (one step)", async () => {
    const { workspace } = await open();
    const host = createCatalogThemesHost(workspace);
    const graph = workspace.runtime.graph;
    const { result, rerender } = renderHook(() => ({
      themes: host.useThemes(),
      preset: host.useActivePreset(),
      typography: host.useBaseTypography(),
    }));
    expect(result.current.preset).toMatchObject({
      tint: "blue",
      radiusScale: "md",
    });
    expect(result.current.typography.fontSize).toBe(16);
    // Nothing to change: no step.
    const revision = graph.revision;
    expect(host.setActiveThemePreset({ tint: "blue" })).toBe(false);
    expect(host.removeTheme(result.current.themes!.active)).toBe(false);
    expect(graph.revision).toBe(revision);

    expect(host.setActiveThemePreset({ tint: "red", radiusScale: "lg" })).toBe(
      true,
    );
    expect(graph.revision).toBe(revision + 1);
    rerender();
    const [id] = project(workspace).themeIds;
    expect(project(workspace).activeThemeId).toBe(id);
    expect(result.current.themes!.active).toBe(id);
    expect(result.current.preset).toMatchObject({
      tint: "red",
      radiusScale: "lg",
      neutral: "neutral",
    });
    expect(graph.getEntry(id as EntryId<"theme">)).toMatchObject({
      preset: { tint: "red", radius: "lg" },
    });
    workspace.undo();
    expect(project(workspace).themeIds).toEqual([]);
  });

  it("list actions: duplicate (the virtual theme too, one step) · activate · rename · remove", async () => {
    const { workspace } = await open();
    const host = createCatalogThemesHost(workspace);
    const graph = workspace.runtime.graph;
    const revision = graph.revision;
    const copy = host.addThemeFromActive();
    expect(graph.revision).toBe(revision + 1);
    const [base, second] = project(workspace).themeIds;
    expect(second).toBe(copy);
    expect(project(workspace).activeThemeId).toBe(copy);
    expect(graph.getEntry(copy as EntryId<"theme">)).toMatchObject({
      name: "Default copy",
    });

    host.setThemeToken(copy!, "color.accent", {
      type: "color",
      value: "#00aa00",
      source: "spec-token",
    });
    const third = host.addThemeFromActive("Third");
    const thirdTheme = graph.getEntry(third as EntryId<"theme">) as ThemeEntry;
    expect(thirdTheme.name).toBe("Third");
    expect(thirdTheme.tokenIds).toHaveLength(1);

    expect(host.setActiveTheme(base!)).toBe(true);
    expect(project(workspace).activeThemeId).toBe(base);
    expect(host.renameTheme(base!, "  Brand ")).toBe(true);
    expect(graph.getEntry(base as EntryId<"theme">)).toMatchObject({
      name: "Brand",
    });
    expect(host.renameTheme(base!, "Brand")).toBe(false);
    expect(host.removeTheme(base!)).toBe(true);
    expect(project(workspace).themeIds).toEqual([copy, third]);
    expect(project(workspace).activeThemeId).toBe(copy);
  });

  it("token overrides and base typography: add · change · drop; a seed value drops the override", async () => {
    const { workspace } = await open();
    const host = createCatalogThemesHost(workspace);
    const graph = workspace.runtime.graph;
    // On the virtual theme: a new theme holding the token.
    expect(
      host.setThemeToken("catalog:theme:default", "radius.md", {
        type: "number",
        value: 9,
        source: "spec-token",
      }),
    ).toBe(true);
    const [id] = project(workspace).themeIds;
    const theme = () => graph.getEntry(id as EntryId<"theme">) as ThemeEntry;
    expect(theme().tokenIds).toHaveLength(1);
    host.setThemeToken(id!, "radius.md", {
      type: "number",
      value: 10,
      source: "spec-token",
    });
    expect(graph.getEntry(theme().tokenIds[0]!)).toMatchObject({
      name: "radius.md",
      tokenType: "number",
      value: 10,
    });
    host.setThemeToken(id!, "radius.md", null);
    expect(theme().tokenIds).toEqual([]);
    expect(project(workspace).tokenIds).toEqual([]);

    const revision = graph.revision;
    host.setActiveThemeBaseTypography({ fontSize: 18, lineHeight: 1.6 });
    expect(graph.revision).toBe(revision + 1);
    const { result } = renderHook(() => host.useBaseTypography());
    expect(result.current).toMatchObject({ fontSize: 18, lineHeight: 1.6 });
    host.setActiveThemeBaseTypography({ fontSize: 16 });
    expect(
      theme().tokenIds.map(
        (token) => (graph.getEntry(token) as { name: string }).name,
      ),
    ).toEqual(["typography.base-line-height"]);
  });
});
