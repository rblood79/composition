import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import {
  isRichText,
  richTextPlain,
  RICH_TEXT_HOST_TYPES,
  TEXT_RUN_MARK_KEYS,
  type TextRunMarkKey,
} from "../../../../../../../packages/shared/src/catalog/document/textRuns";
import type {
  RichText,
  TokenUse,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { catalogTokenValue } from "../../../../../../../packages/shared/src/catalog/document/themedToken";
import { TEXT_EDIT_SCOPE_ATTR } from "../../../catalogRuntime/textEditorHandle";
import {
  catalogBoundTextCommand,
  catalogTextCommand,
  catalogTextKey,
  catalogTextOf,
  catalogTextValueOf,
  committedWhiteSpace,
} from "../../../catalogRuntime/canvasText";

/**
 * ADR-299 Decision 4 — the editor's input chunk (ProseMirror), loaded when an edit starts: the
 * initial bundle carries none of it (G1). Selection warms the chunk; while it loads, rich
 * text keeps its marks in a read-only projection instead of a lossy plain textarea.
 */
let editorLoaded = false;
let editorPromise: Promise<typeof import("./textEditor/EditorField")> | undefined;
const loadEditorField = () =>
  (editorPromise ??= import("./textEditor/EditorField").then((module) => {
    editorLoaded = true;
    return module;
  }));
const EditorField = lazy(loadEditorField);
import type { CatalogSelectionItem } from "../../../catalogRuntime/session";
import { catalogTextBinding } from "../../../catalogRuntime/textBinding";
import { catalogPropertyTextTarget } from "../../../catalogRuntime/componentProperties";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import type { BoundingBox } from "../selection/types";
import { subscribeCanvasFrames } from "../skia/frameScheduler";
import {
  cssColorOf,
  resolveTextEditBox,
  type TextEditBox,
} from "../skia/textDrawOrigin";
import { viewportState } from "../viewport/viewportState";
import { DEFAULT_FONT_FEATURES } from "../layout/engines/cssResolver";

export interface CatalogTextEditorProps {
  workspace: CatalogWorkspace;
  /** Scene box of a drawn record (the Canvas scene's bound stream). */
  boundsOf: (identity: string) => BoundingBox | undefined;
}

/**
 * ADR-248 Phase 4e-3b: inline text editing of the open project — a DOM textarea over the edited
 * record (scene box × camera, typed in scene px and scaled by the zoom) while the Canvas leaves
 * that record's text out. Escape, ⌘/Ctrl+Enter and leaving the field commit (one command when the
 * text changed); Enter is a new line.
 */
export function CatalogTextEditor({
  workspace,
  boundsOf,
}: CatalogTextEditorProps) {
  const editing = useSyncExternalStore(
    workspace.session.subscribe,
    () => workspace.session.getSnapshot().textEditing,
  );
  const selection = useSyncExternalStore(
    workspace.session.subscribe,
    () => workspace.session.getSnapshot().selection,
  );
  useEffect(() => {
    if (
      selection.some((item) =>
        catalogTextKey(workspace.root.domInputs.get(item.identity)),
      )
    ) {
      void loadEditorField();
    }
  }, [selection, workspace]);
  if (!editing) return null;
  return (
    <TextField
      key={editing.identity}
      workspace={workspace}
      item={editing}
      boundsOf={boundsOf}
    />
  );
}

function TextField({
  workspace,
  item,
  boundsOf,
}: CatalogTextEditorProps & { item: CatalogSelectionItem }) {
  const [start] = useState(() => {
    const record = workspace.root.domInputs.get(item.identity);
    const key = catalogTextKey(record);
    // A text the template binds to its instance's prop (a Card's title, a field's Label): the edit
    // writes that prop (ADR-254 Decision 5) — shown and typed as the prop's text.
    const binding =
      key && record
        ? catalogTextBinding(
            workspace.runtime.graph.library,
            workspace.root.domInputs,
            record,
            key,
          )
        : undefined;
    const target = binding && workspace.itemOfRecord(binding.source.id)?.target;
    const bound =
      binding && target
        ? { target, prop: binding.prop }
        : // ADR-261 Decision 4: a component's text property — the edit sets the instance's value.
          key
          ? catalogPropertyTextTarget(workspace.runtime.graph, item.target, key)
          : undefined;
    return {
      record,
      key,
      bound,
      // (A bound text shows the prop's value: the position draws it as resolved.)
      text: key && record ? catalogTextOf(record, key) : "",
      // ADR-299 — the written value (runs of a range-formatted text) and whether the edit may
      // write runs: a text node's own `children` (a bound or a parent prop's text stays a string).
      value: key && record ? catalogTextValueOf(record, key) : "",
      rich:
        key === "children" &&
        !binding &&
        !bound &&
        !!record &&
        RICH_TEXT_HOST_TYPES.has(workspace.root.typeOf(record)),
    };
  });
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const pendingRichRef = useRef<HTMLDivElement>(null);
  const committed = useRef(false);
  /** The fallback textarea's selection once keys went there (the editor opens with it). */
  const typedSelection = useRef<{ from: number; to: number } | undefined>(
    undefined,
  );
  /** The typed text — still readable when the field unmounts (the edit ended elsewhere). */
  const draft = useRef<string | RichText>(
    start.rich ? start.value : start.text,
  );
  // The field sits on the record's text box — the content box Skia draws the text in (a Button's
  // label inside its padding, one line high), not the whole element (user 2026-10-20). Without a
  // Skia text node (not drawn yet) the element box stands in.
  const place = () => {
    const box = boundsOf(item.identity);
    return box
      ? {
          box,
          text: resolveTextEditBox(item.identity),
          x: viewportState.x,
          y: viewportState.y,
          zoom: viewportState.zoom,
        }
      : undefined;
  };
  const [placement, setPlacement] = useState(place);
  /**
   * The typed text's own size (scene px) — the field grows past the box as lines are added, and
   * past its width while an unwrapped (nowrap) text is typed: the hugging box follows a frame
   * later, and wrapping at the old width would stack the lines (user 2026-10-20, Button label).
   */
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
  /** The text's own size: a field already taller (wider) would report its own size. */
  const measure = (field: HTMLElement, unwrapped: boolean) => {
    const { height, width } = field.style;
    field.style.height = "0px";
    if (unwrapped) field.style.width = "0px";
    const next = {
      height: field.scrollHeight,
      width: unwrapped ? field.scrollWidth : 0,
    };
    field.style.height = height;
    field.style.width = width;
    setContentSize((current) =>
      current.width === next.width && current.height === next.height
        ? current
        : next,
    );
  };
  const placeRef = useRef(place);
  useLayoutEffect(() => {
    placeRef.current = place;
  });
  // The camera moves while editing (wheel pan/zoom): follow it — one subscription, and a frame
  // that moved nothing renders nothing.
  useEffect(
    () =>
      subscribeCanvasFrames(() =>
        setPlacement((current) => {
          const next = placeRef.current();
          return current &&
            next &&
            current.x === next.x &&
            current.y === next.y &&
            current.zoom === next.zoom &&
            current.box.x === next.box.x &&
            current.box.y === next.box.y &&
            current.box.width === next.box.width &&
            current.box.height === next.box.height &&
            sameTextBox(current.text, next.text)
            ? current
            : next;
        }),
      ),
    [],
  );

  /**
   * The typed text on the record, laid out live (the old editor's `silentUpdateTextProp`): a
   * hugging box grows and its siblings move while typing; no document write, no history.
   */
  const preview = (value: string | RichText) => {
    if (!start.key) return;
    const before = start.rich ? start.value : start.text;
    const changed = !sameTextValue(value, before);
    // A typed line break in a nowrap / normal text would be collapsed by the layout (and the
    // commit lifts `white-space` for it): the preview lifts it the same way, so a Button grows to
    // its second line while typing (user 2026-10-20).
    const lifted = changed
      ? committedWhiteSpace(start.record?.visual.whiteSpace, plainOf(value))
      : null;
    workspace.root.previewRecord(
      item.identity,
      changed
        ? {
            props: { [start.key]: value },
            ...(lifted ? { visual: { whiteSpace: lifted } } : {}),
          }
        : undefined,
    );
  };
  /** One command when the text changed. */
  const save = () => {
    if (committed.current) return;
    // The record's own text back first (no-op when nothing is shown); the command then lays out
    // the committed text.
    workspace.root.previewRecord(item.identity);
    const command =
      start.key &&
      (start.bound
        ? catalogBoundTextCommand(
            workspace.runtime.graph,
            item,
            start.key,
            start.bound,
            start.text,
            plainOf(draft.current),
            start.record?.visual.whiteSpace,
          )
        : catalogTextCommand(
            item,
            start.key,
            start.rich ? start.value : start.text,
            draft.current,
            start.record?.visual.whiteSpace,
          ));
    if (!command) return;
    committed.current = true;
    workspace.execute(command);
  };
  const commit = () => {
    try {
      save();
    } finally {
      workspace.session.endTextEdit();
    }
  };
  // The edit ended elsewhere (another selection, a reconcile): keep what was typed. The session's
  // edit is no longer this one, so it is not ended again here.
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  });
  useEffect(
    () => () => {
      try {
        saveRef.current();
      } catch (error) {
        // The element is gone (an undo removed it) — nothing to write to.
        console.warn("[CatalogTextEditor] text not saved:", error);
      }
    },
    [],
  );
  useLayoutEffect(() => {
    const field = fieldRef.current ?? pendingRichRef.current;
    if (!field) return;
    field.focus({ preventScroll: true });
    fieldRef.current?.select();
    // The field hugs the text from the first paint (its width is read from the DOM).
    measure(field, isUnwrapped(placeRef.current()?.text));
  }, []);
  // Start the editor chunk with the edit (the textarea takes the first keys meanwhile).
  useEffect(() => {
    void loadEditorField();
  }, []);

  if (!start.record || !start.key || !placement) return null;
  const visual = start.record.visual as Readonly<Record<string, unknown>>;
  const { box, text, x, y, zoom } = placement;
  const fontSize =
    text?.fontSize ??
    (Number(visual.fontSize) > 0 ? Number(visual.fontSize) : 16);
  // Skia carries the node's resolved line height in px. CSS must retain its ratio:
  // a px value would be inherited unchanged by every larger/smaller run in the PM editor.
  const lineHeight = text
    ? text.lineHeight !== undefined
      ? text.lineHeight / fontSize
      : "normal"
    : typeof visual.lineHeight === "number"
      ? visual.lineHeight > 4
        ? visual.lineHeight / fontSize
        : visual.lineHeight
      : typeof visual.lineHeight === "string"
        ? visual.lineHeight
        : "normal";
  const fontWeight = text
    ? text.fontWeight
    : typeof visual.fontWeight === "number" ||
        typeof visual.fontWeight === "string"
      ? visual.fontWeight
      : undefined;
  const fontFamily = text
    ? text.fontFamilies.join(", ")
    : typeof visual.fontFamily === "string"
      ? visual.fontFamily
      : undefined;
  const textAlign =
    text?.align ??
    (typeof visual.textAlign === "string"
      ? (visual.textAlign as CSSProperties["textAlign"])
      : undefined);
  const area = text
    ? {
        x: box.x + text.x,
        y: box.y + text.y,
        width: text.width,
        height: text.height,
      }
    : box;
  // Skia lays a nowrap / pre text out on one line (`nodeRendererText`): the field does the same —
  // `pre` keeps a typed line break visible (the commit lifts `nowrap` to `pre` for it).
  const unwrapped = isUnwrapped(text);
  // An unwrapped text's field hugs the text (Figma's text box), placed in the content box by the
  // text's alignment — the content box (a Badge's padding box) is wider than the text run (user
  // 2026-10-20). The box the Button grows to follows a frame later; the field stays centred on it.
  const hugWidth =
    unwrapped && contentSize.width > 0 ? contentSize.width : undefined;
  const alignFactor =
    textAlign === "center" ? 0.5 : textAlign === "right" ? 1 : 0;
  const fieldWidth = Math.max(hugWidth ?? area.width, 24);
  const fieldX =
    hugWidth !== undefined
      ? area.x + (area.width - hugWidth) * alignFactor
      : area.x;
  // The text's box, one line for one line (a textarea's default is two rows). A text typed past
  // its box keeps the box's vertical anchor: a middle-aligned label (Button) grows both ways.
  const fieldHeight = Math.max(area.height, contentSize.height);
  const fieldY =
    text?.verticalAlign === "middle"
      ? area.y + (area.height - fieldHeight) / 2
      : text?.verticalAlign === "bottom"
        ? area.y + area.height - fieldHeight
        : area.y;
  const style: CSSProperties = {
    position: "absolute",
    left: x + fieldX * zoom,
    top: y + fieldY * zoom,
    width: fieldWidth,
    height: fieldHeight,
    transform: `scale(${zoom})`,
    transformOrigin: "0 0",
    zIndex: 3,
    margin: 0,
    padding: 0,
    border: "none",
    // One screen pixel like the selection box (`selectionRenderer` strokes 1/zoom): the field is
    // scaled by the zoom, so a 1px line would be `zoom` px wide (user 2026-10-20). Drawn as a
    // shadow spread, not an outline: Chrome snaps `outline-width` to at least one device pixel
    // before the transform (0.2px → 0.5px at DPR 2), so 500% showed a 2.5px line (user 2026-11-02).
    // A spread is not snapped. `outline: none` also keeps the UA focus ring off the field.
    outline: "none",
    boxShadow: `0 0 0 ${1 / zoom}px var(--color-primary-500, #3b82f6)`,
    background: "transparent",
    resize: "none",
    overflow: "hidden",
    whiteSpace: unwrapped ? "pre" : "pre-wrap",
    fontSize,
    lineHeight,
    fontWeight,
    fontFamily,
    // The glyph variants Skia draws every text with (`DEFAULT_FONT_FEATURES` — Pretendard cv11 is
    // the single-storey a) and the Preview's body sets: the field showed another "a" (user
    // 2026-11-02). The old overlay carried them (ADR-027 D3); the catalog editor had dropped them.
    fontFeatureSettings: EDIT_FONT_FEATURES,
    // Every other type setting Skia draws the text with (user 2026-11-02 「편집에서도 모든 설정을
    // 맞춰」) — the field is the same text, so it looks the same while it is typed.
    ...(text ? skiaTextCss(text.source) : {}),
    ...(typeof visual.textTransform === "string"
      ? { textTransform: visual.textTransform as CSSProperties["textTransform"] }
      : {}),
    color:
      text?.color ??
      (typeof visual.color === "string" ? visual.color : undefined),
    textAlign,
  };
  const graph = workspace.runtime.graph;
  const markCss = (key: TextRunMarkKey, value: unknown) =>
    markCssOf(key, value, (id) => {
      const token = graph.getToken(id as TokenUse["tokenId"]);
      return token
        ? catalogTokenValue(token, workspace.root.colorMode)
        : undefined;
    });
  const textarea = (
    <textarea
      ref={fieldRef}
      className="catalog-text-editor"
      data-testid="catalog-text-editor"
      {...{ [TEXT_EDIT_SCOPE_ATTR]: "" }}
      defaultValue={plainOf(draft.current)}
      rows={1}
      style={style}
      spellCheck={false}
      onChange={(event) => {
        // (Typed before the editor chunk arrived: plain text over the written value.)
        draft.current = event.target.value;
        typedSelection.current = {
          from: event.target.selectionStart,
          to: event.target.selectionEnd,
        };
        preview(draft.current);
        measure(event.target, unwrapped);
      }}
      onBlur={() => {
        // (The editor taking the field's place blurs the textarea — not an end of the edit.)
        if (!editorLoaded) commit();
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Escape" ||
          (event.key === "Enter" && (event.metaKey || event.ctrlKey))
        ) {
          event.preventDefault();
          event.stopPropagation();
          commit();
        }
      }}
    />
  );
  // A textarea cannot represent runs: showing one causes a cold-start typography flash,
  // and typing into it would replace the entire rich value with a string before PM mounts.
  const fallback = start.rich && isRichText(draft.current) ? (
    <div
      ref={pendingRichRef}
      className="catalog-text-editor"
      data-testid="catalog-text-editor"
      {...{ [TEXT_EDIT_SCOPE_ATTR]: "" }}
      role="textbox"
      aria-label="텍스트 편집기 준비 중"
      aria-multiline="true"
      aria-busy="true"
      aria-readonly="true"
      data-shortcut-local="undo redo"
      tabIndex={0}
      style={style}
      onBlur={() => {
        if (!editorLoaded) commit();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        // This read-only loading surface still owns editing keys (Delete must not delete
        // the selected Canvas node through a global shortcut).
        event.stopPropagation();
        if (
          event.key === "Escape" ||
          (event.key === "Enter" && (event.metaKey || event.ctrlKey))
        ) {
          event.preventDefault();
          event.stopPropagation();
          commit();
        }
      }}
    >
      {draft.current.runs.map((run, index) => (
        <span
          key={index}
          data-text-run={index}
          style={Object.fromEntries(
            TEXT_RUN_MARK_KEYS.flatMap((key) => {
              const css = markCss(key, run.marks?.[key]);
              return css === undefined ? [] : [[key, css]];
            }),
          )}
        >
          {run.text}
        </span>
      ))}
    </div>
  ) : textarea;
  return (
    <Suspense fallback={fallback}>
      <EditorField
        identity={item.identity}
        initial={draft.current}
        selection={typedSelection.current}
        rich={start.rich}
        nodeValues={nodeValuesOf(visual, start.record?.inheritedText)}
        markCss={markCss}
        className="catalog-text-editor"
        style={{ ...style, overflow: "hidden", cursor: "text" }}
        onChange={(value, element) => {
          draft.current = value;
          preview(value);
          measure(element, unwrapped);
        }}
        onCommit={commit}
        onMount={(element) => measure(element, unwrapped)}
      />
    </Suspense>
  );
}

const plainOf = (value: string | RichText): string =>
  typeof value === "string" ? value : richTextPlain(value);

/** The written values are the same (runs compared as data). */
function sameTextValue(a: string | RichText, b: string | RichText): boolean {
  if (typeof a === "string" || typeof b === "string") return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The node's own value of each range key (a character without the mark draws it). */
function nodeValuesOf(
  visual: Readonly<Record<string, unknown>>,
  inherited: Readonly<Record<string, unknown>> | undefined,
): Partial<Record<TextRunMarkKey, unknown>> {
  return {
    fontWeight: visual.fontWeight ?? 400,
    fontStyle: visual.fontStyle ?? inherited?.fontStyle ?? "normal",
    textDecoration:
      visual.textDecoration ?? inherited?.textDecoration ?? "none",
    color: visual.color,
    fontSize: visual.fontSize,
  };
}

/** A mark value as the editor span's CSS (a token → its value in the root's color mode). */
function markCssOf(
  key: TextRunMarkKey,
  value: unknown,
  token: (id: string) => unknown,
): string | undefined {
  const literal =
    value && typeof value === "object" && "tokenId" in value
      ? token(String((value as { tokenId: string }).tokenId))
      : value;
  if (literal === undefined || literal === null) return undefined;
  if (key === "fontSize" && typeof literal === "number") return `${literal}px`;
  return String(literal);
}

const EDIT_FONT_FEATURES = DEFAULT_FONT_FEATURES.map(
  (feature) => `"${feature.name}" ${feature.value}`,
).join(", ");

const FONT_STYLES = ["normal", "italic", "oblique"] as const;

/** `SkiaNodeData.text` settings as the CSS that draws the same (the inverse of `canvasBinding`). */
function skiaTextCss(text: TextEditBox["source"]): CSSProperties {
  const css: CSSProperties = {};
  if (text.fontStyle) css.fontStyle = FONT_STYLES[text.fontStyle] ?? "normal";
  if (text.letterSpacing) css.letterSpacing = `${text.letterSpacing}px`;
  if (text.wordSpacing) css.wordSpacing = `${text.wordSpacing}px`;
  if (text.decoration) {
    const lines = [
      text.decoration & 1 ? "underline" : "",
      text.decoration & 2 ? "overline" : "",
      text.decoration & 4 ? "line-through" : "",
    ].filter(Boolean);
    if (lines.length > 0) css.textDecorationLine = lines.join(" ");
    if (text.decorationStyle) css.textDecorationStyle = text.decorationStyle;
    const color = cssColorOf(text.decorationColor);
    if (color) css.textDecorationColor = color;
  }
  if (text.wordBreak && text.wordBreak !== "normal")
    css.wordBreak = text.wordBreak;
  if (text.overflowWrap && text.overflowWrap !== "normal")
    css.overflowWrap = text.overflowWrap;
  if (text.textIndent) css.textIndent = `${text.textIndent}px`;
  if (text.fontVariant && text.fontVariant !== "normal")
    css.fontVariant = text.fontVariant;
  if (text.fontStretch && text.fontStretch !== "normal")
    css.fontStretch = text.fontStretch;
  if (text.textShadows?.length) {
    // `sigma` = CSS blur radius / 2.355 (`types.ts` `TextShadow`).
    css.textShadow = text.textShadows
      .map(
        (shadow) =>
          `${shadow.offsetX}px ${shadow.offsetY}px ${+(shadow.sigma * 2.355).toFixed(3)}px ${cssColorOf(shadow.color) ?? "transparent"}`,
      )
      .join(", ");
  }
  return css;
}

function sameTextBox(
  a: TextEditBox | undefined,
  b: TextEditBox | undefined,
): boolean {
  if (!a || !b) return a === b;
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.align === b.align &&
    a.fontSize === b.fontSize &&
    a.fontWeight === b.fontWeight &&
    a.lineHeight === b.lineHeight &&
    a.source === b.source
  );
}

function isUnwrapped(text: TextEditBox | undefined): boolean {
  return text?.whiteSpace === "nowrap" || text?.whiteSpace === "pre";
}
