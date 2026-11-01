/**
 * ADR-296 Phase 4 (G3 · R3) — the style files read back: `src/pages/<Page>.css` and
 * `src/theme.css`. A declaration that changed is the Design panel's write — the Styles panel's CSS
 * key table (`catalogStyleWrites`) for its keys, the field itself for a `--<field>` property, a
 * token for a `var(--…)` the project or the library names — through the same commands
 * (`setFields` at the block's breakpoint · `setWholeField` for the fills, the forced theme and the
 * visibility · `setFillSizing`). A theme block is the Themes panel's commands (`createTheme` ·
 * `removeTheme` · `updateTheme` · `setThemeToken`). The code writes exactly what it says: the
 * panel's one-field conveniences (a border's companion style · color) are not added.
 */
import {
  createTheme,
  removeTheme,
  setFields,
  setFillSizing,
  setThemeToken,
  setWholeField,
  updateTheme,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  AuthoredValue,
  BreakpointName,
  CatalogFillLayer,
  EditTarget,
  EntryId,
  NodeEntry,
  NodeId,
  NodeThemeOverride,
  ProjectEntry,
  StateName,
  ThemeEntry,
  ThemePreset,
  TokenEntry,
  TokenType,
  VisualField,
  WriteValue,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogReader } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import { descendantPatchOf } from "../../../../../packages/shared/src/catalog/document/types";
import {
  codeViewAddressOf,
  codeViewSameAddress,
} from "../../../../../packages/shared/src/codeView/files/overrides";
import {
  CODE_VIEW_BREAKPOINT_MEDIA,
  type CodeViewStyleSource,
  CODE_VIEW_DESIGN_PANEL_MARKER,
  CODE_VIEW_FILL_SIZING_CSS,
  CODE_VIEW_FILLS_CSS,
  CODE_VIEW_LAYOUT_CSS,
  CODE_VIEW_STATE_SELECTORS,
  CODE_VIEW_THEME_MODE_CSS,
  CODE_VIEW_SIZING_CSS,
  CODE_VIEW_THEME_TINT_CSS,
  CODE_VIEW_VISIBLE_CSS,
  CODE_VIEW_VISUAL_CSS,
  codeViewFillsOf,
  codeViewNodeClasses,
  codeViewTokenVar,
  generatePageStyleFile,
} from "../../../../../packages/shared/src/codeView/files/styles";
import {
  CODE_VIEW_PRESET_CSS,
  CODE_VIEW_SPEC_TOKEN_MARKER,
  codeViewTokenProperty,
  generateThemeFile,
} from "../../../../../packages/shared/src/codeView/files/theme";
import type { CodeViewResult } from "../../../../../packages/shared/src/codeView/types";
import type { Reject } from "./codeViewEdit";
import {
  CatalogStyleValueError,
  catalogStyleKeySupported,
  catalogStyleWrites,
  type CatalogStyleFieldWrites,
} from "./styleFields";

/* ── a CSS file's rules (the closed grammar the generators write) ── */

export interface CodeViewCssDeclaration {
  readonly property: string;
  readonly value: string;
  readonly from: number;
  /** A comment after the declaration on its line (`/* spec token *\/`). */
  readonly comment?: string;
}
export interface CodeViewCssRule {
  readonly selector: string;
  readonly media?: string;
  readonly from: number;
  readonly declarations: readonly CodeViewCssDeclaration[];
  /** Comments on their own lines inside the block (a read-only marker). */
  readonly comments: readonly string[];
}

/** Parse the rules (`@media` one level) — undefined + the offset of a syntax error. */
export function parseCodeViewCss(
  text: string,
): { rules: CodeViewCssRule[] } | { error: number } {
  let at = 0;
  const rules: CodeViewCssRule[] = [];
  const skip = (comments?: string[]) => {
    for (;;) {
      while (at < text.length && /\s/.test(text[at]!)) at += 1;
      if (text.startsWith("/*", at)) {
        const end = text.indexOf("*/", at + 2);
        if (end < 0) throw at;
        comments?.push(text.slice(at, end + 2));
        at = end + 2;
      } else return;
    }
  };
  /** Read up to (not past) one of `stops` at depth 0, outside quotes. */
  const until = (stops: string): string => {
    const start = at;
    let depth = 0;
    let quote = "";
    for (; at < text.length; at += 1) {
      const char = text[at]!;
      if (quote) {
        if (char === "\\") at += 1;
        else if (char === quote) quote = "";
        continue;
      }
      if (char === '"' || char === "'") quote = char;
      else if (text.startsWith("/*", at)) {
        const end = text.indexOf("*/", at + 2);
        if (end < 0) throw at;
        at = end + 1;
      } else if (char === "(") depth += 1;
      else if (char === ")") depth -= 1;
      else if (depth === 0 && stops.includes(char)) break;
    }
    return text.slice(start, at);
  };
  const block = (selector: string, from: number, media?: string) => {
    at += 1; // `{`
    const declarations: CodeViewCssDeclaration[] = [];
    const comments: string[] = [];
    for (;;) {
      skip(comments);
      if (at >= text.length) throw at;
      if (text[at] === "}") {
        at += 1;
        break;
      }
      const start = at;
      const raw = until(";}");
      if (text[at] === ";") at += 1;
      const colon = raw.indexOf(":");
      if (colon < 0) throw start;
      const property = raw.slice(0, colon).trim().toLowerCase();
      const value = raw
        .slice(colon + 1)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim();
      if (!property || !value) throw start;
      // A comment after it on the same line is the declaration's.
      const lineEnd = text.indexOf("\n", at);
      const rest = text.slice(at, lineEnd < 0 ? undefined : lineEnd);
      const trailing = /^\s*(\/\*[\s\S]*?\*\/)/.exec(rest);
      if (trailing) at += trailing[0].length;
      declarations.push({
        property,
        value,
        from: start,
        ...(trailing ? { comment: trailing[1]! } : {}),
      });
    }
    rules.push({
      selector,
      from,
      declarations,
      comments,
      ...(media ? { media } : {}),
    });
  };
  try {
    for (;;) {
      skip();
      if (at >= text.length) break;
      const from = at;
      if (text.startsWith("@media", at)) {
        at += 6;
        const media = until("{").trim();
        if (text[at] !== "{") throw from;
        at += 1;
        for (;;) {
          skip();
          if (at >= text.length) throw at;
          if (text[at] === "}") {
            at += 1;
            break;
          }
          const ruleFrom = at;
          const selector = until("{").trim();
          if (text[at] !== "{" || !selector) throw ruleFrom;
          block(selector, ruleFrom, media);
        }
        continue;
      }
      const selector = until("{").trim();
      if (text[at] !== "{" || !selector) throw from;
      block(selector, from);
    }
  } catch (error) {
    return { error: typeof error === "number" ? error : at };
  }
  return { rules };
}

const normal = (value: string) => value.replace(/\s+/g, " ").trim();
const camel = (property: string) =>
  property.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase());

/* ── page style ── */

const BREAKPOINT_OF_MEDIA = new Map<string, BreakpointName>(
  Object.entries(CODE_VIEW_BREAKPOINT_MEDIA).map(([breakpoint, media]) => [
    normal(media),
    breakpoint as BreakpointName,
  ]),
);
const STATE_OF_SELECTOR = new Map<string, StateName>(
  Object.entries(CODE_VIEW_STATE_SELECTORS).map(([state, selector]) => [
    selector,
    state as StateName,
  ]),
);
const VISUAL_OF_PROPERTY = new Map<string, VisualField>(
  Object.entries(CODE_VIEW_VISUAL_CSS).map(([field, place]) => [
    place.property,
    field as VisualField,
  ]),
);
const PX_FIELDS = new Set(
  Object.entries(CODE_VIEW_VISUAL_CSS)
    .filter(([, place]) => place.unit === "px")
    .map(([field]) => field),
);
const LAYOUT_OF_PROPERTY = new Map(
  Object.entries(CODE_VIEW_LAYOUT_CSS).map(([field, property]) => [
    property,
    field,
  ]),
);
const VISIBILITY_VALUES = new Set(["none", "revert"]);

interface RuleKey {
  readonly nodeId: string;
  /** ADR-296 Phase 5 — an instance's position (`left-picker/save-button`). */
  readonly path?: string;
  readonly breakpoint: BreakpointName;
  readonly state?: StateName;
}
const keyText = (key: RuleKey) =>
  `${key.nodeId}\u0000${key.path ?? ""}\u0000${key.breakpoint}\u0000${key.state ?? ""}`;

/** A rule's place (the node by its class, the `@media` breakpoint, the state's data attributes). */
function ruleKey(
  rule: CodeViewCssRule,
  nodeOf: ReadonlyMap<string, string>,
  reject: Reject,
): RuleKey | undefined {
  const breakpoint = rule.media
    ? BREAKPOINT_OF_MEDIA.get(normal(rule.media))
    : "desktop";
  // `.instance .nested .node[data-…]` — a class chain is an instance's position (Phase 5).
  const match =
    /^\.([A-Za-z_][\w-]*)((?:\s+\.[A-Za-z_][\w-]*)*)((?:\[data-[\w-]+\])*)$/.exec(
      rule.selector.replace(/\s+/g, " "),
    );
  if (!breakpoint || !match) {
    reject(rule.from, "outsideVocabulary", rule.media ?? rule.selector);
    return undefined;
  }
  const nodeId = nodeOf.get(match[1]!);
  if (!nodeId) {
    reject(rule.from, "unknownReference", `.${match[1]}`);
    return undefined;
  }
  const path = match[2]
    ? match[2]
        .trim()
        .split(/\s+/)
        .map((segment) => segment.slice(1))
        .join("/")
    : undefined;
  if (!match[3]) return { nodeId, breakpoint, ...(path ? { path } : {}) };
  const state = STATE_OF_SELECTOR.get(match[3]);
  if (!state || breakpoint !== "desktop") {
    reject(rule.from, "outsideVocabulary", rule.selector);
    return undefined;
  }
  return { nodeId, breakpoint, state, ...(path ? { path } : {}) };
}

interface Block {
  readonly key: RuleKey;
  readonly rule: CodeViewCssRule;
  /** property → its declaration (the last one wins, as in CSS). */
  readonly values: Map<string, CodeViewCssDeclaration>;
}
function blocksOf(
  rules: readonly CodeViewCssRule[],
  nodeOf: ReadonlyMap<string, string>,
  reject: Reject,
): Map<string, Block> {
  const out = new Map<string, Block>();
  for (const rule of rules) {
    const key = ruleKey(rule, nodeOf, reject);
    if (!key) continue;
    const block = out.get(keyText(key)) ?? {
      key,
      rule,
      values: new Map(),
    };
    for (const declaration of rule.declarations) {
      // (판독 MEDIUM-1 — CSS keeps one of two same declarations: the other would be lost.)
      if (block.values.has(declaration.property))
        reject(declaration.from, "outsideVocabulary", declaration.property);
      block.values.set(declaration.property, declaration);
    }
    out.set(keyText(key), block);
  }
  return out;
}

const SET = <T>(value: T): WriteValue<T> => ({ kind: "set", value });
const REMOVE = { kind: "remove" } as const;
const MASK = { kind: "mask" } as const;

/** A token a `var(--…)` names (the project's by name, else the library's by its CSS name). */
function tokenOf(
  reader: CatalogReader,
  value: string,
  known: Readonly<Record<string, string>> | undefined,
): string | undefined {
  const name = /^var\((--[\w-]+)\)$/.exec(value.trim())?.[1];
  if (!name) return undefined;
  if (known?.[name]) return known[name];
  const project = reader.getEntry(reader.projectId) as ProjectEntry;
  for (const id of project.tokenIds)
    if (codeViewTokenVar(reader as never, id) === `var(${name})`) return id;
  for (const id of reader.library.tokens.keys())
    if (codeViewTokenVar(reader as never, id) === `var(${name})`) return id;
  return undefined;
}

/**
 * One declaration as typed field writes (`""` = removed). Undefined = not a field's form (the
 * caller refuses it).
 */
function fieldWrites(
  reader: CatalogReader,
  property: string,
  value: string,
  context: { fontSize?: number; tokens?: Readonly<Record<string, string>> },
): CatalogStyleFieldWrites | undefined {
  // A field's own name (`--sizing-width` — its CSS property taken by another field of the block).
  const own = /^--(visual|layout|sizing)-([a-z-]+)$/.exec(property);
  if (own) {
    const field = camel(own[2]!);
    const known =
      own[1] === "visual"
        ? field in CODE_VIEW_VISUAL_CSS
        : own[1] === "layout"
          ? field in CODE_VIEW_LAYOUT_CSS
          : field in CODE_VIEW_SIZING_CSS;
    if (!known) return undefined;
    const removedOwn = value === "";
    const px = /^(-?\d+(?:\.\d+)?)px$/.exec(value);
    const number = /^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : undefined;
    const set =
      own[1] === "layout"
        ? SET(value)
        : own[1] === "sizing"
          ? px || number !== undefined
            ? SET(px ? Number(px[1]) : number!)
            : undefined
          : SET(PX_FIELDS.has(field) && px ? Number(px[1]) : (number ?? value));
    if (!removedOwn && !set) return undefined;
    return {
      [own[1]!]: {
        [field]: removedOwn ? REMOVE : value === "unset" ? MASK : set,
      },
    } as CatalogStyleFieldWrites;
  }
  const visual = VISUAL_OF_PROPERTY.get(property);
  const layout = LAYOUT_OF_PROPERTY.get(property);
  const removed = value === "";
  // `unset` = the field masked (the definition's value hidden).
  if (value === "unset") {
    if (visual) return { visual: { [visual]: MASK } };
    if (layout) return { layout: { [layout]: MASK } };
    return undefined;
  }
  const token = removed ? undefined : tokenOf(reader, value, context.tokens);
  if (token && visual)
    return {
      visual: {
        [visual]: SET({ kind: "token", tokenId: token } as AuthoredValue),
      },
    };
  const key = camel(property);
  if (!property.startsWith("--") && catalogStyleKeySupported(key))
    try {
      return catalogStyleWrites(key, value, { fontSize: context.fontSize });
    } catch (error) {
      if (error instanceof CatalogStyleValueError) return undefined;
      throw error;
    }
  // A field no Styles panel key names: `--<field>` (a visual field) · `order` (a layout field).
  if (visual) {
    if (removed) return { visual: { [visual]: REMOVE } };
    const px = /^(-?\d+(?:\.\d+)?)(px)?$/.exec(value);
    const number = /^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : undefined;
    return {
      visual: {
        [visual]: SET(
          PX_FIELDS.has(visual) && px ? Number(px[1]) : (number ?? value),
        ),
      },
    };
  }
  if (layout) return { layout: { [layout]: removed ? REMOVE : SET(value) } };
  return undefined;
}

const mergeWrites = (
  into: CatalogStyleFieldWrites,
  from: CatalogStyleFieldWrites,
): CatalogStyleFieldWrites => ({
  visual: { ...into.visual, ...from.visual },
  layout: { ...into.layout, ...from.layout },
  sizing: { ...into.sizing, ...from.sizing },
});

/** Class → node: the baseline's classes, then the stage's for a node the baseline did not name. */
function classMap(
  reader: CatalogReader,
  pageId: string,
  baseline: CodeViewResult | undefined,
): Map<string, string> {
  const out = new Map(Object.entries(baseline?.symbols.classes ?? {}));
  const named = new Set(out.values());
  for (const [nodeId, className] of codeViewNodeClasses(
    reader as never,
    pageId,
  ))
    if (!named.has(nodeId) && !out.has(className)) out.set(className, nodeId);
  return out;
}

/** The page style's edits as the Design panel's commands. */
export function planCodeViewPageStyle(input: {
  reader: CatalogReader;
  pageId: string;
  baseline: CodeViewResult;
  edited: string;
  reject: Reject;
}): CatalogCommand[] {
  const { reader, reject } = input;
  const before = parseCodeViewCss(input.baseline.code);
  const after = parseCodeViewCss(input.edited);
  if ("error" in after) {
    reject(after.error, "unparsable");
    return [];
  }
  if ("error" in before) return [];
  // A class is the node the baseline gave it (a move in the page's JSX may number classes again);
  // a node styled for the first time takes its class as the stage names it.
  const nodeOf = classMap(reader, input.pageId, input.baseline);
  const old = blocksOf(before.rules, nodeOf, () => undefined);
  const now = blocksOf(after.rules, nodeOf, reject);
  const tokens = input.baseline.symbols.tokens;
  const steps: CatalogCommand[] = [];
  /** Per node · breakpoint: the field writes; per node: the whole fields. */
  const writes = new Map<string, CatalogStyleFieldWrites>();
  const visibility = new Map<string, NonNullable<NodeEntry["visibility"]>>();
  const targets = new Map<string, EditTarget>();
  const visibilityTargets = new Map<string, EditTarget>();
  for (const id of new Set([...old.keys(), ...now.keys()])) {
    const was = old.get(id);
    const is = now.get(id);
    const key = (is ?? was)!.key;
    const node = reader.getEntry(key.nodeId) as NodeEntry | undefined;
    if (node?.kind !== "node") continue;
    const at = is?.rule.from ?? 0;
    // A value only the Design panel holds (its marker) stays as it is.
    for (const marker of was?.rule.comments ?? [])
      if (!is?.rule.comments.includes(marker))
        reject(at, "readOnlyFile", marker);
    const changed = [
      ...new Set([...(was?.values.keys() ?? []), ...(is?.values.keys() ?? [])]),
    ].filter(
      (property) =>
        normal(was?.values.get(property)?.value ?? "") !==
        normal(is?.values.get(property)?.value ?? ""),
    );
    if (!changed.length) continue;
    // A state's style has no Design panel command on a node (ADR-296 G2 — no new command).
    if (key.state) {
      reject(
        is?.values.get(changed[0]!)?.from ?? at,
        "notInCode",
        CODE_VIEW_STATE_SELECTORS[key.state],
      );
      continue;
    }
    // The style's owner: the node, or an instance's position (its patch — instance commands only).
    const address = key.path
      ? codeViewAddressOf(reader as never, node.id, key.path)
      : undefined;
    if (key.path && !address) {
      reject(at, "unknownReference", key.path);
      continue;
    }
    const target: EditTarget = address
      ? { kind: "descendant", ownerId: node.id as NodeId, address }
      : { kind: "node", id: node.id as NodeId };
    const source: CodeViewStyleSource = address
      ? {
          id: node.id,
          ...descendantPatchOf(
            node.descendantOverrides.find((item) =>
              codeViewSameAddress(item.address, address),
            ),
          ),
        }
      : node;
    const breakpoint = key.breakpoint;
    const fontSize = (() => {
      const text = is?.values.get("font-size")?.value;
      const px = text ? /^(\d+(?:\.\d+)?)px$/.exec(text) : undefined;
      if (px) return Number(px[1]);
      const own = source.visual?.fontSize;
      return own?.kind === "set" && typeof own.value === "number"
        ? own.value
        : undefined;
    })();
    let fields: CatalogStyleFieldWrites = {};
    let theme = false;
    for (const property of changed) {
      const declaration = is?.values.get(property);
      const value = declaration ? normal(declaration.value) : "";
      const from = declaration?.from ?? at;
      if (property === CODE_VIEW_FILLS_CSS) {
        // (판독 MEDIUM-3 — the fills only the Design panel holds stay its own.)
        if (
          was?.rule.comments.includes(CODE_VIEW_DESIGN_PANEL_MARKER("fills"))
        ) {
          reject(from, "readOnlyFile", CODE_VIEW_DESIGN_PANEL_MARKER("fills"));
          continue;
        }
        if (breakpoint !== "desktop") {
          reject(from, "outsideVocabulary", property);
          continue;
        }
        const fills: CatalogFillLayer[] | undefined = value
          ? codeViewFillsOf(
              value,
              (source.fills ?? []).map((layer) => layer.id),
            )
          : undefined;
        if (value && !fills) {
          reject(from, "outsideVocabulary", property);
          continue;
        }
        steps.push(
          setWholeField({ targets: [target], field: "fills", value: fills }),
        );
        continue;
      }
      const axis = (
        Object.entries(CODE_VIEW_FILL_SIZING_CSS) as [
          "width" | "height",
          string,
        ][]
      ).find(([, name]) => name === property)?.[0];
      if (axis) {
        const factor = Number(value);
        if (value && value !== "none" && !(factor > 0)) {
          reject(from, "outsideVocabulary", property);
          continue;
        }
        steps.push(
          setFillSizing({
            targets: [target],
            breakpoint,
            axis,
            value: !value ? undefined : value === "none" ? null : { factor },
          }),
        );
        continue;
      }
      if (
        property === CODE_VIEW_THEME_MODE_CSS ||
        property === CODE_VIEW_THEME_TINT_CSS
      ) {
        if (breakpoint !== "desktop" || address)
          reject(from, "outsideVocabulary", property);
        else theme = true;
        continue;
      }
      const wasValue = normal(was?.values.get(property)?.value ?? "");
      // (판독 MEDIUM-1 — the visibility's own name when `display` is the block's layout value.)
      if (property === CODE_VIEW_VISIBLE_CSS) {
        if (value && value !== "true" && value !== "false") {
          reject(from, "outsideVocabulary", `${property}: ${value}`);
          continue;
        }
        const map = visibility.get(id) ?? { ...source.visibility };
        if (value) map[breakpoint] = value === "true";
        else delete map[breakpoint];
        visibility.set(id, map);
        visibilityTargets.set(id, target);
        continue;
      }
      if (
        property === "display" &&
        (VISIBILITY_VALUES.has(value) || VISIBILITY_VALUES.has(wasValue))
      ) {
        const map = visibility.get(id) ?? { ...source.visibility };
        if (VISIBILITY_VALUES.has(value)) map[breakpoint] = value === "revert";
        else delete map[breakpoint];
        visibility.set(id, map);
        visibilityTargets.set(id, target);
        // (A layout display that becomes a visibility, or back: the other side goes.)
        if (
          !VISIBILITY_VALUES.has(value) ||
          (wasValue && !VISIBILITY_VALUES.has(wasValue))
        ) {
          const write = fieldWrites(
            reader,
            property,
            VISIBILITY_VALUES.has(value) ? "" : value,
            {
              fontSize,
              tokens,
            },
          );
          if (write) fields = mergeWrites(fields, write);
        }
        continue;
      }
      const write = fieldWrites(reader, property, value, { fontSize, tokens });
      if (!write) {
        reject(from, "outsideVocabulary", `${property}: ${value}`);
        continue;
      }
      fields = mergeWrites(fields, write);
    }
    if (theme) {
      const mode = is?.values.get(CODE_VIEW_THEME_MODE_CSS)?.value.trim();
      const tint = is?.values.get(CODE_VIEW_THEME_TINT_CSS)?.value.trim();
      if (mode && mode !== "light" && mode !== "dark")
        reject(at, "outsideVocabulary", `${CODE_VIEW_THEME_MODE_CSS}: ${mode}`);
      else {
        const value: NodeThemeOverride = {
          ...(mode ? { mode: mode as "light" | "dark" } : {}),
          ...(tint ? { tint: tint as ThemePreset["tint"] } : {}),
        };
        steps.push(
          setWholeField({
            targets: [target],
            field: "themeOverride",
            value: Object.keys(value).length ? value : undefined,
          }),
        );
      }
    }
    if (
      Object.keys(fields.visual ?? {}).length ||
      Object.keys(fields.layout ?? {}).length ||
      Object.keys(fields.sizing ?? {}).length
    ) {
      const place = `${id}\u0000${breakpoint}`;
      targets.set(place, target);
      writes.set(place, mergeWrites(writes.get(place) ?? {}, fields));
    }
  }
  for (const [place, fields] of writes) {
    const breakpoint = place.split("\u0000").at(-1) as BreakpointName;
    steps.push(
      setFields({
        targets: [targets.get(place)!],
        ...(breakpoint !== "desktop" ? { breakpoint } : {}),
        ...(Object.keys(fields.visual ?? {}).length
          ? { visual: fields.visual }
          : {}),
        ...(Object.keys(fields.layout ?? {}).length
          ? { layout: fields.layout }
          : {}),
        ...(Object.keys(fields.sizing ?? {}).length
          ? { sizing: fields.sizing }
          : {}),
        label: "Code",
      }),
    );
  }
  for (const [place, map] of visibility)
    steps.push(
      setWholeField({
        targets: [visibilityTargets.get(place)!],
        field: "visibility",
        value: Object.keys(map).length ? map : undefined,
      }),
    );
  return steps;
}

/**
 * A style file against the one the final document gives, by meaning: each rule's declarations
 * read as their field writes (`line-height: 24px` and its ratio are the same value). A rule or
 * value that differs is refused at its line.
 */
function compareStyleFiles(
  reader: CatalogReader,
  regenerated: CodeViewResult,
  edited: string,
  reject: Reject,
  keyOf: (rule: CodeViewCssRule) => string | undefined,
  theirKeyOf: (rule: CodeViewCssRule) => string | undefined = keyOf,
  /** The font size a px `line-height` of a rule relates to (its node's — 판독 MEDIUM-2). */
  fontOf?: (key: string) => number | undefined,
): void {
  const mine = parseCodeViewCss(edited);
  const theirs = parseCodeViewCss(regenerated.code);
  if ("error" in mine || "error" in theirs) return;
  const tokens = regenerated.symbols.tokens;
  // Each rule's meaning: the field values its declarations set (a shorthand = its longhands' fields;
  // a removal the conversion adds is not a value), and the other declarations as text.
  const meaning = (
    rules: readonly CodeViewCssRule[],
    keyOf: (rule: CodeViewCssRule) => string | undefined,
  ) => {
    const out = new Map<
      string,
      Map<string, { value: string; from: CodeViewCssDeclaration }>
    >();
    for (const rule of rules) {
      const key = keyOf(rule) ?? `?${rule.selector}`;
      const values = out.get(key) ?? new Map();
      const size = /^(\d+(?:\.\d+)?)px$/.exec(
        normal(
          rule.declarations.find((item) => item.property === "font-size")
            ?.value ?? "",
        ),
      );
      const fontSize = size ? Number(size[1]) : fontOf?.(key);
      for (const declaration of rule.declarations) {
        const value = normal(declaration.value);
        // (One visibility, two forms — `display: none | revert` · `--visible: false | true`.)
        const visible =
          declaration.property === CODE_VIEW_VISIBLE_CSS
            ? value === "true"
            : declaration.property === "display" && VISIBILITY_VALUES.has(value)
              ? value === "revert"
              : undefined;
        if (visible !== undefined) {
          values.set("visibility", {
            value: String(visible),
            from: declaration,
          });
          continue;
        }
        const write = declaration.property.startsWith("--theme")
          ? undefined
          : fieldWrites(reader, declaration.property, value, {
              tokens,
              fontSize,
            });
        if (!write) {
          // (The fill layers by their paint — a layer's id is the panel's handle.)
          const fills =
            declaration.property === CODE_VIEW_FILLS_CSS
              ? codeViewFillsOf(value)?.map(({ id: _id, ...layer }) => layer)
              : undefined;
          values.set(`css:${declaration.property}`, {
            value: fills ? JSON.stringify(fills) : value,
            from: declaration,
          });
          continue;
        }
        for (const [layer, fields] of Object.entries(write))
          for (const [field, entry] of Object.entries(fields ?? {}))
            if ((entry as { kind?: string })?.kind !== "remove")
              values.set(`${layer}.${field}`, {
                value: JSON.stringify(entry),
                from: declaration,
              });
      }
      out.set(key, values);
    }
    return out;
  };
  const a = meaning(mine.rules, keyOf);
  const b = meaning(theirs.rules, theirKeyOf);
  for (const [key, have] of a) {
    const want = b.get(key);
    const rule = mine.rules.find(
      (item) => (keyOf(item) ?? `?${item.selector}`) === key,
    )!;
    if (!want) {
      if (have.size) reject(rule.from, "notInCode", rule.selector);
      continue;
    }
    for (const [slot, { value, from }] of have)
      if (want.get(slot)?.value !== value)
        reject(from.from, "notInCode", `${from.property}: ${from.value}`);
    if ([...want.keys()].some((slot) => !have.has(slot)))
      reject(rule.from, "notInCode", rule.selector);
  }
  for (const [key, want] of b)
    if (!a.has(key) && want.size) reject(0, "notInCode", key);
}

export function comparePageStyleFile(
  final: CatalogReader,
  pageId: string,
  edited: string,
  reject: Reject,
  baseline?: CodeViewResult,
): void {
  const regenerated = generatePageStyleFile({
    reader: final as never,
    pageId,
  });
  // A rule is its node's place (the class names a node — by the baseline on the written side, by
  // the final document on the regenerated one).
  const keyBy =
    (classes: ReadonlyMap<string, string>) => (rule: CodeViewCssRule) => {
      const match = /^\.([A-Za-z_][\w-]*)(.*)$/.exec(rule.selector);
      const nodeId = match ? classes.get(match[1]!) : undefined;
      return nodeId
        ? `${rule.media ? normal(rule.media) : ""}\u0000${nodeId}\u0000${match![2]}`
        : undefined;
    };
  compareStyleFiles(
    final,
    regenerated,
    edited,
    reject,
    keyBy(classMap(final, pageId, baseline)),
    keyBy(new Map(Object.entries(regenerated.symbols.classes ?? {}))),
    (key) => {
      const nodeId = key.split("\u0000")[1];
      const own = nodeId
        ? (final.getEntry(nodeId) as NodeEntry | undefined)?.visual.fontSize
        : undefined;
      return own?.kind === "set" && typeof own.value === "number"
        ? own.value
        : undefined;
    },
  );
}

/* ── theme.css ── */

const THEME_SELECTOR = /^\[data-theme="((?:[^"\\]|\\.)*)"\]$/;
const TINTS: readonly ThemePreset["tint"][] = [
  "red",
  "orange",
  "yellow",
  "green",
  "turquoise",
  "cyan",
  "blue",
  "indigo",
  "purple",
  "pink",
];
const NEUTRALS: readonly ThemePreset["neutral"][] = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
];
const RADII: readonly ThemePreset["radius"][] = [
  "none",
  "sm",
  "md",
  "lg",
  "xl",
];

/** A token's value from its CSS text (its type: the token's, or read from the text). */
function tokenValueOf(
  text: string,
  type?: TokenType,
): { tokenType: TokenType; value: string | number | boolean } {
  const px = /^(-?\d+(?:\.\d+)?)px$/.exec(text);
  const number = /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : undefined;
  const tokenType: TokenType =
    type ??
    (px
      ? "length"
      : number !== undefined
        ? "number"
        : text === "true" || text === "false"
          ? "boolean"
          : /^(#|rgb|hsl|oklch|oklab|color\()/.test(text)
            ? "color"
            : "string");
  if (tokenType === "length")
    return { tokenType, value: px ? Number(px[1]) : (number ?? text) };
  if (tokenType === "number") return { tokenType, value: number ?? text };
  if (tokenType === "boolean") return { tokenType, value: text === "true" };
  return { tokenType, value: text };
}

interface ThemeBlock {
  readonly name: string;
  readonly rule: CodeViewCssRule;
  readonly values: Map<string, CodeViewCssDeclaration>;
}
function themeBlocks(
  rules: readonly CodeViewCssRule[],
  reject: Reject,
): ThemeBlock[] {
  const out: ThemeBlock[] = [];
  for (const rule of rules) {
    const match = THEME_SELECTOR.exec(rule.selector);
    if (!match || rule.media) {
      reject(rule.from, "outsideVocabulary", rule.selector);
      continue;
    }
    out.push({
      name: match[1]!.replace(/\\(.)/g, "$1"),
      rule,
      values: new Map(
        rule.declarations.map((declaration) => [
          declaration.property,
          declaration,
        ]),
      ),
    });
  }
  return out;
}

/** A theme block's preset (undefined = a key missing or not a preset value). */
function presetOf(block: ThemeBlock, reject: Reject): ThemePreset | undefined {
  const scheme = normal(
    block.values.get(CODE_VIEW_THEME_MODE_CSS)?.value ?? "",
  );
  const darkMode =
    scheme === "light dark"
      ? "system"
      : scheme === "light" || scheme === "dark"
        ? scheme
        : undefined;
  const read = <T extends string>(property: string, values: readonly T[]) => {
    const value = block.values.get(property)?.value.trim();
    return values.includes(value as T) ? (value as T) : undefined;
  };
  const tint = read(CODE_VIEW_PRESET_CSS.tint, TINTS);
  const neutral = read(CODE_VIEW_PRESET_CSS.neutral, NEUTRALS);
  const radius = read(CODE_VIEW_PRESET_CSS.radius, RADII);
  if (!darkMode || !tint || !neutral || !radius) {
    reject(block.rule.from, "outsideVocabulary", block.rule.selector);
    return undefined;
  }
  return { tint, neutral, radius, darkMode };
}

const PRESET_PROPERTIES = new Set<string>([
  CODE_VIEW_THEME_MODE_CSS,
  ...Object.values(CODE_VIEW_PRESET_CSS),
]);

/** `theme.css`'s edits as the Themes panel's commands. */
export function planCodeViewTheme(input: {
  reader: CatalogReader;
  baseline: CodeViewResult;
  edited: string;
  newId: NewId;
  reject: Reject;
}): CatalogCommand[] {
  const { reader, reject } = input;
  const after = parseCodeViewCss(input.edited);
  const before = parseCodeViewCss(input.baseline.code);
  if ("error" in after) {
    reject(after.error, "unparsable");
    return [];
  }
  if ("error" in before) return [];
  const project = reader.getEntry(reader.projectId) as ProjectEntry;
  const themes = project.themeIds
    .map((id) => reader.getEntry(id) as ThemeEntry | undefined)
    .filter((theme): theme is ThemeEntry => theme?.kind === "theme");
  const now = themeBlocks(after.rules, reject);
  const was = themeBlocks(before.rules, () => undefined);
  // Pair the blocks with the themes: by name, then (a renamed one) by position among the rest.
  const byName = new Map(themes.map((theme) => [theme.name, theme]));
  const paired = new Map<ThemeBlock, ThemeEntry>();
  for (const block of now) {
    const theme = byName.get(block.name);
    if (theme && ![...paired.values()].includes(theme))
      paired.set(block, theme);
  }
  // (A renamed theme keeps its place: the block at a theme's position whose name is new.)
  now.forEach((block, index) => {
    const theme = themes[index];
    if (!paired.has(block) && theme && ![...paired.values()].includes(theme))
      paired.set(block, theme);
  });
  const steps: CatalogCommand[] = [];
  // Order: the themes the code keeps must stay in the document's order (no reorder command).
  const kept = now
    .filter((block) => paired.has(block))
    .map((block) => paired.get(block)!);
  if (
    kept.some(
      (theme, index) =>
        index && themes.indexOf(theme) < themes.indexOf(kept[index - 1]!),
    )
  )
    reject(0, "notInCode", "theme order");
  for (const theme of themes)
    if (![...paired.values()].includes(theme))
      steps.push(removeTheme({ id: theme.id, label: "Code" }));
  for (const block of now) {
    const preset = presetOf(block, reject);
    if (!preset) continue;
    const theme = paired.get(block);
    const tokens = [...block.values.values()].filter(
      (declaration) => !PRESET_PROPERTIES.has(declaration.property),
    );
    for (const declaration of tokens)
      if (!/^--[\w-]+$/.test(declaration.property))
        reject(declaration.from, "outsideVocabulary", declaration.property);
    if (!theme) {
      const created = tokens.map((declaration) => ({
        kind: "token" as const,
        id: input.newId("token"),
        name: declaration.property.slice(2),
        ...tokenValueOf(normal(declaration.value)),
        source: "user-defined" as const,
      })) as TokenEntry[];
      steps.push(
        createTheme({
          theme: {
            kind: "theme",
            id: input.newId("theme"),
            name: block.name,
            tokenIds: created.map((token) => token.id),
            preset,
          },
          tokens: created,
          label: "Code",
        }),
      );
      continue;
    }
    const nameChanged = block.name !== theme.name;
    const presetChanged = (Object.keys(preset) as (keyof ThemePreset)[]).some(
      (key) => preset[key] !== theme.preset[key],
    );
    if (nameChanged || presetChanged)
      steps.push(
        updateTheme({
          id: theme.id,
          ...(nameChanged ? { name: block.name } : {}),
          ...(presetChanged ? { preset } : {}),
          label: "Code",
        }),
      );
    // Tokens by their property (the generator's `--<name>`).
    const own = new Map<string, TokenEntry>();
    for (const id of theme.tokenIds) {
      const token = reader.getEntry(id) as TokenEntry | undefined;
      if (token?.kind === "token")
        own.set(codeViewTokenProperty(token.name), token);
    }
    const previous = was.find((item) => item.name === theme.name);
    for (const declaration of tokens) {
      const token = own.get(declaration.property);
      const value = normal(declaration.value);
      if (!token) {
        steps.push(
          setThemeToken({
            themeId: theme.id as EntryId<"theme">,
            name: declaration.property.slice(2),
            value: tokenValueOf(value),
            newId: input.newId,
            label: "Code",
          }),
        );
        continue;
      }
      const before = previous?.values.get(declaration.property);
      if (before && normal(before.value) === value) continue;
      if (token.source === "spec-token") {
        reject(declaration.from, "readOnlyFile", CODE_VIEW_SPEC_TOKEN_MARKER);
        continue;
      }
      steps.push(
        setThemeToken({
          themeId: theme.id as EntryId<"theme">,
          name: token.name,
          value: tokenValueOf(value, token.tokenType),
          newId: input.newId,
          label: "Code",
        }),
      );
    }
    for (const [property, token] of own)
      if (!block.values.has(property)) {
        if (token.source === "spec-token")
          reject(block.rule.from, "readOnlyFile", property);
        else
          steps.push(
            setThemeToken({
              themeId: theme.id as EntryId<"theme">,
              name: token.name,
              value: null,
              newId: input.newId,
              label: "Code",
            }),
          );
      }
  }
  return steps;
}

export function compareThemeFile(
  final: CatalogReader,
  edited: string,
  reject: Reject,
): void {
  const regenerated = generateThemeFile({ reader: final as never });
  compareStyleFiles(
    final,
    regenerated,
    edited,
    reject,
    (rule) => rule.selector,
  );
}

/** The read-only marker text a page style block writes for a value the CSS cannot hold. */
export const CODE_VIEW_FILLS_MARKER = CODE_VIEW_DESIGN_PANEL_MARKER("fills");
