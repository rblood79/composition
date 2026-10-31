/**
 * ADR-285 Decision 7 — the code view's editor: CodeMirror 6 (lazy — the 「코드」 panel's chunk, no
 * worker; the panel shows the code in it directly). Its edit operations are the identity evidence (Decision 3): every transaction's
 * changes are composed since the session's baseline and handed up with the text, so the apply
 * knows which anchors stayed, which were deleted and where text was pasted — no diff guessing.
 * Completion offers the closed vocabulary only (the palette's element names, the page's variables
 * and setters, its data and a row's fields — no JavaScript suggestions) and the snippets (the Data
 * panel's actions as code — the panel computes their code, the editor writes the lines that
 * differ); a refusal shows in the line as a diagnostic (checked 300 ms after typing stops).
 */
import { useEffect, useRef } from "react";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redoDepth,
  undoDepth,
} from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { linter, lintKeymap, type Diagnostic } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import {
  Annotation,
  ChangeSet,
  Compartment,
  EditorState,
  Transaction,
} from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import type { CodeViewChange } from "../../../../../../packages/shared/src/codeView/inverse/identity";

/** What completion may offer — the closed vocabulary of this page. */
export interface CodeEditorVocabulary {
  /** Element names (`<` …): the palette's components and `div`. */
  readonly tags: readonly string[];
  /** The page's variables (their setters are offered too). */
  readonly variables: readonly string[];
  /** Data names (`users`) · a row's fields (`item.` …). */
  readonly collections: readonly string[];
  readonly fields: readonly string[];
}

/** A snippet the panel offers (its code is computed for the draft as it is when picked). */
export interface CodeEditorSnippet {
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
}

/** What the panel can ask of the editor (its menu inserts a snippet). */
export interface CodeEditorApi {
  insertSnippet(id: string): Promise<boolean>;
}

export interface CodeEditorProblem {
  /** 1-based line. */
  readonly line: number;
  readonly message: string;
}

export interface CodeEditorProps {
  /** The session's baseline code — a new one while nothing is typed is written in place. */
  readonly code: string;
  /**
   * ADR-296 Phase 2 — a draft of this file kept while another file was open: the editor starts on
   * it (its text, its changes since `code`) instead of the baseline.
   */
  readonly draft?: {
    readonly text: string;
    readonly changes: readonly CodeViewChange[];
  };
  readonly label: string;
  readonly vocabulary: CodeEditorVocabulary;
  /** A dry run of the text (the panel's plan) — its refusals as line diagnostics. */
  readonly check?: (
    text: string,
    changes: readonly CodeViewChange[],
  ) => readonly CodeEditorProblem[];
  readonly snippets?: readonly CodeEditorSnippet[];
  /** A snippet's code for the draft (undefined = the draft does not apply — no snippet). */
  readonly snippet?: (
    id: string,
    text: string,
    changes: readonly CodeViewChange[],
  ) => Promise<string | undefined>;
  onReady?(api: CodeEditorApi): void;
  onChange(text: string, changes: readonly CodeViewChange[]): void;
  /** Escape (no completion open): leave the editor for the panel. */
  onEscape?(): void;
}

/** A composed change set as the apply reads it (baseline offsets). */
function codeEditorChanges(set: ChangeSet): CodeViewChange[] {
  const out: CodeViewChange[] = [];
  set.iterChanges((fromA, toA, _fromB, _toB, inserted) =>
    out.push({ fromA, toA, insert: inserted.toString() }),
  );
  return out;
}

const capital = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

/**
 * The lines that differ between two texts as edit operations (an LCS of lines): unchanged lines
 * stay untouched, so the elements on them keep their identity (Decision 3).
 */
export function codeEditorLineChanges(
  before: string,
  after: string,
): { from: number; to: number; insert: string }[] {
  // (Each line with its newline: the texts as `before + "\n"` — the last change gives it back.)
  const a = `${before}\n`.split("\n").slice(0, -1);
  const b = `${after}\n`.split("\n").slice(0, -1);
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1)
    for (let j = b.length - 1; j >= 0; j -= 1)
      lcs[i]![j] =
        a[i] === b[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const offsets = [0];
  for (const line of a) offsets.push(offsets.at(-1)! + line.length + 1);
  const out: { from: number; to: number; insert: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    const fromLine = i;
    let insert = "";
    while (
      (i < a.length || j < b.length) &&
      !(i < a.length && j < b.length && a[i] === b[j])
    ) {
      if (j < b.length && (i >= a.length || lcs[i]![j + 1]! >= lcs[i + 1]![j]!))
        insert += `${b[j++]!}\n`;
      else i += 1;
    }
    let from = offsets[fromLine]!;
    let to = offsets[i]!;
    // (The virtual last newline: out of the text again.)
    if (from > before.length) {
      // (Lines after the last: a newline before them, none after.)
      from = to = before.length;
      insert = `\n${insert.slice(0, -1)}`;
    } else if (to > before.length) {
      to = before.length;
      if (insert) insert = insert.slice(0, -1);
      else if (from > 0) from -= 1;
    }
    out.push({ from, to, insert });
  }
  return out;
}

function vocabularySource(
  vocabulary: CodeEditorVocabulary,
  snippets: () => readonly CodeEditorSnippet[],
  insert: (view: EditorView, id: string) => Promise<boolean>,
) {
  return (context: CompletionContext): CompletionResult | null => {
    const tag = context.matchBefore(/<[A-Za-z]*$/);
    if (tag)
      return {
        from: tag.from + 1,
        options: vocabulary.tags.map((name): Completion => ({
          label: name,
          type: "type",
        })),
        validFor: /^[A-Za-z]*$/,
      };
    const field = context.matchBefore(/\bitem\.[\w$]*$/);
    if (field)
      return {
        from: field.from + "item.".length,
        options: vocabulary.fields.map((name): Completion => ({
          label: name,
          type: "property",
        })),
        validFor: /^[\w$]*$/,
      };
    const word = context.matchBefore(/[\p{L}_$][\p{L}\w$]*$/u) ?? {
      from: context.pos,
      to: context.pos,
    };
    if (word.from === word.to && !context.explicit) return null;
    return {
      from: word.from,
      options: [
        // (A snippet replaces the typed word with the action's code — the lines that differ.)
        ...snippets().map((snippet): Completion => ({
          label: snippet.label,
          ...(snippet.detail ? { detail: snippet.detail } : {}),
          type: "text",
          boost: -1,
          apply: (view, _completion, from, to) => {
            view.dispatch({ changes: { from, to, insert: "" } });
            void insert(view, snippet.id);
          },
        })),
        ...vocabulary.variables.flatMap((name): Completion[] => [
          { label: name, type: "variable" },
          { label: `set${capital(name)}`, type: "function" },
        ]),
        ...vocabulary.collections.map((name): Completion => ({
          label: name,
          type: "constant",
        })),
      ],
      validFor: /^[\p{L}\w$]*$/u,
    };
  };
}

/** A new baseline written into the editor (not the user's edit — no `onChange`, no undo step). */
const rebase = Annotation.define<true>();

/**
 * ⌘Z · ⌘⇧Z in the editor: the typed text's own steps first (`data-shortcut-local` — ADR-212, the
 * Builder's undo is a capture-phase global), the document's history when there are none — so with
 * nothing typed, Undo in the editor is the document's Undo and the editor follows it.
 */
function keepHistoryLocal(host: HTMLElement, state: EditorState) {
  const ids = [
    undoDepth(state) > 0 ? "undo" : "",
    redoDepth(state) > 0 ? "redo" : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (ids) host.setAttribute("data-shortcut-local", ids);
  else host.removeAttribute("data-shortcut-local");
}

export default function CodeEditor(props: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<{ view: EditorView; reset(length: number): void }>(
    null,
  );
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    let changes = props.draft
      ? ChangeSet.of(
          props.draft.changes.map((change) => ({
            from: change.fromA,
            to: change.toA,
            insert: change.insert,
          })),
          props.code.length,
        )
      : ChangeSet.empty(props.code.length);
    const typed = new Compartment();
    const insertSnippet = async (target: EditorView, id: string) => {
      const text = target.state.doc.toString();
      const next = await latest.current.snippet?.(
        id,
        text,
        codeEditorChanges(changes),
      );
      // (Typed meanwhile: the snippet was for another text — not written.)
      if (next === undefined || target.state.doc.toString() !== text)
        return false;
      target.dispatch({ changes: codeEditorLineChanges(text, next) });
      return true;
    };
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: props.draft?.text ?? props.code,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          foldGutter(),
          typed.of(history()),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          javascript({ jsx: true, typescript: true }),
          autocompletion({
            override: [
              vocabularySource(
                props.vocabulary,
                () => latest.current.snippets ?? [],
                insertSnippet,
              ),
            ],
          }),
          linter(
            (view): Diagnostic[] => {
              const check = latest.current.check;
              if (!check) return [];
              const doc = view.state.doc;
              return check(doc.toString(), codeEditorChanges(changes)).map(
                (problem) => {
                  const line = doc.line(
                    Math.min(Math.max(problem.line, 1), doc.lines),
                  );
                  return {
                    from: line.from,
                    to: line.to,
                    severity: "error",
                    message: problem.message,
                  };
                },
              );
            },
            { delay: 300 },
          ),
          keymap.of([
            ...closeBracketsKeymap,
            ...completionKeymap,
            ...lintKeymap,
            ...searchKeymap,
            ...foldKeymap,
            ...historyKeymap,
            indentWithTab,
            ...defaultKeymap,
            {
              key: "Escape",
              run: () => {
                latest.current.onEscape?.();
                return !!latest.current.onEscape;
              },
            },
          ]),
          EditorView.contentAttributes.of({ "aria-label": props.label }),
          EditorView.updateListener.of((update) => {
            keepHistoryLocal(parent, update.state);
            if (!update.docChanged) return;
            if (update.transactions.some((tr) => tr.annotation(rebase))) return;
            changes = changes.compose(update.changes);
            latest.current.onChange(
              update.state.doc.toString(),
              codeEditorChanges(changes),
            );
          }),
          EditorView.theme({
            "&": { height: "100%", fontSize: "12px" },
            ".cm-scroller": {
              fontFamily: "var(--font-family-mono, ui-monospace, monospace)",
            },
          }),
        ],
      }),
    });
    editor.current = {
      view,
      reset: (length) => {
        changes = ChangeSet.empty(length);
        // (The typed steps belonged to the old baseline — the history starts again.)
        view.dispatch({ effects: typed.reconfigure([]) });
        view.dispatch({ effects: typed.reconfigure(history()) });
      },
    };
    latest.current.onReady?.({
      insertSnippet: async (id) => {
        const done = await insertSnippet(view, id);
        view.focus();
        return done;
      },
    });
    return () => {
      editor.current = null;
      view.destroy();
    };
    // (The editor is made once — a new baseline is written in by the effect below.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new baseline (the document changed while nothing was typed): the lines that differ are
  // written in place — scroll and cursor stay — and the edit is counted from it again.
  // (The baseline it was made on or last written in — a kept draft is not overwritten on mount.)
  const written = useRef(props.code);
  useEffect(() => {
    const current = editor.current;
    if (!current) return;
    if (written.current === props.code) return;
    written.current = props.code;
    const text = current.view.state.doc.toString();
    if (text !== props.code)
      current.view.dispatch({
        changes: codeEditorLineChanges(text, props.code),
        annotations: [rebase.of(true), Transaction.addToHistory.of(false)],
      });
    current.reset(props.code.length);
  }, [props.code]);

  return <div ref={host} className="code-view-editor" />;
}
