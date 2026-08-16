/**
 * ActionBlock - 개별 액션 블록
 *
 * THEN/ELSE 블록 내에서 사용되는 개별 액션 아이템
 * 드래그 앤 드롭 정렬, 편집, 삭제 지원
 */

import { Button, TooltipTrigger, Tooltip } from "react-aria-components";
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Navigation,
  RefreshCw,
  Bell,
  Eye,
  Send,
  Code,
  Database,
  MousePointer,
  ClipboardCopy,
  ArrowDown,
  Table,
  Save,
  Variable,
  AlertTriangle,
} from "lucide-react";
import type { BlockEventAction } from "../types/eventBlockTypes";
import type { ActionType } from "../types/eventTypes";
import { ACTION_TYPE_LABELS } from "../types/eventTypes";
import { iconProps, iconEditProps } from "../../../../utils/ui/uiConstants";
import { ACTION_METADATA } from "../data/actionMetadata";
import { ACTION_ICONS } from "../../../config/actionIcons";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

interface ActionBlockProps {
  /** 액션 데이터 */
  action: BlockEventAction;

  /** 액션 순번 (1부터 시작) */
  index: number;

  /** 액션 클릭 핸들러 (편집 모드 진입) */
  onClick?: () => void;

  /** 액션 삭제 핸들러 */
  onRemove?: () => void;

  /** 확장 상태 */
  isExpanded?: boolean;

  /** 확장 토글 핸들러 */
  onToggleExpand?: () => void;

  /** 드래그 핸들 참조 (dnd-kit 등 연동용) */
  dragHandleProps?: Record<string, unknown>;
}

/**
 * 액션 타입별 아이콘 매핑
 * Note: Partial 사용 - 모든 ActionType이 필요하지 않음 (camelCase만 정의, 폴백 있음)
 */
const ACTION_TYPE_ICONS: Partial<
  Record<ActionType, React.ComponentType<{ size?: number; className?: string }>>
> = {
  navigate: Navigation,
  scrollTo: ArrowDown,
  setState: Database,
  updateState: RefreshCw,
  apiCall: Send,
  showModal: Eye,
  hideModal: Eye,
  showToast: Bell,
  toggleVisibility: Eye,
  validateForm: Send,
  resetForm: RefreshCw,
  submitForm: Send,
  setComponentState: Database,
  triggerComponentAction: MousePointer,
  updateFormField: Database,
  filterCollection: Database,
  selectItem: MousePointer,
  clearSelection: MousePointer,
  copyToClipboard: ClipboardCopy,
  customFunction: Code,
  // Data Panel Integration
  loadDataTable: Table,
  syncComponent: RefreshCw,
  saveToDataTable: Save,
  // Variable
  setVariable: Variable,
};

/**
 * 액션 설정에서 요약 텍스트 생성
 */
function getActionSummary(action: BlockEventAction): string {
  const config = action.config as Record<string, unknown>;

  switch (action.type) {
    case "navigate":
      return (config.path as string) || "";
    case "apiCall":
      return `${config.method || "GET"} ${config.endpoint || ""}`;
    case "showToast":
      return (config.message as string) || "";
    case "setState":
    case "updateState":
      return (config.storePath as string) || "";
    case "showModal":
    case "hideModal":
      return (config.modalId as string) || "";
    case "toggleVisibility":
      return (config.elementId as string) || "";
    case "customFunction":
      return config.code ? "(custom code)" : "";
    default:
      return "";
  }
}

/**
 * 필수 설정이 누락된 필드 목록 반환
 */
function getMissingRequiredFields(action: BlockEventAction): string[] {
  const metadata = ACTION_METADATA[action.type as keyof typeof ACTION_METADATA];
  if (!metadata?.configFields) return [];
  const config = action.config as Record<string, unknown>;
  return metadata.configFields
    .filter(
      (f) =>
        f.required &&
        (config[f.name] === undefined ||
          config[f.name] === "" ||
          config[f.name] === null),
    )
    .map((f) => f.label);
}

/**
 * 개별 액션 블록 컴포넌트
 *
 * @example
 * <ActionBlock
 *   action={{ id: '1', type: 'navigate', config: { path: '/home' } }}
 *   index={1}
 *   onClick={() => setSelectedAction(action)}
 *   onRemove={() => removeAction(action.id)}
 * />
 */
export function ActionBlock({
  action,
  index,
  onClick,
  onRemove,
  isExpanded = false,
  onToggleExpand,
  dragHandleProps = {},
}: ActionBlockProps) {
  // snake_case 액션 타입 (scroll_to 등)은 폴백 아이콘 사용
  const IconComponent =
    (
      ACTION_TYPE_ICONS as Record<
        string,
        React.ComponentType<{ size?: number; className?: string }>
      >
    )[action.type] || Code;
  const label =
    (ACTION_TYPE_LABELS as Record<string, string>)[action.type] || action.type;
  const summary = getActionSummary(action);
  const missingFields = getMissingRequiredFields(action);
  const hasMissingConfig = missingFields.length > 0;

  return (
    <div
      className={`action-item ${action.enabled === false ? "disabled" : ""}`}
      role="listitem"
      aria-label={`Action ${index}: ${label}`}
      data-action-id={action.id}
    >
      {/* Drag Handle */}
      <div className="action-drag-handle" {...dragHandleProps}>
        <GripVertical
          size={iconEditProps.size}
          color={iconProps.color}
          strokeWidth={iconProps.strokeWidth}
        />
      </div>

      {/* Action Icon */}
      <div className="list-item-icon">
        <IconComponent size={iconProps.size} />
        {/* Action Number */}
        <span className="list-item-index">{index}</span>
      </div>
      {/* Action Info (clickable) */}
      <button
        type="button"
        className="action-info-button"
        onClick={onClick}
        aria-label={`Edit ${label}`}
      >
        <span className="action-type">{label}</span>
        {summary && <span className="action-summary">{summary}</span>}
      </button>

      {/* Missing Config Warning */}
      {hasMissingConfig && (
        <TooltipTrigger delay={300}>
          <Button
            className="iconButton action-warning"
            aria-label={`필수 설정 누락: ${missingFields.join(", ")}`}
          >
            <AlertTriangle size={14} className="action-warning-icon" />
          </Button>
          <Tooltip className="action-warning-tooltip" placement="bottom">
            필수 설정 누락: {missingFields.join(", ")}
          </Tooltip>
        </TooltipTrigger>
      )}

      {/* Action Controls */}
      <div className="action-controls">
        {/* Expand/Collapse Toggle */}
        {onToggleExpand && (
          <Button
            className="iconButton"
            onPress={onToggleExpand}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDown
                size={iconEditProps.size}
                color={iconProps.color}
                strokeWidth={iconProps.strokeWidth}
              />
            ) : (
              <ChevronRight
                size={iconEditProps.size}
                color={iconProps.color}
                strokeWidth={iconProps.strokeWidth}
              />
            )}
          </Button>
        )}

        {/* Delete Button */}
        {onRemove && (
          <Button
            className="iconButton"
            onPress={onRemove}
            aria-label="Delete action"
          >
            <DeleteIcon
              size={iconEditProps.size}
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
            />
          </Button>
        )}
      </div>
    </div>
  );
}
