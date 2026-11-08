import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTheme,
  setFields,
  setNodeAttribute,
  setFillSizing,
  setWholeField,
  updateTheme,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  CatalogFillLayer,
  NodeEntry,
  NodeId,
  ProjectEntry,
  ThemeEntry,
  TokenEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { codeViewFileTree } from "../../../../../../packages/shared/src/codeView/files/tree";
import { codeViewTokenVar } from "../../../../../../packages/shared/src/codeView/files/styles";
import { resolveThemeSnapshot } from "../../../../../../packages/shared/src/catalog/runtime/resolveThemeSnapshot";
import {
  createThemeDefinition,
  DEFAULT_THEME_PRESET,
} from "@composition/shared";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../builder/fonts/customFonts";
import {
  catalogCodeViewFileBaseline,
  catalogCodeViewProjectApply,
  catalogCodeViewProjectSession,
  type CatalogCodeViewProjectSession,
} from "../../../builder/catalogRuntime/codeViewApply";
import {
  BODY,
  editorChanges,
  openAdr296,
  type Adr296Harness,
} from "./support/adr296Harness";

/**
 * ADR-296 Phase 4 (G1 · G2 · G3 — R3) — the style files: `src/pages/<Page>.css` (one class per
 * node — 사용자 결정 1 · 6) and `src/theme.css`. The oracle is the Canvas's resolved input
 * (`root.canvasInputs` · `getLayoutInput` at desktop · tablet · mobile — Phase 0's entry point),
 * not the CSS text: a document's style taken away and pasted back from its CSS draws the same; an
 * edit is the Design panel's command (the same document); the forced theme is the node's field
 * (review h2), never a `[data-theme]` condition.
 */
afterEach(() => vi.restoreAllMocks());

const CSS = "src/pages/Home.css";
const TSX = "src/pages/Home.tsx";
const THEME = "src/theme.css";

async function open() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return openAdr296();
}
function session(h: Adr296Harness) {
  const s = catalogCodeViewProjectSession(h.graph());
  for (const file of codeViewFileTree(h.graph()))
    catalogCodeViewFileBaseline(s, h.graph(), file.path);
  return s;
}
const code = (s: CatalogCodeViewProjectSession, path: string) =>
  s.baselines.get(path)?.result.code ?? "";
function apply(
  h: Adr296Harness,
  s: CatalogCodeViewProjectSession,
  edits: Record<string, (code: string) => string>,
) {
  return catalogCodeViewProjectApply(
    h.workspace,
    s,
    Object.entries(edits).map(([path, edit]) => {
      const before = code(s, path);
      const edited = edit(before);
      return { path, edited, changes: editorChanges(before, edited) };
    }),
  );
}
const history = (h: Adr296Harness) => h.workspace.runtime.historyDepth.undo;
const node = (h: Adr296Harness, id: string) =>
  h.graph().getEntry(id) as NodeEntry;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
/** The project's theme (the harness starts with none — a new project's first). */
function withTheme(h: Adr296Harness, name = "Default") {
  const id = h.workspace.newId("theme") as ThemeEntry["id"];
  h.run(
    createTheme({
      theme: {
        kind: "theme",
        id,
        name,
        tokenIds: [],
        preset: {
          tint: "blue",
          neutral: "slate",
          radius: "md",
          darkMode: "light",
        },
      },
      activate: true,
    }),
  );
  return id;
}

/** The oracle (G3): what the Canvas reads of a node at each breakpoint. */
function resolved(h: Adr296Harness, id: string) {
  const out: Record<string, unknown> = {};
  for (const breakpoint of ["desktop", "tablet", "mobile"] as const) {
    h.workspace.setBreakpoint(breakpoint);
    const root = h.workspace.root;
    const [record] = root.recordsOfSource(id);
    if (!record) {
      out[breakpoint] = "hidden";
      continue;
    }
    const input = root.canvasInputs.get(record)!;
    out[breakpoint] = JSON.parse(
      JSON.stringify({
        visual: input.visual,
        // (A layer's id is the panel's handle, not a paint value.)
        fills: (input as { fills?: { id: string }[] }).fills?.map(
          ({ id: _id, ...layer }) => layer,
        ),
        themeOverride: (input as { themeOverride?: unknown }).themeOverride,
        layout: root.getLayoutInput(record),
      }),
    );
  }
  h.workspace.setBreakpoint("desktop");
  return out;
}

const LINEAR: CatalogFillLayer = {
  id: "f-a",
  kind: "linear-gradient",
  enabled: true,
  opacity: 1,
  blendMode: "normal",
  rotation: 90,
  stops: [
    { color: "#ff0000ff", position: 0 },
    { color: "#0000ffff", position: 1 },
  ],
};

/** A styled frame and text — every Phase 4 form at once (Design panel commands). */
function style(h: Adr296Harness) {
  const frame = h.add("frame");
  const text = h.add("Text", { children: "Hello" }, frame);
  const target = (id: NodeId) => [{ kind: "node" as const, id }];
  h.run(
    setFields({
      targets: target(frame),
      visual: {
        gap: set(12),
        paddingTop: set(8),
        backgroundColor: set("#fafafa"),
        radius: set(6),
      },
      layout: { display: set("flex"), flexDirection: set("column") },
      sizing: { width: set(320) },
    }),
  );
  h.run(
    setFields({
      targets: target(frame),
      breakpoint: "tablet",
      visual: { gap: set(8) },
      layout: { flexDirection: set("row") },
    }),
  );
  h.run(
    setFields({
      targets: target(frame),
      breakpoint: "mobile",
      sizing: { width: set(200) },
    }),
  );
  h.run(
    setWholeField({ targets: target(frame), field: "fills", value: [LINEAR] }),
  );
  h.run(
    setFillSizing({
      targets: target(text),
      axis: "width",
      value: { factor: 1 },
    }),
  );
  h.run(
    setFields({
      targets: target(text),
      visual: {
        color: set("#333333"),
        fontSize: set(18),
        lineHeight: set(1.5),
      },
    }),
  );
  h.run(
    setWholeField({
      targets: target(text),
      field: "themeOverride",
      value: { mode: "dark", tint: "blue" },
    }),
  );
  h.run(
    setWholeField({
      targets: target(text),
      field: "visibility",
      value: { mobile: false },
    }),
  );
  return { frame, text, steps: 8 };
}

describe("ADR-296 Phase 4 — page style · theme files", () => {
  it("the CSS file: one class per styled node, the media layers, the forced theme, the fills", async () => {
    const h = await open();
    const { frame, text } = style(h);
    const s = session(h);
    const css = code(s, CSS);
    expect(css).toContain(
      ".frame {\n  gap: 12px;\n  padding-top: 8px;\n  background-color: #fafafa;\n  border-radius: 6px;\n  display: flex;\n  flex-direction: column;\n  width: 320px;\n  background: linear-gradient(90deg, #ff0000ff 0%, #0000ffff 100%);\n}",
    );
    expect(css).toContain(
      ".text {\n  color: #333333;\n  font-size: 18px;\n  line-height: 1.5;\n  --fill-width: 1;\n  color-scheme: dark;\n  --theme-tint: blue;\n}",
    );
    expect(css).toContain(
      "@media (max-width: 1279px) {\n  .frame {\n    gap: 8px;\n    flex-direction: row;\n  }\n}",
    );
    expect(css).toContain(
      "@media (max-width: 767px) {\n  .frame {\n    width: 200px;\n  }\n\n  .text {\n    display: none;\n  }\n}",
    );
    // The page's JSX names the classes and imports the file.
    const tsx = code(s, TSX);
    expect(tsx).toContain("import './Home.css';");
    expect(tsx).toMatch(/<div className="frame">/);
    expect(tsx).toMatch(/<Text className="text">Hello<\/Text>/);
    void frame;
    void text;
  });

  it("strict: the CSS · theme · page files pasted over themselves plan nothing", async () => {
    const h = await open();
    style(h);
    const s = session(h);
    const revision = h.graph().revision;
    const result = catalogCodeViewProjectApply(
      h.workspace,
      s,
      [CSS, THEME, TSX].map((path) => ({
        path,
        edited: code(s, path),
        changes: [],
      })),
    );
    expect(result.rejected).toEqual([]);
    expect(h.graph().revision).toBe(revision);
  });

  it("G3 — the style taken away and pasted back from its CSS draws the same (3 breakpoints)", async () => {
    const h = await open();
    const { frame, text, steps } = style(h);
    const s0 = session(h);
    const css = code(s0, CSS);
    const before = { frame: resolved(h, frame), text: resolved(h, text) };
    for (let index = 0; index < steps; index += 1) h.workspace.undo();
    expect(node(h, frame).fills).toBeUndefined();
    expect(code(session(h), CSS)).toBe("");
    // (The nodes are the same — their classes too: the CSS names them.)
    const s = session(h);
    const result = apply(h, s, { [CSS]: () => css });
    expect(result.rejected).toEqual([]);
    expect({ frame: resolved(h, frame), text: resolved(h, text) }).toEqual(
      before,
    );
    expect(node(h, text).themeOverride).toEqual({ mode: "dark", tint: "blue" });
    expect(node(h, text).visibility).toEqual({ mobile: false });
  });

  it("an edit is the Design panel's command — the same document (color · gap · padding · tablet · fills)", async () => {
    // The code's edit …
    const a = await open();
    const textA = a.add("Text", { children: "A" });
    a.run(
      setFields({
        targets: [{ kind: "node", id: textA }],
        visual: { color: set("#111111") },
      }),
    );
    let s = session(a);
    const before = history(a);
    const result = apply(a, s, {
      [CSS]: (css) =>
        css
          .replace(
            "color: #111111;",
            "color: #ff0000;\n  gap: 4px;\n  padding: 8px;",
          )
          .concat(
            "\n@media (max-width: 1279px) {\n  .text {\n    color: #00ff00;\n  }\n}\n",
          ),
    });
    expect(result.rejected).toEqual([]);
    expect(history(a)).toBe(before + 1);
    // … and the panel's: the same fields.
    const b = await open();
    const textB = b.add("Text", { children: "A" });
    b.run(
      setFields({
        targets: [{ kind: "node", id: textB }],
        visual: { color: set("#111111") },
      }),
    );
    b.run(
      setFields({
        targets: [{ kind: "node", id: textB }],
        visual: {
          color: set("#ff0000"),
          gap: set(4),
          paddingTop: set(8),
          paddingRight: set(8),
          paddingBottom: set(8),
          paddingLeft: set(8),
        },
      }),
    );
    b.run(
      setFields({
        targets: [{ kind: "node", id: textB }],
        breakpoint: "tablet",
        visual: { color: set("#00ff00") },
      }),
    );
    const fields = (n: NodeEntry) => ({
      visual: n.visual,
      responsive: n.responsive,
      layout: n.layout,
      sizing: n.sizing,
    });
    expect(fields(node(a, textA))).toEqual(fields(node(b, textB)));
    // A fill layer (the Fill panel's `setWholeField`).
    s = session(a);
    expect(
      apply(a, s, {
        [CSS]: (css) =>
          css.replace(
            "  gap: 4px;",
            "  gap: 4px;\n  background: linear-gradient(90deg, #ff0000ff 0%, #0000ffff 100%);",
          ),
      }).rejected,
    ).toEqual([]);
    expect(node(a, textA).fills).toEqual([{ ...LINEAR, id: "fill-1" }]);
  });

  it("a token is `var(--…)` — the name the generated catalog CSS reads (ADR-295)", async () => {
    const h = await open();
    const text = h.add("Text", { children: "T" });
    const tokenId = [...h.library.tokens.values()].find(
      (token) => token.ref === "{radius.md}",
    )?.id;
    expect(tokenId).toBeDefined();
    h.run(
      setFields({
        targets: [{ kind: "node", id: text }],
        visual: { radius: set({ kind: "token", tokenId: tokenId! }) },
      }),
    );
    const s = session(h);
    expect(code(s, CSS)).toContain(
      "border-radius: var(--catalog-token-radius-md);",
    );
    // Edited to another token by its CSS name.
    const lg = [...h.library.tokens.values()].find(
      (token) => token.ref === "{radius.lg}",
    )!.id;
    const result = apply(h, s, {
      [CSS]: (css) =>
        css.replace(
          "var(--catalog-token-radius-md)",
          "var(--catalog-token-radius-lg)",
        ),
    });
    expect(result.rejected).toEqual([]);
    // (ADR-298 D2 — the theme-independent scale id, the same ref as the rule token's.)
    expect(node(h, text).visual.radius).toEqual(
      set({ kind: "token", tokenId: "lib:token:radius_lg" }),
    );
    expect(h.library.tokens.get("lib:token:radius_lg" as never)?.ref).toBe(
      h.library.tokens.get(lg)?.ref,
    );
  });

  it("사용자 조건 2 (ADR-295) — a token's `var(--…)` is a variable the resolver declares, and a size one has its touch value too", async () => {
    const h = await open();
    const snapshot = resolveThemeSnapshot(
      createThemeDefinition("t", "T", DEFAULT_THEME_PRESET, {}),
      { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
    );
    const desktop = new Set(snapshot.cssVars.map((item) => item.name));
    const touch = new Set(snapshot.touchCssVars.map((item) => item.name));
    const checked: string[] = [];
    for (const token of h.library.tokens.values()) {
      const ref = token.ref;
      if (!ref || !/^\{(radius|size)\./.test(ref)) continue;
      const name = /^var\((--[\w-]+)\)$/.exec(
        codeViewTokenVar(h.graph() as never, token.id),
      )?.[1];
      expect(name, ref).toBeDefined();
      expect(desktop.has(name!), `${ref} → ${name} (desktop)`).toBe(true);
      // ADR-295 Decision 2 — a control size has a touch value (S2 scale 1.25): the code names the
      // variable, so the device's value stays the resolver's.
      if (ref.startsWith("{size.height."))
        expect(touch.has(name!), `${ref} → ${name} (touch)`).toBe(true);
      checked.push(ref);
    }
    expect(checked.some((ref) => ref.startsWith("{radius."))).toBe(true);
  });

  it("themeOverride (h2) — forced light/dark · tint, cleared, one key; `[data-theme]` is not page CSS", async () => {
    const h = await open();
    const text = h.add("Text", { children: "T" });
    const themeId = withTheme(h);
    const cases: [string, string, NodeEntry["themeOverride"]][] = [
      ["light", "", { mode: "dark", tint: "blue" }],
      ["dark", "", { mode: "light" }],
      ["light", "", { tint: "green" }],
      ["light", "", undefined],
    ];
    for (const [global, , want] of cases) {
      h.run(
        updateTheme({
          id: themeId as never,
          preset: { darkMode: global as "light" | "dark" },
        }),
      );
      const s = session(h);
      const decls = [
        want?.mode ? `  color-scheme: ${want.mode};` : "",
        want?.tint ? `  --theme-tint: ${want.tint};` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const result = apply(h, s, {
        [CSS]: () => (decls ? `.text {\n${decls}\n}\n` : ""),
      });
      expect(result.rejected).toEqual([]);
      expect(node(h, text).themeOverride).toEqual(want);
    }
    const s = session(h);
    const refused = apply(h, s, {
      [CSS]: () => '[data-theme="dark"] .text {\n  color: red;\n}\n',
    });
    expect(refused.rejected.map((line) => line.reason)).toContain(
      "outsideVocabulary",
    );
  });

  it("read only: a value the CSS cannot hold keeps its marker (deleted → refused); a state style has no command; a catalog sheet", async () => {
    const h = await open();
    const frame = h.add("frame");
    h.run(
      setWholeField({
        targets: [{ kind: "node", id: frame }],
        field: "fills",
        value: [
          {
            id: "r",
            kind: "radial-gradient",
            enabled: true,
            opacity: 1,
            blendMode: "normal",
            stops: [
              { color: "#ff0000ff", position: 0 },
              { color: "#0000ffff", position: 1 },
            ],
            center: { x: 0.5, y: 0.5 },
            radius: { width: 0.5, height: 0.5 },
          },
        ],
      }),
    );
    let s = session(h);
    expect(code(s, CSS)).toContain("/* composition: fills — Design panel */");
    // Kept → nothing; a color beside it → applied (the marker stays).
    expect(
      apply(h, s, {
        [CSS]: (css) =>
          css.replace("Design panel */", "Design panel */\n  color: #222222;"),
      }).rejected,
    ).toEqual([]);
    expect(node(h, frame).fills?.[0]?.kind).toBe("radial-gradient");
    s = session(h);
    const removed = apply(h, s, {
      [CSS]: (css) =>
        css.replace("  /* composition: fills — Design panel */\n", ""),
    });
    expect(removed.rejected.map((line) => line.reason)).toContain(
      "readOnlyFile",
    );
    // A state (`[data-hovered]`) on a page node: no Design panel command → refused.
    s = session(h);
    const hover = apply(h, s, {
      [CSS]: (css) => `${css}\n.frame[data-hovered] {\n  color: red;\n}\n`,
    });
    expect(hover.rejected.map((line) => line.reason)).toContain("notInCode");
    // ADR-301 Decision 7 — the catalog rule sheets are not listed (not project code; the Design
    // panel shows the values); the Library origin's file stays.
    h.add("Button");
    h.add("Popover");
    const tree = codeViewFileTree(h.graph());
    expect(
      tree.filter((file) => file.path.startsWith("node_modules/@composition/catalog/")),
    ).toEqual([]);
    expect(
      tree.some((file) => file.path === "node_modules/@composition/library/Popover.tsx"),
    ).toBe(true);
  });

  it("G2 — the JSX moves two styled nodes and the CSS restyles one, in one Apply (classes are the baseline's)", async () => {
    const h = await open();
    const a = h.add("Text", { children: "A" });
    const b = h.add("Text", { children: "B" });
    for (const [id, color] of [
      [a, "#ff0000"],
      [b, "#0000ff"],
    ] as const)
      h.run(
        setFields({
          targets: [{ kind: "node", id }],
          visual: { color: set(color) },
        }),
      );
    const s = session(h);
    const before = history(h);
    const result = apply(h, s, {
      [TSX]: (tsx) => {
        const lineA = '      <Text className="text">A</Text>\n';
        const lineB = '      <Text className="text-2">B</Text>\n';
        return tsx.replace(lineA + lineB, lineB + lineA);
      },
      // `.text` is A (the baseline's class) — after the move the document numbers it `text-2`.
      [CSS]: (css) => css.replace("color: #ff0000;", "color: #00ff00;"),
    });
    expect(result.rejected).toEqual([]);
    expect(history(h)).toBe(before + 1);
    expect(h.node(BODY).children).toEqual([b, a]);
    expect(node(h, a).visual.color).toEqual(set("#00ff00"));
    expect(node(h, b).visual.color).toEqual(set("#0000ff"));
  });

  it("a node styled for the first time from the CSS gains its class in the JSX", async () => {
    const h = await open();
    const button = h.add("Button");
    const s = session(h);
    expect(code(s, TSX)).not.toContain("className");
    const result = apply(h, s, {
      [CSS]: () => ".button {\n  margin-top: 4px;\n}\n",
    });
    expect(result.rejected).toEqual([]);
    expect(node(h, button).layout).toEqual({ marginTop: set("4px") });
    expect(h.code()).toContain('<Button className="button"');
  });

  it("theme.css — a theme's preset · tokens · name · a new theme (the Themes panel's commands)", async () => {
    const h = await open();
    withTheme(h);
    const project = () =>
      h.graph().getEntry(h.graph().projectId) as ProjectEntry;
    const themes = () =>
      project().themeIds.map((id) => h.graph().getEntry(id) as ThemeEntry);
    const first = themes()[0]!;
    const s = session(h);
    const css = code(s, THEME);
    expect(css).toContain(`[data-theme="${first.name}"] {`);
    expect(css).toMatch(/--theme-tint: \w+;/);
    const result = apply(h, s, {
      [THEME]: (text) =>
        text
          .replace(`[data-theme="${first.name}"]`, '[data-theme="Brand"]')
          .replace(
            /--theme-tint: \w+;/,
            "--theme-tint: purple;\n  --brand-gap: 12px;\n  --brand-ink: #123456;",
          )
          .concat(
            '\n[data-theme="Night"] {\n  color-scheme: dark;\n  --theme-tint: cyan;\n  --theme-neutral: zinc;\n  --theme-radius: lg;\n}\n',
          ),
    });
    expect(result.rejected).toEqual([]);
    const brand = themes()[0]!;
    expect(brand).toMatchObject({ id: first.id, name: "Brand" });
    expect(brand.preset.tint).toBe("purple");
    const tokens = brand.tokenIds.map(
      (id) => h.graph().getEntry(id) as TokenEntry,
    );
    expect(
      tokens
        .filter((token) => token.name.startsWith("brand"))
        .map(({ name, tokenType, value }) => ({ name, tokenType, value })),
    ).toEqual([
      { name: "brand-gap", tokenType: "length", value: 12 },
      { name: "brand-ink", tokenType: "color", value: "#123456" },
    ]);
    expect(themes().at(-1)).toMatchObject({
      name: "Night",
      preset: { tint: "cyan", neutral: "zinc", radius: "lg", darkMode: "dark" },
    });
    // A token changed · removed.
    const s2 = session(h);
    expect(
      apply(h, s2, {
        [THEME]: (text) =>
          text
            .replace("--brand-gap: 12px;", "--brand-gap: 16px;")
            .replace("\n  --brand-ink: #123456;", ""),
      }).rejected,
    ).toEqual([]);
    const after = themes()[0]!.tokenIds.map(
      (id) => h.graph().getEntry(id) as TokenEntry,
    );
    expect(after.find((token) => token.name === "brand-gap")?.value).toBe(16);
    expect(after.some((token) => token.name === "brand-ink")).toBe(false);
  });

  // ── 판독 Phase 4 (HIGH 1 · MEDIUM 3) ──
  it("판독 HIGH-1 — an unstyled node's author class equal to its node class survives an unrelated JSX edit", async () => {
    const h = await open();
    const button = h.add("Button");
    h.add("Text", { children: "Other" });
    h.run(
      setNodeAttribute({ id: button, field: "className", value: "button" }),
    );
    const s = session(h);
    expect(code(s, TSX)).toContain('className="button"');
    const result = apply(h, s, {
      [TSX]: (tsx) => tsx.replace(">Other</Text>", ">Changed</Text>"),
    });
    expect(result.rejected).toEqual([]);
    expect(node(h, button).metadata?.className).toBe("button");
  });

  it("판독 MEDIUM-1 — two fields on one property (layout display · visibility): the first one's edit is not lost", async () => {
    const h = await open();
    const frame = h.add("frame");
    h.run(
      setFields({
        targets: [{ kind: "node", id: frame }],
        layout: { display: set("flex") },
      }),
    );
    h.run(
      setWholeField({
        targets: [{ kind: "node", id: frame }],
        field: "visibility",
        value: { desktop: false },
      }),
    );
    const s = session(h);
    const result = apply(h, s, {
      [CSS]: (css) => css.replace("display: flex;", "display: grid;"),
    });
    expect(result.rejected).toEqual([]);
    expect(node(h, frame).layout?.display).toEqual(set("grid"));
    expect(node(h, frame).visibility).toEqual({ desktop: false });
    // The same property written twice in a block is refused (CSS keeps one — the code would lose one).
    const twice = apply(h, session(h), {
      [CSS]: (css) =>
        css.replace("display: grid;", "display: grid;\n  display: block;"),
    });
    expect(twice.rejected.map((line) => line.reason)).toContain(
      "outsideVocabulary",
    );
  });

  it("판독 MEDIUM-2 — `line-height: 24px` is read as the ratio to the font size (not refused)", async () => {
    const h = await open();
    const text = h.add("Text", { children: "T" });
    h.run(
      setFields({
        targets: [{ kind: "node", id: text }],
        visual: { fontSize: set(16), lineHeight: set(1.5) },
      }),
    );
    const s = session(h);
    const result = apply(h, s, {
      [CSS]: (css) => css.replace("line-height: 1.5;", "line-height: 32px;"),
    });
    expect(result.rejected).toEqual([]);
    expect(node(h, text).visual.lineHeight).toEqual(set(2));
  });

  it("판독 MEDIUM-3 — a block whose fills only the Design panel holds refuses a new `background`", async () => {
    const h = await open();
    const frame = h.add("frame");
    h.run(
      setWholeField({
        targets: [{ kind: "node", id: frame }],
        field: "fills",
        value: [{ ...LINEAR, opacity: 0.5 }],
      }),
    );
    const s = session(h);
    const result = apply(h, s, {
      [CSS]: (css) =>
        css.replace(
          "Design panel */",
          "Design panel */\n  background: #ff0000;",
        ),
    });
    expect(result.rejected.map((line) => line.reason)).toContain(
      "readOnlyFile",
    );
    expect(node(h, frame).fills?.[0]?.opacity).toBe(0.5);
  });

  it("수리 검증 MEDIUM — a hidden flex frame: removing `display: flex` is applied (`--visible` → `display: none`)", async () => {
    const h = await open();
    const frame = h.add("frame");
    h.run(
      setFields({
        targets: [{ kind: "node", id: frame }],
        layout: { display: set("flex") },
      }),
    );
    h.run(
      setWholeField({
        targets: [{ kind: "node", id: frame }],
        field: "visibility",
        value: { desktop: false },
      }),
    );
    const s = session(h);
    expect(code(s, CSS)).toContain("--visible: false;");
    const result = apply(h, s, {
      [CSS]: (css) => css.replace("  display: flex;\n", ""),
    });
    expect(result.rejected).toEqual([]);
    expect(node(h, frame).layout?.display).toBeUndefined();
    expect(node(h, frame).visibility).toEqual({ desktop: false });
  });
});
