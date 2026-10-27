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
import { useI18n } from "@/i18n";
import { CODE_CATALOG_SUPPORTED_TYPES } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { EntryId } from "../../../../../../packages/shared/src/catalog/document/types";
import type { CodeViewChange } from "../../../../../../packages/shared/src/codeView/inverse/identity";
import type { CodeViewResult } from "../../../../../../packages/shared/src/codeView/types";
import {
  CatalogWorkspaceGate,
  useCatalogWorkspace,
} from "../../catalogRuntime/react";
import {
  catalogCodeView,
  catalogCodeViewData,
} from "../../catalogRuntime/codeView";
import {
  catalogCodeViewApply,
  catalogCodeViewPlan,
  catalogCodeViewSession,
  type CatalogCodeViewRejection,
  type CatalogCodeViewSession,
} from "../../catalogRuntime/codeViewEdit";
import { EmptyState } from "../../components/feedback/EmptyState";
import { PanelContents } from "../../components/panel/PanelContents";
import { PanelHeader } from "../../components/panel/PanelHeader";
import { Section } from "../../components/panel/Section";
import { useApiEndpoints, useCollections } from "../../stores/data";
import { iconProps } from "../../../utils/ui/uiConstants";
import type { CodeEditorVocabulary } from "./CodeEditor";
import "./CatalogCodeViewPanel.css";

/** ADR-285 — the editor loads with the edit only (CodeMirror 6, its own chunk). */
const CodeEditor = lazy(() => import("./CodeEditor"));

/**
 * The code view (ADR-284 Phase 6 · ADR-285): the shown page as React Aria code in the reference
 * examples' shape. 「코드 고치기」 opens an edit session on the page's code at that moment; Apply
 * reads the edit across the closed vocabulary — elements, props, text, events, variables, a list's
 * `filter` terms — and applies the difference as the document's commands in one step (one Undo).
 * A line it cannot take refuses the whole edit with the line, why, and what to do instead; a
 * document changed meanwhile refuses it too (the draft stays — 「다시 불러오기」).
 */
export function CatalogCodeViewPanel() {
  return (
    <div className="panel code-view-panel">
      <CatalogWorkspaceGate>
        <CodeViewContent />
      </CatalogWorkspaceGate>
    </div>
  );
}

interface Draft {
  readonly session: CatalogCodeViewSession;
  readonly text: string;
  readonly changes: readonly CodeViewChange[];
}

function CodeViewContent() {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const tables = useCollections();
  const endpoints = useApiEndpoints();
  const pageId = useSyncExternalStore(
    workspace.session.subscribe,
    () => workspace.session.getSnapshot().pageId,
  );
  const revision = useSyncExternalStore(
    useCallback(
      (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
      [workspace],
    ),
    () => workspace.runtime.graph.revision,
  );
  const data = useMemo(
    () => catalogCodeViewData(tables, endpoints),
    [tables, endpoints],
  );
  const result = useMemo((): CodeViewResult | undefined => {
    void revision;
    if (!pageId) return undefined;
    try {
      return catalogCodeView(
        workspace.runtime.graph,
        pageId as EntryId<"page">,
        data,
      );
    } catch {
      return undefined;
    }
  }, [data, pageId, revision, workspace]);
  // (A draft per page — another page's draft is kept, never applied here.)
  const [drafts, setDrafts] = useState<ReadonlyMap<string, Draft>>(new Map());
  const [previous, setPrevious] = useState<string | null>(null);
  const [report, setReport] = useState<
    | { kind: "applied"; count: number }
    | { kind: "rejected"; lines: readonly CatalogCodeViewRejection[] }
    | null
  >(null);
  const draft = pageId ? drafts.get(pageId) : undefined;
  const setDraft = (next: Draft | undefined) =>
    setDrafts((map) => {
      const copy = new Map(map);
      if (next) copy.set(next.session.pageId, next);
      else if (pageId) copy.delete(pageId);
      return copy;
    });
  const reasonText = (line: CatalogCodeViewRejection) =>
    `${t(`codeView.reason_${line.reason}`)}${line.detail ? ` (${line.detail})` : ""} — ${t(`codeView.alternative_${line.reason}`)}`;

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
  // (The editor's check reads the session at commit — not a ref written during render.)
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  });
  const check = useCallback(
    (text: string, changes: readonly CodeViewChange[]) => {
      const session = draftRef.current?.session;
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
    [data, workspace],
  );

  if (!result || !pageId)
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

  const begin = () => {
    const session = catalogCodeViewSession(
      workspace.runtime.graph,
      pageId as EntryId<"page">,
      data,
    );
    if (!session) return;
    setDraft({ session, text: session.baseline.code, changes: [] });
    setReport(null);
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
    begin();
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
          {draft ? (
            <EditorBoundary
              fallback={
                <>
                  <p className="code-view-report" role="alert">
                    {t("codeView.editorUnavailable")}
                  </p>
                  <pre className="code-view-code">{draft.text}</pre>
                </>
              }
            >
              <Suspense
                fallback={<pre className="code-view-code">{draft.text}</pre>}
              >
                <CodeEditor
                  key={`${draft.session.pageId}:${draft.session.revision}`}
                  code={draft.session.baseline.code}
                  label={t("codeView.editorLabel")}
                  vocabulary={vocabulary}
                  check={check}
                  onChange={(text, changes) => {
                    setDraft({ session: draft.session, text, changes });
                    setReport(null);
                  }}
                />
              </Suspense>
            </EditorBoundary>
          ) : (
            <pre
              className="code-view-code"
              aria-label={t("codeView.codeLabel")}
            >
              <code>{marked(result)}</code>
            </pre>
          )}
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
            {draft ? (
              <>
                <Button
                  className="control-button"
                  data-variant="primary"
                  onPress={apply}
                >
                  {t("codeView.apply")}
                </Button>
                {stale ? (
                  <Button className="control-button" onPress={reload}>
                    {t("codeView.reload")}
                  </Button>
                ) : null}
                <Button
                  className="control-button"
                  onPress={() => {
                    setDraft(undefined);
                    setReport(null);
                    setPrevious(null);
                  }}
                >
                  {t("codeView.cancel")}
                </Button>
              </>
            ) : (
              <Button className="control-button" onPress={begin}>
                {t("codeView.edit")}
              </Button>
            )}
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
