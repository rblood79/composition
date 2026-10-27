/**
 * ADR-285 Decision 7 — the code view's editor: CodeMirror 6 (lazy — the 「코드」 panel's edit only,
 * no worker). Its edit operations are the identity evidence (Decision 3): every transaction's
 * changes are composed since the session's baseline and handed up with the text, so the apply
 * knows which anchors stayed, which were deleted and where text was pasted — no diff guessing.
 * Completion offers the closed vocabulary only (the palette's element names, the page's variables
 * and setters, its data and a row's fields — no JavaScript suggestions); a refusal shows in the
 * line as a diagnostic (checked 300 ms after typing stops).
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
import { ChangeSet, EditorState } from "@codemirror/state";
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

export interface CodeEditorProblem {
  /** 1-based line. */
  readonly line: number;
  readonly message: string;
}

export interface CodeEditorProps {
  /** The session's baseline code (the editor starts from it). */
  readonly code: string;
  readonly label: string;
  readonly vocabulary: CodeEditorVocabulary;
  /** A dry run of the text (the panel's plan) — its refusals as line diagnostics. */
  readonly check?: (
    text: string,
    changes: readonly CodeViewChange[],
  ) => readonly CodeEditorProblem[];
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

function vocabularySource(vocabulary: CodeEditorVocabulary) {
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
    const word = context.matchBefore(/[A-Za-z_$][\w$]*$/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    return {
      from: word.from,
      options: [
        ...vocabulary.variables.flatMap((name): Completion[] => [
          { label: name, type: "variable" },
          { label: `set${capital(name)}`, type: "function" },
        ]),
        ...vocabulary.collections.map((name): Completion => ({
          label: name,
          type: "constant",
        })),
      ],
      validFor: /^[\w$]*$/,
    };
  };
}

export default function CodeEditor(props: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    let changes = ChangeSet.empty(props.code.length);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: props.code,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          foldGutter(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          javascript({ jsx: true, typescript: true }),
          autocompletion({
            override: [vocabularySource(props.vocabulary)],
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
            if (!update.docChanged) return;
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
    view.focus();
    return () => view.destroy();
    // (The baseline starts the editor once — a new session remounts it, `key` in the panel.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={host} className="code-view-editor" />;
}
