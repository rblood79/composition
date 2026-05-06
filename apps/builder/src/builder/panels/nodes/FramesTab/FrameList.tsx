/**
 * FrameList — reusable frame 목록 컴포넌트.
 *
 * ADR-111 Phase 2 PR-D: FramesTab.tsx 의 Frames section (frame 목록 + Add 버튼) 추출.
 *
 * 본 컴포넌트는 프레젠테이션 전용 — 데이터 source (legacy/canonical) 결정과
 * frame CRUD 로직은 부모 (FramesTab) 책임. props 로 데이터/핸들러 주입받아
 * UI 만 렌더한다.
 *
 * functional 동등 — 추출 전후 동작 차이 없음 (PR-Followup-A 의 5 baseline 시나리오 + PR-C 의 8/8 시나리오 회귀 0).
 */

import { useCallback, useMemo } from "react";
import type { Key } from "react-stately";
import { Button } from "react-aria-components";
import { CirclePlus, Box, Trash } from "lucide-react";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { PanelHeader } from "../../../components";
import { TreeBase } from "../tree/TreeBase";
import type { BaseTreeNode, TreeItemState } from "../tree/TreeBase";

export interface FrameListItem {
  id: string;
  name: string;
}

interface FrameListNode extends BaseTreeNode {
  name: string;
}

export interface FrameListProps {
  /** 표시할 frame 목록 (legacy 또는 canonical projection 결과) */
  frames: ReadonlyArray<FrameListItem>;
  /** 현재 선택된 frame id (active 표시용) */
  selectedFrameId: string | null;
  /** Frame 항목 클릭 핸들러 */
  onSelect: (frameId: string) => void;
  /** Delete 버튼 클릭 핸들러 (stopPropagation 은 컴포넌트 내부에서 처리) */
  onDelete: (frameId: string) => void;
  /** Add Frame 버튼 클릭 핸들러 */
  onAdd: () => void;
}

export function FrameList({
  frames,
  selectedFrameId,
  onSelect,
  onDelete,
  onAdd,
}: FrameListProps) {
  const treeNodes = useMemo<FrameListNode[]>(
    () =>
      frames.map((frame) => ({
        id: frame.id,
        name: frame.name,
        parentId: null,
        depth: 0,
        hasChildren: false,
        children: [],
      })),
    [frames],
  );
  const nodeMap = useMemo(
    () => new Map(treeNodes.map((node) => [node.id, node])),
    [treeNodes],
  );
  const selectedKeys = useMemo(
    () => (selectedFrameId ? new Set<Key>([selectedFrameId]) : new Set<Key>()),
    [selectedFrameId],
  );
  const handleSelectionChange = useCallback(
    (keys: Set<Key>) => {
      const key = [...keys][0];
      if (!key) return;
      const node = nodeMap.get(String(key));
      if (!node || node.id === selectedFrameId) return;
      onSelect(node.id);
    },
    [nodeMap, onSelect, selectedFrameId],
  );
  const renderContent = useCallback(
    (node: FrameListNode, state: TreeItemState) => (
      <FrameListItemContent
        node={node}
        state={state}
        onDelete={onDelete}
        onReselect={onSelect}
      />
    ),
    [onDelete, onSelect],
  );

  return (
    <div className="section">
      <PanelHeader
        title="Frames"
        actions={
          <Button className="iconButton" aria-label="Add Frame" onPress={onAdd}>
            <CirclePlus
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </Button>
        }
      />

      <div className="section-content elements">
        {frames.length === 0 ? (
          <p className="no_element">No frames available</p>
        ) : (
          <TreeBase<FrameListNode>
            aria-label="Frames"
            items={treeNodes}
            getKey={(node) => node.id}
            getTextValue={(node) => node.name}
            renderContent={renderContent}
            selectedKeys={selectedKeys}
            onSelectionChange={handleSelectionChange}
            className="frame-tree"
          />
        )}
      </div>
    </div>
  );
}

interface FrameListItemContentProps {
  node: FrameListNode;
  state: TreeItemState;
  onDelete: (frameId: string) => void;
  onReselect: (frameId: string) => void;
}

function FrameListItemContent({
  node,
  state,
  onDelete,
  onReselect,
}: FrameListItemContentProps) {
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
          <Trash
            color={iconProps.color}
            strokeWidth={iconProps.strokeWidth}
            size={iconProps.size}
          />
        </Button>
      </div>
    </div>
  );
}
