/**
 * LayoutList — reusable layout 목록 컴포넌트.
 *
 * ADR-111 Phase 2 PR-D: LayoutsTab.tsx 의 Layouts section (layout 목록 + Add 버튼) 추출.
 *
 * 본 컴포넌트는 프레젠테이션 전용 — 데이터 source (legacy/canonical) 결정과
 * layout CRUD 로직은 부모 (LayoutsTab) 책임. props 로 데이터/핸들러 주입받아
 * UI 만 렌더한다.
 *
 * functional 동등 — 추출 전후 동작 차이 없음 (PR-Followup-A 의 5 baseline 시나리오 + PR-C 의 8/8 시나리오 회귀 0).
 */

import { useCallback, useMemo } from "react";
import type { Key } from "react-stately";
import { Button } from "react-aria-components/Button";
import { Box } from "lucide-react";
import { ACTION_ICONS } from "../../../config/actionIcons";

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;
import { iconProps } from "../../../../utils/ui/uiConstants";
import { ActionIconButton, EmptyState, Section } from "../../../components";
import { NAVIGATOR_SECTION_IDS } from "../navigatorSectionIds";
import { useI18n } from "../../../../i18n";
import { TreeBase } from "../tree/TreeBase";
import type { BaseTreeNode, TreeItemState } from "../tree/TreeBase";
/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

export interface LayoutListItem {
  id: string;
  name: string;
}

interface LayoutListNode extends BaseTreeNode {
  name: string;
}

export interface LayoutListProps {
  /** 표시할 reusable layout 목록 (canonical projection 결과) */
  layouts: ReadonlyArray<LayoutListItem>;
  /** 현재 선택된 layout id (active 표시용) */
  selectedLayoutId: string | null;
  /** Layout 항목 클릭 핸들러 */
  onSelect: (frameId: string) => void;
  /** Delete 버튼 클릭 핸들러 (stopPropagation 은 컴포넌트 내부에서 처리) */
  onDelete: (frameId: string) => void;
  /** Add Layout 버튼 클릭 핸들러 */
  onAdd: () => void;
}

export function LayoutList({
  layouts,
  selectedLayoutId,
  onSelect,
  onDelete,
  onAdd,
}: LayoutListProps) {
  const { t } = useI18n();
  const treeNodes = useMemo<LayoutListNode[]>(
    () =>
      layouts.map((layout) => ({
        id: layout.id,
        name: layout.name,
        parentId: null,
        depth: 0,
        hasChildren: false,
        children: [],
      })),
    [layouts],
  );
  const nodeMap = useMemo(
    () => new Map(treeNodes.map((node) => [node.id, node])),
    [treeNodes],
  );
  const selectedKeys = useMemo(
    () =>
      selectedLayoutId ? new Set<Key>([selectedLayoutId]) : new Set<Key>(),
    [selectedLayoutId],
  );
  const handleSelectionChange = useCallback(
    (keys: Set<Key>) => {
      const key = [...keys][0];
      if (!key) return;
      const node = nodeMap.get(String(key));
      if (!node || node.id === selectedLayoutId) return;
      onSelect(node.id);
    },
    [nodeMap, onSelect, selectedLayoutId],
  );
  const renderContent = useCallback(
    (node: LayoutListNode, state: TreeItemState) => (
      <LayoutListItemContent
        node={node}
        state={state}
        onDelete={onDelete}
        onReselect={onSelect}
      />
    ),
    [onDelete, onSelect],
  );

  return (
    <Section
      id={NAVIGATOR_SECTION_IDS.layouts}
      className="node-tree-section"
      title={t("navigator.layouts")}
      actions={
        <ActionIconButton
          aria-label={t("navigator.addLayout")}
          tooltip={t("navigator.addLayout")}
          onPress={onAdd}
        >
          <AddIcon
            color={iconProps.color}
            strokeWidth={iconProps.strokeWidth}
            size={iconProps.size}
          />
        </ActionIconButton>
      }
    >
      {layouts.length === 0 ? (
        <EmptyState
          icon={<Box size={32} />}
          message={t("navigator.noLayouts")}
        />
      ) : (
        <TreeBase<LayoutListNode>
          aria-label={t("navigator.layouts")}
          items={treeNodes}
          getKey={(node) => node.id}
          getTextValue={(node) => node.name}
          renderContent={renderContent}
          selectedKeys={selectedKeys}
          onSelectionChange={handleSelectionChange}
          className="layout-tree"
        />
      )}
    </Section>
  );
}

interface LayoutListItemContentProps {
  node: LayoutListNode;
  state: TreeItemState;
  onDelete: (frameId: string) => void;
  onReselect: (frameId: string) => void;
}

function LayoutListItemContent({
  node,
  state,
  onDelete,
  onReselect,
}: LayoutListItemContentProps) {
  const { isSelected, isFocusVisible } = state;

  return (
    <div
      className={`elementItem ${isSelected ? "active" : ""} ${
        isFocusVisible ? "focused" : ""
      }`}
      onClick={(event) => {
        if (!isSelected) return;
        const target = event.target;
        if (target instanceof globalThis.Element && target.closest("button")) {
          return;
        }
        onReselect(node.id);
      }}
    >
      <div className="elementItemIndent" style={{ width: "0px" }} />
      <div className="elementItemIcon">
        <Box
          color={iconProps.color}
          strokeWidth={iconProps.strokeWidth}
          size={iconProps.size}
          style={{ padding: "2px" }}
        />
      </div>
      <div className="elementItemLabel">{node.name}</div>
      <div className="elementItemActions">
        <Button
          className="iconButton"
          aria-label={`Delete ${node.name}`}
          onPress={() => onDelete(node.id)}
        >
          <DeleteIcon
            color={iconProps.color}
            strokeWidth={iconProps.strokeWidth}
            size={iconProps.size}
          />
        </Button>
      </div>
    </div>
  );
}
