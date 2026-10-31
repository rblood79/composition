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
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Tab, TabList, Tabs } from "react-aria-components/Tabs";
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
  type CatalogCodeViewRejection,
  type CatalogCodeViewSession,
} from "../../catalogRuntime/codeViewEdit";
import {
  catalogCodeViewFileBaseline,
  catalogCodeViewProjectApply,
  catalogCodeViewProjectPlan,
  catalogCodeViewProjectSession,
  type CatalogCodeViewFileRejection,
  type CatalogCodeViewProjectSession,
} from "../../catalogRuntime/codeViewApply";
import {
  codeViewFileTree,
  generateCodeViewFile,
  type CodeViewFileEntry,
} from "../../../../../../packages/shared/src/codeView/files/tree";
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
  readonly text: string;
  readonly changes: readonly CodeViewChange[];
}

/**
 * ADR-296 Phase 2 — the project's files (`codeViewFileTree` — names only, nothing generated until a
 * file opens), the open files' tabs, and one Apply for every edited file (one step, all or nothing).
 * The first keystroke starts the project session (its baseline is the document's revision then);
 * with no draft left the editor follows the document again.
 */
function CodeViewContent() {
  const { t, locale } = useI18n();
  const messages = codeViewMessages(locale);
  const snippetLabels = codeViewSnippetLabels(locale);
  const workspace = useCatalogWorkspace();
  const pageId = useSyncExternalStore(
    workspace.session.subscribe,
    () => workspace.session.getSnapshot().pageId,
  );
  const revision = useCatalogRevision(workspace);
  const graph = workspace.runtime.graph;
  // ADR-286: the data definitions are the document's — the code reads one source.
  const tables = useMemo(() => {
    void revision;
    return catalogCollectionTables(graph);
  }, [revision, graph]);
  const data = useMemo(() => {
    void revision;
    return catalogCodeViewData(graph);
  }, [revision, graph]);
  // ADR-291 — a computed column's formula is shown over field keys once the engine is loaded.
  const formulaEngine = useFormulaEngine(
    data.collections.some((collection) => schemaHasFormula(collection.schema)),
  );
  const files = useMemo(() => {
    void revision;
    return codeViewFileTree(graph);
  }, [revision, graph]);
  const pagePath = files.find(
    (file) => file.kind === "page" && file.id === pageId,
  )?.path;
  const [selected, setSelected] = useState<string | null>(null);
  const path =
    (selected && files.some((file) => file.path === selected)
      ? selected
      : pagePath) ?? files[0]?.path;
  const file = files.find((item) => item.path === path);
  // The project session (from the first keystroke) and each file's draft on it.
  const [project, setProject] = useState<CatalogCodeViewProjectSession | null>(
    null,
  );
  const [drafts, setDrafts] = useState<ReadonlyMap<string, Draft>>(new Map());
  const [previous, setPrevious] = useState<string | null>(null);
  const [report, setReport] = useState<
    | { kind: "applied"; count: number }
    | { kind: "rejected"; lines: readonly CatalogCodeViewFileRejection[] }
    | null
  >(null);
  const [opened, setOpened] = useState(0);
  // The file's code now — the editor's baseline while nothing is typed.
  const live = useMemo((): CodeViewResult | undefined => {
    void revision;
    void formulaEngine;
    if (!file) return undefined;
    try {
      return generateCodeViewFile({ reader: graph as never, file, ...data });
    } catch {
      return undefined;
    }
  }, [data, file, formulaEngine, graph, revision]);
  const baseline: CodeViewResult | undefined =
    (project && path
      ? catalogCodeViewFileBaseline(project, graph.commandReader, path, data)
      : undefined) ?? live;
  const draft = path ? drafts.get(path) : undefined;
  const reasonText = (line: CatalogCodeViewRejection) =>
    `${messages[line.reason].reason}${line.detail ? ` (${line.detail})` : ""} — ${messages[line.reason].alternative}`;
  const result = baseline;
  /** A page file's session (the snippets read one page). */
  const pageSession = useMemo((): CatalogCodeViewSession | undefined => {
    if (file?.kind !== "page" || !result) return undefined;
    return {
      projectId: graph.projectId,
      pageId: file.id as EntryId<"page">,
      revision: project?.revision ?? graph.revision,
      baseline: result,
    };
  }, [file, graph, project, result]);

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
    if (file?.kind !== "page") return [];
    return catalogCodeViewSnippets(
      graph.commandReader,
      file.id as EntryId<"page">,
      tables,
      data,
    );
  }, [data, file, revision, tables, graph]);
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
  const stateRef = useRef({ pageSession, project, drafts, path });
  useEffect(() => {
    stateRef.current = { pageSession, project, drafts, path };
  });
  const editorApi = useRef<CodeEditorApi | null>(null);
  const snippetCode = useCallback(
    async (id: string, text: string, changes: readonly CodeViewChange[]) => {
      const session = stateRef.current.pageSession;
      const snippet = snippets.find((item) => item.id === id);
      if (!session || !snippet) return undefined;
      return catalogCodeViewSnippetCode({
        graph,
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
      const { project, drafts, path } = stateRef.current;
      if (!path) return [];
      const session =
        project ?? catalogCodeViewProjectSession(graph.commandReader);
      catalogCodeViewFileBaseline(session, graph.commandReader, path, data);
      const all = new Map(drafts);
      all.set(path, { text, changes });
      return catalogCodeViewProjectPlan({
        reader: graph.commandReader,
        session,
        drafts: [...all].map(([file, draft]) => ({
          path: file,
          edited: draft.text,
          changes: draft.changes,
        })),
        newId: workspace.newId,
      })
        .rejected.filter((line) => line.path === path || line.path === "")
        .map((line) => ({ line: line.line, message: reasonText(line) }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, graph, workspace, messages],
  );

  if (!baseline || !path || !file)
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
    setDrafts(new Map());
    setProject(null);
    setOpened((count) => count + 1);
  };
  const apply = () => {
    if (!project || !drafts.size) return;
    const outcome = catalogCodeViewProjectApply(
      workspace,
      project,
      [...drafts].map(([file, draft]) => ({
        path: file,
        edited: draft.text,
        changes: draft.changes,
      })),
    );
    if (!outcome.applied) {
      setReport({ kind: "rejected", lines: outcome.rejected });
      return;
    }
    setReport({ kind: "applied", count: outcome.count });
    setPrevious(null);
    restart();
  };
  const reload = () => {
    if (draft) setPrevious(draft.text);
    setReport(null);
    restart();
  };
  const stale =
    report?.kind === "rejected" &&
    report.lines.some((line) => line.reason === "staleBaseline");
  // The open files: the selected one and every one with a draft (tree order).
  // (New objects when a draft starts or ends — RAC keeps a collection item's render by its object.)
  const open = files
    .filter((item) => item.path === path || drafts.has(item.path))
    .map((item) => ({ ...item, drafted: drafts.has(item.path) }));
  const listed = files.map((item) => ({
    ...item,
    drafted: drafts.has(item.path),
  }));
  const label = (item: CodeViewFileEntry) => item.path.replace(/^src\//, "");

  return (
    <>
      <PanelHeader
        icon={<Code size={iconProps.size} />}
        title={t("codeView.title")}
        panelId="codeView"
      />
      <PanelContents>
        <Section title={t("codeView.files")}>
          <ListBox
            className="react-aria-ListBox code-view-files"
            aria-label={t("codeView.filesLabel")}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[path]}
            onSelectionChange={(keys) => {
              const next = [...(keys as Set<string>)][0];
              if (next) setSelected(String(next));
            }}
            items={listed}
          >
            {(item) => (
              <ListBoxItem
                id={item.path}
                textValue={item.path}
                className="react-aria-ListBoxItem code-view-file"
              >
                <span className="code-view-file-path">{item.path}</span>
                {item.drafted ? (
                  <span className="code-view-file-drafted">
                    {t("codeView.drafted")}
                  </span>
                ) : null}
              </ListBoxItem>
            )}
          </ListBox>
        </Section>
        <Section title={t("codeView.section")}>
          <Tabs
            className="code-view-tabs"
            selectedKey={path}
            onSelectionChange={(key) => setSelected(String(key))}
          >
            <TabList
              className="code-view-tablist"
              aria-label={t("codeView.openFiles")}
              items={open}
            >
              {(item) => (
                <Tab id={item.path} className="code-view-tab">
                  {label(item)}
                  {item.drafted ? " •" : ""}
                </Tab>
              )}
            </TabList>
          </Tabs>
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
                  {draft ? draft.text : <code>{marked(baseline)}</code>}
                </pre>
              </>
            }
          >
            <Suspense
              fallback={
                <pre className="code-view-code">
                  {draft?.text ?? baseline.code}
                </pre>
              }
            >
              <CodeEditor
                key={`${path}:${opened}`}
                code={baseline.code}
                {...(draft ? { draft } : {})}
                label={t("codeView.editorLabel")}
                vocabulary={vocabulary}
                check={check}
                snippets={file.kind === "page" ? snippetItems : []}
                snippet={snippetCode}
                onReady={(api) => {
                  editorApi.current = api;
                }}
                onChange={(text, changes) => {
                  const session =
                    project ??
                    catalogCodeViewProjectSession(graph.commandReader);
                  const base = catalogCodeViewFileBaseline(
                    session,
                    graph.commandReader,
                    path,
                    data,
                  );
                  const next = new Map(drafts);
                  // (Back to the baseline text: nothing is typed in this file.)
                  if (base && text === base.code) next.delete(path);
                  else next.set(path, { text, changes });
                  setDrafts(next);
                  setProject(next.size ? session : null);
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
                  <li
                    key={`${line.path}:${line.line}:${line.reason}:${line.text}`}
                  >
                    {line.path ? (
                      <code>{label({ path: line.path, kind: "app" })}</code>
                    ) : null}{" "}
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
              isDisabled={!drafts.size}
              onPress={apply}
            >
              {t("codeView.apply")}
            </Button>
            <MenuTrigger>
              <Button
                className="control-button"
                isDisabled={file.kind !== "page"}
              >
                {snippetLabels.menu}
              </Button>
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
            {drafts.size ? (
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
