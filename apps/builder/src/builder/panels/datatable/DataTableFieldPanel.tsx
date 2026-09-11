/**
 * DataTableFieldPanel — 편집기 옆에 스냅되는 필드 패널 (ADR-212 Phase 1 골격).
 *
 * 등록 · 스냅 정책 · lazy 경계만 Phase 1 이 갖고, 본문 (이름 · 타입 · required · default ·
 * 사용처 N · 삭제 확인) 은 Phase 3 이 채운다. 대상은 `dataTableEditorStore.fieldPanel`.
 */
import { Columns3 } from "lucide-react";
import { useDataStore } from "../../stores/data";
import { EmptyState, PanelContents, PanelHeader } from "../../components";
import { iconProps } from "../../../utils/ui/uiConstants";
import { translateKey, useOptionalI18n } from "../../../i18n";
import {
  useDataTableEditorStore,
  useDataTableFieldPanel,
} from "./stores/dataTableEditorStore";
import type { PanelProps } from "../core/types";

export function DataTableFieldPanel(_props: PanelProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  const target = useDataTableFieldPanel();
  const closeFieldPanel = useDataTableEditorStore(
    (state) => state.closeFieldPanel,
  );
  const collection = useDataStore((state) =>
    target ? state.collections.get(target.collectionId) : undefined,
  );
  const field =
    target?.fieldId && collection
      ? collection.schema.find(
          (f) => f.id === target.fieldId || f.key === target.fieldId,
        )
      : undefined;
  const title = field
    ? field.key
    : target
      ? localize("newField", "New Field")
      : localize("fieldPanel", "Field");

  return (
    <div className="panel datatable-field-panel">
      <PanelHeader
        icon={<Columns3 size={iconProps.size} />}
        title={title}
        panelId="datatableField"
        onClose={closeFieldPanel}
      />
      <PanelContents>
        <EmptyState
          icon={<Columns3 size={32} />}
          message={
            target
              ? localize(
                  "fieldPanelPending",
                  "Field editing arrives in Phase 3.",
                )
              : localize("fieldPanelEmpty", "Pick a column header to edit it.")
          }
        />
      </PanelContents>
    </div>
  );
}

export default DataTableFieldPanel;
