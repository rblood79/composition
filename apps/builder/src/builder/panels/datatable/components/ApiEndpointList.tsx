/**
 * ApiEndpointList - API Endpoint 목록 컴포넌트
 *
 * ADR-212 Phase 1 — RAC `GridList` 행 (키보드 열림) + 배지: method · 마지막 실행 (status ·
 * ms · 상대 시각, ADR-213 `apiRuns` 스냅샷) · 연결 테이블 (ApiList 아트보드).
 * 편집 UI는 DataTableEditorPanel에서 처리
 */

import { useMemo, useState } from "react";
import { Globe, SquarePen, Play } from "lucide-react";
import { Button } from "react-aria-components/Button";
import { GridList, GridListItem } from "react-aria-components/GridList";
import { useDataStore, useApiEndpoints } from "../../../stores/data";
import { useDataTableEditorStore } from "../stores/dataTableEditorStore";
import { EmptyState, Section } from "../../../components";
import { ConfirmDialog } from "../../../components/overlay";
import { iconProps, iconEditProps } from "../../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { translateKey, useOptionalI18n } from "../../../../i18n";
import { announceDataPanelStatus } from "../stores/dataPanelStatusStore";
import { relativeTimeParts } from "../utils/relativeTime";
/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

interface ApiEndpointListProps {
  projectId: string;
}

export function ApiEndpointList({ projectId }: ApiEndpointListProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  /** 보간이 필요한 문구 — provider 밖(격리 렌더)이면 키를 그대로 돌려준다. */
  const t = (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => (i18n ? i18n.t(`datatable.${key}`, params) : key);
  const apiEndpoints = useApiEndpoints();
  const apiRuns = useDataStore((state) => state.apiRuns);
  const collectionsMap = useDataStore((state) => state.collections);
  const deleteApiEndpoint = useDataStore((state) => state.deleteApiEndpoint);
  const collections = useMemo(
    () => Array.from(collectionsMap.values()),
    [collectionsMap],
  );

  // Editor Store 액션
  const editorMode = useDataTableEditorStore((state) => state.mode);
  const openApiEditor = useDataTableEditorStore((state) => state.openApiEditor);

  // 현재 편집 중인 API ID (하이라이트용)
  const editingApiId =
    editorMode?.type === "api-edit" ? editorMode.endpointId : null;

  const openApiCreator = useDataTableEditorStore(
    (state) => state.openApiCreator,
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // 생성은 목록 옆에 스냅되는 패널에서 (리서치 U2 — window.prompt 제거)
  const handleCreate = () => {
    openApiCreator(projectId);
  };

  const confirmDelete = async () => {
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    if (!id) return;
    const name = apiEndpoints.find((api) => api.id === id)?.name ?? "";
    try {
      await deleteApiEndpoint(id);
      announceDataPanelStatus(t("apiDeleted", { name }), { tone: "success" });
    } catch (error) {
      console.error("API Endpoint 삭제 실패:", error);
    }
  };

  const lastRunLabel = (endpointId: string): string | null => {
    const run = apiRuns.get(endpointId);
    if (!run) return null;
    const rel = relativeTimeParts(run.startedAt);
    const when = t(rel.key, { count: rel.count });
    const status = run.response?.status ?? localize("runNetworkError", "error");
    return `${status} · ${run.durationMs} ms · ${when}`;
  };

  return (
    <Section
      id="api-list"
      title={localize("apiList", "API List")}
      badge={
        <span className="datatable-list-count">
          {t("countItems", { count: apiEndpoints.length })}
        </span>
      }
      collapsible={false}
    >
      {apiEndpoints.length === 0 ? (
        <EmptyState
          icon={<Globe size={32} />}
          message={localize("apiEmpty", "No API endpoints. Add a new API.")}
        />
      ) : (
        <GridList
          className="list-group list-group--stack"
          aria-label={localize("apiList", "API List")}
          selectionMode="single"
          selectionBehavior="replace"
          selectedKeys={editingApiId ? [editingApiId] : []}
          onAction={(key) => openApiEditor(String(key))}
        >
          {apiEndpoints.map((endpoint) => {
            const run = apiRuns.get(endpoint.id);
            const linked = endpoint.targetCollectionId
              ? collections.find((c) => c.id === endpoint.targetCollectionId)
              : collections.find(
                  (c) =>
                    !!endpoint.targetCollection &&
                    c.name === endpoint.targetCollection,
                );
            const failed = run && !run.ok;
            return (
              <GridListItem
                key={endpoint.id}
                id={endpoint.id}
                textValue={endpoint.name}
                className={({ isSelected }) =>
                  `list-item ${isSelected ? "selected" : ""}`
                }
                data-error={failed || undefined}
              >
                <div className="list-item-icon">
                  <Globe {...iconProps} />
                </div>
                <div className="list-item-content">
                  <div className="list-item-name">{endpoint.name}</div>
                  <div className="list-item-meta">
                    <span>
                      {endpoint.baseUrl}
                      {endpoint.path}
                    </span>
                    {run ? (
                      <span
                        className={
                          failed ? "list-item-run error" : "list-item-run"
                        }
                      >
                        {" "}
                        · {lastRunLabel(endpoint.id)}
                      </span>
                    ) : null}
                    {linked ? (
                      <span className="list-item-linked"> · {linked.name}</span>
                    ) : null}
                  </div>
                </div>
                <span className={`list-item-badge method ${endpoint.method}`}>
                  {endpoint.method}
                </span>
                <div className="list-item-actions">
                  <Button
                    className="iconButton"
                    onPress={() => openApiEditor(endpoint.id, "response")}
                    aria-label={`${localize("test", "Test")} ${endpoint.name}`}
                  >
                    <Play {...iconEditProps} />
                  </Button>
                  <Button
                    className="iconButton"
                    onPress={() => openApiEditor(endpoint.id)}
                    aria-label={`${localize("edit", "Edit")} ${endpoint.name}`}
                  >
                    <SquarePen {...iconEditProps} />
                  </Button>
                  <Button
                    className="iconButton"
                    onPress={() => setPendingDeleteId(endpoint.id)}
                    aria-label={`${localize("delete", "Delete")} ${endpoint.name}`}
                  >
                    <DeleteIcon {...iconEditProps} />
                  </Button>
                </div>
              </GridListItem>
            );
          })}
        </GridList>
      )}
      <Button
        className="control-button"
        data-variant="add"
        onPress={handleCreate}
      >
        <AddIcon {...iconProps} />
        <span>{localize("addApi", "Add API")}</span>
      </Button>
      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title={localize("deleteTitle", "Delete")}
        message={t("deleteMessage", {
          name:
            apiEndpoints.find((api) => api.id === pendingDeleteId)?.name ?? "",
        })}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDeleteId(null)}
      />
    </Section>
  );
}
