import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Code } from "lucide-react";
import { Button } from "react-aria-components/Button";
import { useI18n } from "@/i18n";
import type { EntryId } from "../../../../../../packages/shared/src/catalog/document/types";
import type { CodeViewRejection } from "../../../../../../packages/shared/src/codeView/inverse";
import type { CodeViewResult } from "../../../../../../packages/shared/src/codeView/types";
import {
  CatalogWorkspaceGate,
  useCatalogWorkspace,
} from "../../catalogRuntime/react";
import {
  catalogCodeView,
  catalogCodeViewCommand,
  catalogCodeViewData,
  catalogCodeViewInverse,
} from "../../catalogRuntime/codeView";
import { EmptyState } from "../../components/feedback/EmptyState";
import { PanelContents } from "../../components/panel/PanelContents";
import { PanelHeader } from "../../components/panel/PanelHeader";
import { Section } from "../../components/panel/Section";
import { useApiEndpoints, useCollections } from "../../stores/data";
import { iconProps } from "../../../utils/ui/uiConstants";
import "./CatalogCodeViewPanel.css";

/**
 * ADR-284 Phase 6 — the code view: the shown page as React Aria code in the reference examples'
 * shape (Decision 9). The marked parts are the 1:1 positions — a variable's name · default, a
 * `filter` term, a literal sort's field, a handler's When — an edit of them is applied as the
 * document's own commands (one Undo). Any other change applies nothing and its lines are named.
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
  const result = useMemo((): CodeViewResult | undefined => {
    void revision;
    if (!pageId) return undefined;
    try {
      return catalogCodeView(
        workspace.runtime.graph,
        pageId as EntryId<"page">,
        catalogCodeViewData(tables, endpoints),
      );
    } catch {
      return undefined;
    }
  }, [endpoints, pageId, revision, tables, workspace]);
  const [draft, setDraft] = useState<string | null>(null);
  const [report, setReport] = useState<
    | { kind: "applied"; count: number }
    | { kind: "rejected"; lines: readonly CodeViewRejection[] }
    | null
  >(null);

  if (!result)
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

  const editing = draft !== null;
  const apply = () => {
    if (draft === null) return;
    const inverse = catalogCodeViewInverse(result, draft);
    if (inverse.rejected.length) {
      setReport({ kind: "rejected", lines: inverse.rejected });
      return;
    }
    if (
      inverse.edits.length &&
      !workspace.execute(catalogCodeViewCommand(inverse.edits))
    )
      return;
    setReport({ kind: "applied", count: inverse.edits.length });
    setDraft(null);
  };

  return (
    <>
      <PanelHeader
        icon={<Code size={iconProps.size} />}
        title={t("codeView.title")}
        panelId="codeView"
      />
      <PanelContents>
        <Section title={t("codeView.section")}>
          {editing ? (
            <textarea
              className="code-view-editor"
              aria-label={t("codeView.editorLabel")}
              spellCheck={false}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setReport(null);
              }}
            />
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
                  <li key={`${line.line}:${line.text}`}>
                    {t("codeView.rejectedLine", {
                      line: line.line,
                      reason: t(
                        line.reason === "outsideSlot"
                          ? "codeView.reasonOutside"
                          : "codeView.reasonUnreadable",
                      ),
                    })}
                    <code>{line.text.trim()}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : report?.kind === "applied" ? (
            <p className="code-view-report" role="status">
              {t("codeView.applied", { count: report.count })}
            </p>
          ) : null}
          <div className="code-view-actions">
            {editing ? (
              <>
                <Button
                  className="control-button"
                  data-variant="primary"
                  onPress={apply}
                >
                  {t("codeView.apply")}
                </Button>
                <Button
                  className="control-button"
                  onPress={() => {
                    setDraft(null);
                    setReport(null);
                  }}
                >
                  {t("codeView.cancel")}
                </Button>
              </>
            ) : (
              <Button
                className="control-button"
                onPress={() => {
                  setDraft(result.code);
                  setReport(null);
                }}
              >
                {t("codeView.edit")}
              </Button>
            )}
          </div>
        </Section>
      </PanelContents>
    </>
  );
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
