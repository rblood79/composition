/**
 * ADR-299 Decision 4 — the inline text editor's input: ProseMirror core (model · state · transform ·
 * view · keymap), loaded when an edit starts (`CatalogTextEditor` imports this chunk lazily). PM
 * owns the browser input (selection, IME composition, paste); the document stays the catalog's —
 * every change leaves as `fromDoc` (runs in normal form) for the record preview, and the edit
 * commits one command in `CatalogTextEditor`.
 *
 * - Enter = a line break (`hard_break`), ⌘B · ⌘I · ⌘U toggle a range mark (툴바 없음 — 사용자 결정 2),
 *   ⌘Enter · Escape commit. Undo inside the edit is the editor's own state stack (no PM `history`);
 *   after the commit ⌘Z is the History's one step.
 * - The edit scope (`isInTextEditScope` — the editor, the Typography section, their popovers): a
 *   press or a focus move outside commits; inside it the editor stays mounted with its selection,
 *   drawn while the focus is in the panel (`text-edit-held-selection`).
 * - Marks over a template token widen to the whole token (`widenToTokens`, 리뷰 h1).
 */
import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import type { Node as PMNode, Schema } from "prosemirror-model";
import {
  EditorState,
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type Transaction,
} from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { keymap } from "prosemirror-keymap";
import "./EditorField.css";
import {
  textRunMarksIn,
  widenToTokens,
  type TextRunMarkKey,
} from "../../../../../../../../packages/shared/src/catalog/document/textRuns";
import type { RichText } from "../../../../../../../../packages/shared/src/catalog/document/types";
import {
  isInTextEditScope,
  notifyTextEditorChange,
  setTextEditorHandle,
  TEXT_EDIT_SCOPE_ATTR,
} from "../../../../catalogRuntime/textEditorHandle";
import {
  createTextRunSchema,
  fromDoc,
  plainOfDoc,
  toDoc,
  type MarkCss,
} from "./textRunsBridge";

export interface EditorFieldProps {
  identity: string;
  /** The written text (a template stays as written). */
  initial: string | RichText;
  /** Range marks allowed (a text node's own `children`); else plain text only. */
  rich: boolean;
  /** The node's own value of each range key — what a character without the mark draws. */
  nodeValues: Partial<Record<TextRunMarkKey, unknown>>;
  markCss: MarkCss;
  className: string;
  style: CSSProperties;
  /** Every change: the written value (runs in normal form — a string when rich is off). */
  onChange(value: string | RichText, element: HTMLElement): void;
  onCommit(): void;
  /** The mounted editable (the field's first measure). */
  onMount(element: HTMLElement): void;
  /**
   * The selection to open with (text offsets): the place the fallback textarea's caret was when
   * the user typed before the editor arrived. Absent → the whole text (the textarea's `select()`).
   */
  selection?: { from: number; to: number };
}

const HELD = new PluginKey<boolean>("text-edit-held-selection");
/** The selected range stays visible while the focus is in the panel (the browser drops it on blur). */
const heldSelection = new Plugin<boolean>({
  key: HELD,
  state: {
    init: () => false,
    apply: (tr, held) => (tr.getMeta(HELD) as boolean | undefined) ?? held,
  },
  props: {
    decorations(state) {
      if (!HELD.getState(state) || state.selection.empty) return null;
      return DecorationSet.create(state.doc, [
        Decoration.inline(state.selection.from, state.selection.to, {
          class: "text-edit-held-selection",
        }),
      ]);
    },
  },
});

/** Range keys' toggle values (the panel's Style · Decoration toggles use the same pairs). */
const TOGGLES: Record<
  "fontWeight" | "fontStyle" | "textDecoration",
  { on: string | number; off: string | number; isOn(value: unknown): boolean }
> = {
  fontWeight: { on: 700, off: 400, isOn: (value) => Number(value) >= 600 },
  fontStyle: {
    on: "italic",
    off: "normal",
    isOn: (value) => value === "italic" || value === "oblique",
  },
  textDecoration: {
    on: "underline",
    off: "none",
    isOn: (value) => typeof value === "string" && value.includes("underline"),
  },
};

/** `[from, to)` widened over template tokens (offsets = doc positions: `doc(inline*)`). */
function rangeOf(state: EditorState): [number, number] {
  const { from, to } = state.selection;
  return widenToTokens(plainOfDoc(state.doc), from, to);
}

/**
 * A range value the node already draws (its own value — a color as `#rrggbb` or `#rrggbbff`, a
 * number or its text): a mark with it would only keep a run that changes nothing.
 */
function sameAsNode(value: unknown, node: unknown): boolean {
  if (value === undefined || node === undefined || node === null) return false;
  const text = (item: unknown) =>
    typeof item === "string" || typeof item === "number"
      ? String(item).trim().toLowerCase().replace(/^(#[0-9a-f]{6})ff$/, "$1")
      : JSON.stringify(item);
  return text(value) === text(node);
}

function setMark(
  schema: Schema,
  key: TextRunMarkKey,
  written: unknown,
  node: unknown,
): Command {
  const value = sameAsNode(written, node) ? undefined : written;
  return (state, dispatch) => {
    const type = schema.marks[key];
    if (!type) return false;
    const [from, to] = rangeOf(state);
    const tr = state.tr;
    if (from === to) {
      tr.removeStoredMark(type);
      if (value !== undefined) tr.addStoredMark(type.create({ value }));
    } else {
      tr.removeMark(from, to, type);
      if (value !== undefined) tr.addMark(from, to, type.create({ value }));
    }
    dispatch?.(tr);
    return true;
  };
}

export default function EditorField(props: EditorFieldProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  /** One commit per edit (a press outside is a pointerdown and then the focus leaving). */
  const ended = useRef(false);
  const endEdit = () => {
    if (ended.current) return;
    ended.current = true;
    latest.current.onCommit();
  };
  useLayoutEffect(() => {
    latest.current = props;
  });

  useLayoutEffect(() => {
    const element = host.current!;
    const { rich, initial, identity } = latest.current;
    const schema = createTextRunSchema(
      (key, value) => latest.current.markCss(key, value),
      rich,
    );
    const undo: { doc: PMNode; from: number; to: number; at: number }[] = [];
    const redo: typeof undo = [];
    const valueOf = (doc: PMNode): string | RichText =>
      rich ? fromDoc(doc) : plainOfDoc(doc);
    const restore = (
      view: EditorView,
      from: typeof undo,
      to: typeof undo,
    ): boolean => {
      const entry = from.pop();
      if (!entry) return true;
      const { state } = view;
      to.push({
        doc: state.doc,
        from: state.selection.from,
        to: state.selection.to,
        at: 0,
      });
      const tr = state.tr.replaceWith(
        0,
        state.doc.content.size,
        entry.doc.content,
      );
      tr.setSelection(
        TextSelection.create(
          tr.doc,
          Math.min(entry.from, tr.doc.content.size),
          Math.min(entry.to, tr.doc.content.size),
        ),
      );
      view.dispatch(tr.setMeta("text-edit-history", true));
      return true;
    };
    const toggle =
      (key: keyof typeof TOGGLES): Command =>
      (state, dispatch) => {
        if (!rich) return true; // (no browser formatting in a plain text)
        const pair = TOGGLES[key];
        const node = latest.current.nodeValues[key];
        const [from, to] = rangeOf(state);
        let allOn = from < to;
        state.doc.nodesBetween(from, to, (child) => {
          if (!child.isInline) return;
          const mark = child.marks.find((item) => item.type.name === key);
          if (!pair.isOn(mark ? mark.attrs.value : node)) allOn = false;
        });
        if (from === to) {
          const stored = (
            state.storedMarks ?? state.selection.$from.marks()
          ).find((item) => item.type.name === key);
          allOn = pair.isOn(stored ? stored.attrs.value : node);
        }
        const value = allOn
          ? pair.isOn(node)
            ? pair.off
            : undefined
          : pair.isOn(node)
            ? undefined
            : pair.on;
        return setMark(schema, key, value, node)(state, dispatch);
      };
    const commit: Command = () => {
      endEdit();
      return true;
    };
    let view: EditorView;
    const state = EditorState.create({
      schema,
      doc: toDoc(schema, initial),
      plugins: [
        keymap({
          Enter: (state, dispatch) => {
            dispatch?.(
              state.tr
                .replaceSelectionWith(schema.nodes.hard_break!.create(), true)
                .scrollIntoView(),
            );
            return true;
          },
          "Mod-Enter": commit,
          Escape: commit,
          "Mod-b": toggle("fontWeight"),
          "Mod-i": toggle("fontStyle"),
          "Mod-u": toggle("textDecoration"),
          "Mod-z": () => restore(view, undo, redo),
          "Shift-Mod-z": () => restore(view, redo, undo),
          "Mod-y": () => restore(view, redo, undo),
        }),
        heldSelection,
      ],
    });
    // (PM's own editable inside the field — React keeps the field's class · style, PM its editable's.)
    view = new EditorView(element, {
        state,
        attributes: {
          spellcheck: "false",
          class: "catalog-text-editor-input",
          style:
            "outline: none; white-space: inherit; min-height: 100%; caret-color: currentColor",
        },
        // Pasted text only (and this editor's own marks — `parseDOM` reads `data-run-mark` spans).
        transformPastedHTML: (html) => html,
        clipboardTextSerializer: (slice) => {
          let text = "";
          slice.content.forEach((node) => {
            text += node.isText ? node.text! : "\n";
          });
          return text;
        },
        dispatchTransaction(tr: Transaction) {
          const before = view.state;
          const next = before.apply(tr);
          view.updateState(next);
          if (tr.docChanged) {
            if (!tr.getMeta("text-edit-history")) {
              const now = Date.now();
              const last = undo.at(-1);
              // (Typing in one burst is one undo step.)
              if (!last || now - last.at > 500 || view.composing)
                undo.push({
                  doc: before.doc,
                  from: before.selection.from,
                  to: before.selection.to,
                  at: now,
                });
              else last.at = now;
              redo.length = 0;
            }
            latest.current.onChange(valueOf(next.doc), element);
          }
          notifyTextEditorChange();
        },
        handleDOMEvents: {
          focus: (current) => {
            if (HELD.getState(current.state))
              current.dispatch(current.state.tr.setMeta(HELD, false));
            return false;
          },
          blur: (current) => {
            current.dispatch(current.state.tr.setMeta(HELD, true));
            return false;
          },
        },
      });
    // Opening selects the whole text (the textarea's `select()`) — or, when keys went to the
    // fallback textarea first, keeps its caret (the next key must not replace what was typed).
    const size = view.state.doc.content.size;
    const opening = latest.current.selection;
    const clamp = (offset: number) => Math.max(0, Math.min(size, offset));
    view.dispatch(
      view.state.tr.setSelection(
        opening
          ? TextSelection.create(
              view.state.doc,
              clamp(opening.from),
              clamp(opening.to),
            )
          : TextSelection.create(view.state.doc, 0, size),
      ),
    );
    view.focus();
    setTextEditorHandle({
      identity,
      rich,
      // (Values as the panel shows them — a token as its value, a size in px; `mixed` kept.)
      marks: () => {
        const value = fromDoc(view.state.doc);
        const [from, to] = rangeOf(view.state);
        const raw: Partial<Record<TextRunMarkKey, unknown>> = {};
        if (from === to) {
          for (const mark of view.state.storedMarks ??
            view.state.selection.$from.marks())
            raw[mark.type.name as TextRunMarkKey] = mark.attrs.value;
        } else Object.assign(raw, textRunMarksIn(value, from, to));
        const out: Partial<Record<TextRunMarkKey, unknown>> = {};
        for (const [key, item] of Object.entries(raw) as [TextRunMarkKey, unknown][])
          out[key] =
            item === "mixed" ? item : (latest.current.markCss(key, item) ?? item);
        return out;
      },
      apply: (key, value) => {
        if (!rich) return;
        setMark(
          schema,
          key,
          value,
          latest.current.nodeValues[key],
        )(view.state, view.dispatch);
      },
    });
    latest.current.onMount(element);
    return () => {
      setTextEditorHandle(undefined);
      view.destroy();
    };
  }, []);

  // The edit scope: a press or a focus move outside it commits (a press inside — the Typography
  // section, its popovers — keeps the edit and its selection).
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!isInTextEditScope(event.target)) endEdit();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (
        isInTextEditScope(event.target) &&
        event.relatedTarget &&
        !isInTextEditScope(event.relatedTarget)
      )
        endEdit();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusout", onFocusOut, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusout", onFocusOut, true);
    };
  }, []);

  return (
    <div
      ref={host}
      className={props.className}
      data-testid="catalog-text-editor"
      {...{ [TEXT_EDIT_SCOPE_ATTR]: "" }}
      style={props.style}
    />
  );
}
