import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Code } from "lucide-react";
import { Button } from "react-aria-components/Button";
import { Menu, MenuItem, MenuTrigger } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { useI18n } from "@/i18n";
import { CODE_CATALOG_SUPPORTED_TYPES } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { EntryId } from "../../../../../../packages/shared/src/catalog/document/types";
import type { CodeViewChange } from "../../../../../../packages/shared/src/codeView/inverse/identity";
import type { CodeViewResult } from "../../../../../../packages/shared/src/codeView/types";
import {
  CatalogWorkspaceGate,
  useCatalogRevision,
  useCatalogWorkspace,
} from "../../catalogRuntime/react";
import { catalogCollectionTables } from "../../catalogRuntime/catalogDataStore";
import { catalogCodeViewData } from "../../catalogRuntime/codeView";
import {
  schemaHasFormula,
  useFormulaEngine,
} from "../../catalogRuntime/formulaEngine";
import {
  catalogCodeViewApply,
  catalogCodeViewPlan,
  catalogCodeViewSession,
  type CatalogCodeViewRejection,
  type CatalogCodeViewSession,
} from "../../catalogRuntime/codeViewEdit";
import {
  catalogCodeViewSnippetCode,
  catalogCodeViewSnippets,
} from "../../catalogRuntime/codeViewSnippets";
import { EmptyState } from "../../components/feedback/EmptyState";
import { PanelContents } from "../../components/panel/PanelContents";
import { PanelHeader } from "../../components/panel/PanelHeader";
import { Section } from "../../components/panel/Section";
import { iconProps } from "../../../utils/ui/uiConstants";
import type { CodeEditorApi, CodeEditorVocabulary } from "./CodeEditor";
import { codeViewMessages, codeViewSnippetLabels } from "./codeViewMessages";
import "./CatalogCodeViewPanel.css";
import "../../components/property/PropertyRowMenu.css";

/** ADR-285 — the editor (CodeMirror 6) is its own chunk, loaded when the panel opens. */
const CodeEditor = lazy(() => import("./CodeEditor"));

/**
 * The code view (ADR-284 Phase 6 · ADR-285): the shown page as React Aria code in the reference
 * examples' shape, in the editor directly. While nothing is typed the editor follows the document
 * (each change writes the new code in); the first edit holds the page's code at that moment as the
 * session's baseline. Apply reads the edit across the closed vocabulary — elements, props, text,
 * events, variables, a list's `filter` terms — and applies the difference as the document's
 * commands in one step (one Undo). A line it cannot take refuses the whole edit with the line, why,
 * and what to do instead; a document changed meanwhile refuses it too (the draft stays — 「다시
 * 불러오기」).
 */
export function CatalogCodeViewPanel() {
  return (
    <CatalogWorkspaceGate>
      <div className="panel code-view-panel">
        <CodeViewContent />
      </div>
    </CatalogWorkspaceGate>
  );
}

interface Draft {
  readonly session: CatalogCodeViewSession;
  readonly text: string;
  readonly changes: readonly CodeViewChange[];
}

function CodeViewContent() {
  const { t, locale } = useI18n();
  const messages = codeViewMessages(locale);
  const snippetLabels = codeViewSnippetLabels(locale);
  const workspace = useCatalogWorkspace();
  const pageId = useSyncExternalStore(
    workspace.session.subscribe,
    () => workspace.session.getSnapshot().pageId,
  );
  // The page's code reads the whole document (its nodes, data, variables) — the whole revision.
  const revision = useCatalogRevision(workspace);
  // ADR-286: the data definitions are the document's — the code reads one source.
  const tables = useMemo(() => {
    void revision;
    return catalogCollectionTables(workspace.runtime.graph);
  }, [revision, workspace]);
  const data = useMemo(() => {
    void revision;
    return catalogCodeViewData(workspace.runtime.graph);
  }, [revision, workspace]);
  // ADR-291 — a computed column's formula is shown over field keys once the engine is loaded.
  const formulaEngine = useFormulaEngine(
    data.collections.some((collection) => schemaHasFormula(collection.schema)),
  );
  // The page's code now — the editor's baseline while nothing is typed.
  const live = useMemo((): CatalogCodeViewSession | undefined => {
    void revision;
    void formulaEngine;
    if (!pageId) return undefined;
    try {
      return catalogCodeViewSession(
        workspace.runtime.graph,
        pageId as EntryId<"page">,
        data,
      );
    } catch {
      return undefined;
    }
  }, [data, formulaEngine, pageId, revision, workspace]);
  const result: CodeViewResult | undefined = live?.baseline;
  // (A draft per page — the typed text on the baseline it started from. Another page's draft is
  // kept, never applied here.)
  const [drafts, setDrafts] = useState<ReadonlyMap<string, Draft>>(new Map());
  const [previous, setPrevious] = useState<string | null>(null);
  const [report, setReport] = useState<
    | { kind: "applied"; count: number }
    | { kind: "rejected"; lines: readonly CatalogCodeViewRejection[] }
    | null
  >(null);
  const draft = pageId ? drafts.get(pageId) : undefined;
  const session = draft?.session ?? live;
  // (Cancel and 「다시 불러오기」 start the editor again on the current code.)
  const [opened, setOpened] = useState(0);
  const setDraft = (next: Draft | undefined) =>
    setDrafts((map) => {
      const copy = new Map(map);
      if (next) copy.set(next.session.pageId, next);
      else if (pageId) copy.delete(pageId);
      return copy;
    });
  const reasonText = (line: CatalogCodeViewRejection) =>
    `${messages[line.reason].reason}${line.detail ? ` (${line.detail})` : ""} — ${messages[line.reason].alternative}`;

  const vocabulary = useMemo(
    (): CodeEditorVocabulary => ({
      tags: ["div", ...CODE_CATALOG_SUPPORTED_TYPES].sort(),
      variables: result ? Object.keys(result.symbols.variables) : [],
      collections: data.collections.map((collection) => collection.name),
      fields: [
        ...new Set(
          data.collections.flatMap((collection) =>
            collection.schema.map((field) => field.key),
          ),
        ),
      ],
    }),
    [data, result],
  );
  // Snippets: the Data panel's actions on the page's bound lists (their code for the draft).
  const snippets = useMemo(() => {
    void revision;
    if (!pageId) return [];
    return catalogCodeViewSnippets(
      workspace.runtime.graph.commandReader,
      pageId as EntryId<"page">,
      tables,
      data,
    );
  }, [data, pageId, revision, tables, workspace]);
  const snippetItems = useMemo(
    () =>
      snippets.map((snippet) => ({
        id: snippet.id,
        label: snippetLabels[snippet.kind],
        detail: [snippet.collection, snippet.field?.key]
          .filter(Boolean)
          .join(" · "),
      })),
    [snippetLabels, snippets],
  );
  // (The editor's check · snippets read the session at commit — not a ref written during render.)
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  });
  const editorApi = useRef<CodeEditorApi | null>(null);
  const snippetCode = useCallback(
    async (id: string, text: string, changes: readonly CodeViewChange[]) => {
      const session = sessionRef.current;
      const snippet = snippets.find((item) => item.id === id);
      if (!session || !snippet) return undefined;
      return catalogCodeViewSnippetCode({
        graph: workspace.runtime.graph,
        session,
        edited: text,
        changes,
        data,
        tables,
        newId: workspace.newId,
        snippet,
        text: {
          allLabel: t("dataView.allOption"),
          countText: t("dataView.countText"),
          viewName: (list) => t("dataView.viewName", { list }),
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, snippets, tables, workspace],
  );
  const check = useCallback(
    (text: string, changes: readonly CodeViewChange[]) => {
      const session = sessionRef.current;
      if (!session) return [];
      return catalogCodeViewPlan({
        reader: workspace.runtime.graph.commandReader,
        session,
        edited: text,
        changes,
        data,
        newId: workspace.newId,
      }).rejected.map((line) => ({
        line: line.line,
        message: reasonText(line),
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, workspace, messages],
  );

  if (!session || !result || !pageId)
    return (
      <>
        <PanelHeader
          icon={<Code size={iconProps.size} />}
          title={t("codeView.title")}
          panelId="codeView"
        />
        <PanelContents>
          <EmptyState
            icon={<Code size={iconProps.size} />}
            message={t("codeView.noPage")}
          />
        </PanelContents>
      </>
    );

  const restart = () => {
    setDraft(undefined);
    setOpened((count) => count + 1);
  };
  const apply = () => {
    if (!draft) return;
    const outcome = catalogCodeViewApply(
      workspace,
      draft.session,
      draft.text,
      draft.changes,
      data,
    );
    if (!outcome.applied) {
      setReport({ kind: "rejected", lines: outcome.rejected });
      return;
    }
    setReport({ kind: "applied", count: outcome.count });
    setPrevious(null);
    setDraft(undefined);
  };
  const reload = () => {
    if (draft) setPrevious(draft.text);
    setReport(null);
    restart();
  };
  const stale =
    report?.kind === "rejected" &&
    report.lines.some((line) => line.reason === "staleBaseline");

  return (
    <>
      <PanelHeader
        icon={<Code size={iconProps.size} />}
        title={t("codeView.title")}
        panelId="codeView"
      />
      <PanelContents>
        <Section title={t("codeView.section")}>
          <EditorBoundary
            fallback={
              <>
                <p className="code-view-report" role="alert">
                  {t("codeView.editorUnavailable")}
                </p>
                <pre
                  className="code-view-code"
                  aria-label={t("codeView.codeLabel")}
                >
                  {draft ? draft.text : <code>{marked(result)}</code>}
                </pre>
              </>
            }
          >
            <Suspense
              fallback={
                <pre className="code-view-code">
                  {draft?.text ?? session.baseline.code}
                </pre>
              }
            >
              <CodeEditor
                key={`${pageId}:${opened}`}
                code={session.baseline.code}
                label={t("codeView.editorLabel")}
                vocabulary={vocabulary}
                check={check}
                snippets={snippetItems}
                snippet={snippetCode}
                onReady={(api) => {
                  editorApi.current = api;
                }}
                onChange={(text, changes) => {
                  // (Back to the baseline text: nothing is typed — it follows the document again.)
                  setDraft(
                    text === session.baseline.code
                      ? undefined
                      : { session, text, changes },
                  );
                  setReport(null);
                }}
              />
            </Suspense>
          </EditorBoundary>
          {report?.kind === "rejected" ? (
            <div className="code-view-report" role="alert">
              <p>{t("codeView.rejected")}</p>
              <ul>
                {report.lines.map((line) => (
                  <li key={`${line.line}:${line.reason}:${line.text}`}>
                    {t("codeView.rejectedLine", {
                      line: line.line,
                      reason: reasonText(line),
                    })}
                    {line.text.trim() ? <code>{line.text.trim()}</code> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : report?.kind === "applied" ? (
            <p className="code-view-report" role="status">
              {t("codeView.applied", { count: report.count })}
            </p>
          ) : null}
          {previous !== null ? (
            <details className="code-view-previous">
              <summary>{t("codeView.previousDraft")}</summary>
              <pre className="code-view-code">{previous}</pre>
            </details>
          ) : null}
          <div className="code-view-actions">
            <Button
              className="control-button"
              data-variant="primary"
              isDisabled={!draft}
              onPress={apply}
            >
              {t("codeView.apply")}
            </Button>
            <MenuTrigger>
              <Button className="control-button">{snippetLabels.menu}</Button>
              {/* The Builder menu surface (PropertyRowMenu.css): border · shadow on the Popover,
                  the Menu borderless — RAC reference, 2026-10-29. */}
              <Popover
                className="react-aria-Popover property-select-popover property-row-menu-popover"
                placement="bottom start"
              >
                <Menu
                  className="react-aria-Menu property-row-menu"
                  aria-label={snippetLabels.menu}
                  items={snippetItems}
                  renderEmptyState={() => snippetLabels.none}
                  onAction={(key) =>
                    void editorApi.current?.insertSnippet(String(key))
                  }
                >
                  {(item) => (
                    <MenuItem
                      id={item.id}
                      className="react-aria-MenuItem"
                      textValue={`${item.label} ${item.detail}`}
                    >
                      <span>{item.label}</span>
                      <span className="code-view-snippet-detail">
                        {item.detail}
                      </span>
                    </MenuItem>
                  )}
                </Menu>
              </Popover>
            </MenuTrigger>
            {stale ? (
              <Button className="control-button" onPress={reload}>
                {t("codeView.reload")}
              </Button>
            ) : null}
            {draft ? (
              <Button
                className="control-button"
                onPress={() => {
                  setReport(null);
                  setPrevious(null);
                  restart();
                }}
              >
                {t("codeView.cancel")}
              </Button>
            ) : null}
          </div>
        </Section>
      </PanelContents>
    </>
  );
}

/** The editor chunk failed to load: the code stays readable (no textarea fallback · Decision 7). */
class EditorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** The code with its 1:1 positions marked (the parts an edit maps back). */
function marked(result: CodeViewResult) {
  const parts: ReactNode[] = [];
  let at = 0;
  result.slots.forEach((slot, index) => {
    parts.push(result.code.slice(at, slot.start));
    parts.push(
      <mark
        key={index}
        className="code-view-slot"
        data-slot-kind={slot.target.kind}
      >
        {slot.text}
      </mark>,
    );
    at = slot.end;
  });
  parts.push(result.code.slice(at));
  return parts;
}
