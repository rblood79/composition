/**
 * @fileoverview ADR-131 Phase 5 G3 — DataPanel
 *
 * canonical document.data root collection 직접 편집 panel.
 *
 * **scope (Phase 5 G3 minimum viable)**:
 * - useDocumentData() 구독 + 목록 표시
 * - add (skeleton entry — kind=value/source=static/config={})
 * - update kind / source (inline edit)
 * - remove
 *
 * **scope 외 (Phase 5 후속 / 별 ADR)**:
 * - source-specific config UI (supabase / api / state / static / parent)
 * - cross-node 참조 시각화 (어떤 element 들이 `props.dataSource = <id>` 인지)
 * - import / export
 *
 * 본 panel 은 element selection 과 무관 — root collection 직접 편집.
 *
 * @see docs/adr/131-events-data-actions-first-class-collections.md §Phase 5
 */

import { useState } from "react";
import { Database, Plus, Trash2 } from "lucide-react";
import type { SerializedData } from "@composition/shared";
import { PanelHeader } from "../../components";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useDocumentData } from "../../stores/canonical/canonicalElementsBridge";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import "./DataPanel.css";

export function DataPanel() {
  const entries = useDocumentData();
  const [draftId, setDraftId] = useState("");

  function handleAdd() {
    const trimmed = draftId.trim();
    if (!trimmed) return;
    if (entries.some((d) => d.id === trimmed)) return;
    const entry: SerializedData = {
      id: trimmed,
      type: "data",
      kind: "value",
      source: "static",
      config: {},
    };
    useCanonicalDocumentStore.getState().addData(entry);
    setDraftId("");
  }

  function handleRemove(id: string) {
    useCanonicalDocumentStore.getState().removeData(id);
  }

  function handleUpdateKind(id: string, kind: SerializedData["kind"]) {
    useCanonicalDocumentStore.getState().updateData(id, { kind });
  }

  function handleUpdateSource(id: string, source: string) {
    useCanonicalDocumentStore.getState().updateData(id, { source });
  }

  return (
    <div className="panel-contents data-panel">
      <PanelHeader title="Data" icon={<Database size={iconProps.size} />} />
      <div className="data-panel__add">
        <input
          type="text"
          placeholder="data id (예: usersList)"
          value={draftId}
          onChange={(e) => setDraftId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          className="data-panel__id-input"
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
      <div className="data-panel__list">
        {entries.length === 0 ? (
          <div className="data-panel__empty">
            아직 등록된 data 가 없습니다. id 를 입력 후 + 로 추가.
          </div>
        ) : (
          entries.map((entry) => (
            <DataEntryRow
              key={entry.id}
              entry={entry}
              onRemove={handleRemove}
              onUpdateKind={handleUpdateKind}
              onUpdateSource={handleUpdateSource}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface DataEntryRowProps {
  entry: SerializedData;
  onRemove: (id: string) => void;
  onUpdateKind: (id: string, kind: SerializedData["kind"]) => void;
  onUpdateSource: (id: string, source: string) => void;
}

function DataEntryRow({
  entry,
  onRemove,
  onUpdateKind,
  onUpdateSource,
}: DataEntryRowProps) {
  return (
    <div className="data-panel__row">
      <div className="data-panel__row-id">{entry.id}</div>
      <select
        value={entry.kind}
        onChange={(e) =>
          onUpdateKind(entry.id, e.target.value as SerializedData["kind"])
        }
        className="data-panel__kind-select"
      >
        <option value="collection">collection</option>
        <option value="value">value</option>
        <option value="field">field</option>
      </select>
      <input
        type="text"
        value={entry.source}
        onChange={(e) => onUpdateSource(entry.id, e.target.value)}
        className="data-panel__source-input"
        placeholder="source"
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

// re-export pattern 정합 (panel registration)
export default DataPanel;
