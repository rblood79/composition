/**
 * @fileoverview ADR-131 Phase 5 G3 — ActionsPanel
 *
 * canonical document.actions root collection 직접 편집 panel.
 *
 * **scope (Phase 5 G3 minimum viable)**:
 * - useDocumentActions() 구독 + 목록 표시
 * - add (skeleton entry — kind="navigate"/config={})
 * - update kind (inline edit)
 * - chain (`next[]`) 첫 번째 항목 단일 input 으로 편집 (full chain editor 후속)
 * - remove
 *
 * **scope 외 (Phase 5 후속)**:
 * - kind 별 specialized config UI (navigate path / setValue key+value / fetch endpoint / ...)
 * - chain DAG visualization
 * - `next[]` 의 multi-entry editor
 *
 * `SerializedEvent.actionRef` 가 본 panel 의 action id 를 참조한다. 같은
 * actionId 가 여러 event 에서 공유될 수 있음 (cross-event reuse).
 *
 * @see docs/adr/131-events-data-actions-first-class-collections.md §Phase 5
 */

import { useState } from "react";
import { Plus, Trash2, Workflow } from "lucide-react";
import type { SerializedAction } from "@composition/shared";
import { PanelHeader } from "../../components";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useDocumentActions } from "../../stores/canonical/canonicalElementsBridge";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import "./ActionsPanel.css";

export function ActionsPanel() {
  const entries = useDocumentActions();
  const [draftId, setDraftId] = useState("");

  function handleAdd() {
    const trimmed = draftId.trim();
    if (!trimmed) return;
    if (entries.some((a) => a.id === trimmed)) return;
    const entry: SerializedAction = {
      id: trimmed,
      type: "action",
      kind: "navigate",
      config: {},
    };
    useCanonicalDocumentStore.getState().addAction(entry);
    setDraftId("");
  }

  function handleRemove(id: string) {
    useCanonicalDocumentStore.getState().removeAction(id);
  }

  function handleUpdateKind(id: string, kind: string) {
    useCanonicalDocumentStore.getState().updateAction(id, { kind });
  }

  function handleUpdateNext(id: string, nextId: string) {
    const next = nextId.trim();
    useCanonicalDocumentStore.getState().updateAction(id, {
      next: next ? [next] : undefined,
    });
  }

  return (
    <div className="panel-contents actions-panel">
      <PanelHeader title="Actions" icon={<Workflow size={iconProps.size} />} />
      <div className="actions-panel__add">
        <input
          type="text"
          placeholder="action id (예: navigateHome)"
          value={draftId}
          onChange={(e) => setDraftId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          className="actions-panel__id-input"
        />
        <button
          type="button"
          aria-label="Add"
          className="iconButton"
          onClick={handleAdd}
          disabled={!draftId.trim()}
        >
          <Plus size={iconProps.size} />
        </button>
      </div>
      <div className="actions-panel__list">
        {entries.length === 0 ? (
          <div className="actions-panel__empty">
            아직 등록된 action 이 없습니다. id 를 입력 후 + 로 추가.
          </div>
        ) : (
          entries.map((entry) => (
            <ActionEntryRow
              key={entry.id}
              entry={entry}
              onRemove={handleRemove}
              onUpdateKind={handleUpdateKind}
              onUpdateNext={handleUpdateNext}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ActionEntryRowProps {
  entry: SerializedAction;
  onRemove: (id: string) => void;
  onUpdateKind: (id: string, kind: string) => void;
  onUpdateNext: (id: string, nextId: string) => void;
}

function ActionEntryRow({
  entry,
  onRemove,
  onUpdateKind,
  onUpdateNext,
}: ActionEntryRowProps) {
  const firstNext = entry.next?.[0] ?? "";
  return (
    <div className="actions-panel__row">
      <div className="actions-panel__row-id">{entry.id}</div>
      <input
        type="text"
        value={entry.kind}
        onChange={(e) => onUpdateKind(entry.id, e.target.value)}
        className="actions-panel__kind-input"
        placeholder="kind"
      />
      <input
        type="text"
        value={firstNext}
        onChange={(e) => onUpdateNext(entry.id, e.target.value)}
        className="actions-panel__next-input"
        placeholder="next action id"
      />
      <button
        type="button"
        aria-label="Remove"
        className="iconButton"
        onClick={() => onRemove(entry.id)}
      >
        <Trash2 size={iconProps.size} />
      </button>
    </div>
  );
}

export default ActionsPanel;
