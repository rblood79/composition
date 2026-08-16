/**
 * IfBlock - IF 조건 블록
 *
 * 조건 그룹을 시각적으로 편집할 수 있는 블록
 * AND/OR 연산자 지원, 다중 조건 추가 가능
 */

import { useState, Fragment } from "react";
import { Button } from "react-aria-components";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import type { ConditionGroup, Condition } from "../types/eventBlockTypes";
import { createEmptyCondition } from "../types/eventBlockTypes";
import { iconProps, iconEditProps } from "../../../../utils/ui/uiConstants";
import { BlockConnector } from "./BlockConnector";
import { ConditionRow } from "../editors/ConditionRow";
import { OperatorToggle } from "../editors/OperatorToggle";
import { ACTION_ICONS } from "../../../config/actionIcons";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;
const DeleteIcon = ACTION_ICONS.delete;

interface IfBlockProps {
  /** 조건 그룹 (undefined면 조건 없음) */
  conditions?: ConditionGroup;

  /** 조건 변경 핸들러 */
  onChange: (conditions?: ConditionGroup) => void;

  /** 조건 블록 제거 핸들러 */
  onRemove: () => void;

  /** 연결선 분기 표시 (THEN/ELSE가 있을 때) */
  showSplitConnector?: boolean;
}

/**
 * IF 조건 블록 컴포넌트
 *
 * @example
 * <IfBlock
 *   conditions={handler.conditions}
 *   onChange={(conditions) => updateHandler({ conditions })}
 *   onRemove={() => updateHandler({ conditions: undefined })}
 * />
 */
export function IfBlock({
  conditions,
  onChange,
  onRemove,
  showSplitConnector = false,
}: IfBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // 조건이 없으면 "Add Condition" 버튼만 표시
  if (!conditions) {
    return (
      <Button
        className="add-condition-button"
        onPress={() =>
          onChange({ operator: "AND", conditions: [createEmptyCondition()] })
        }
      >
        <AddIcon size={iconEditProps.size} />
        Add Condition (optional)
      </Button>
    );
  }

  // 조건 추가
  const addCondition = () => {
    onChange({
      ...conditions,
      conditions: [...conditions.conditions, createEmptyCondition()],
    });
  };

  // 조건 업데이트
  const updateConditionAt = (index: number, updated: Condition) => {
    const newConditions = [...conditions.conditions];
    newConditions[index] = updated;
    onChange({ ...conditions, conditions: newConditions });
  };

  // 조건 삭제
  const removeConditionAt = (index: number) => {
    const newConditions = conditions.conditions.filter((_, i) => i !== index);
    if (newConditions.length === 0) {
      // 모든 조건이 삭제되면 조건 그룹 제거
      onRemove();
    } else {
      onChange({ ...conditions, conditions: newConditions });
    }
  };

  // 연산자 변경
  const handleOperatorChange = (operator: "AND" | "OR") => {
    onChange({ ...conditions, operator });
  };

  return (
    <div
      className="event-block if-block"
      role="group"
      aria-label="Condition block"
    >
      {/* Block Header */}
      <div className="block-header">
        <Search
          className="block-icon"
          size={iconProps.size}
          strokeWidth={iconProps.strokeWidth}
        />
        <span className="block-label">IF</span>
        <span className="block-sublabel">(optional)</span>

        <div className="block-actions">
          {/* Expand/Collapse Toggle */}
          <Button
            className="iconButton"
            onPress={() => setIsExpanded(!isExpanded)}
            aria-label={
              isExpanded ? "Collapse conditions" : "Expand conditions"
            }
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

          {/* Delete Block */}
          <Button
            className="iconButton"
            onPress={onRemove}
            aria-label="Remove condition block"
          >
            <DeleteIcon
              size={iconEditProps.size}
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
            />
          </Button>
        </div>
      </div>

      {/* Block Content (collapsible) */}
      {isExpanded && (
        <div className="block-content">
          {conditions.conditions.map((condition, index) => (
            <Fragment key={condition.id}>
              {/* AND/OR Operator Toggle (between conditions) */}
              {index > 0 && (
                <OperatorToggle
                  value={conditions.operator}
                  onChange={handleOperatorChange}
                />
              )}

              {/* Condition Row */}
              <ConditionRow
                condition={condition}
                onChange={(updated) => updateConditionAt(index, updated)}
                onRemove={() => removeConditionAt(index)}
              />
            </Fragment>
          ))}

          {/* Add Condition Button */}
          <Button className="add-row-button" onPress={addCondition}>
            <AddIcon size={iconEditProps.size} />
            Add Condition
          </Button>
        </div>
      )}

      {/* Connector to THEN/ELSE blocks */}
      <BlockConnector direction={showSplitConnector ? "split" : "down"} />
    </div>
  );
}
