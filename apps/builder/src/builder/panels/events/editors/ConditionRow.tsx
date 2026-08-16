/**
 * ConditionRow - 단일 조건 편집 행
 *
 * 조건의 좌변, 연산자, 우변을 편집할 수 있는 인라인 에디터
 * left [operator] right 형태
 */

import { Button, TextField, Input } from "react-aria-components";
import { GripVertical } from "lucide-react";
import type {
  Condition,
  ConditionOperand,
  ConditionOperator,
} from "../types/eventBlockTypes";
import { isUnaryOperator } from "../types/eventBlockTypes";
import { iconProps, iconEditProps } from "../../../../utils/ui/uiConstants";
import { OperatorPicker } from "./OperatorPicker";
import { ACTION_ICONS } from "../../../config/actionIcons";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

interface ConditionRowProps {
  /** 조건 데이터 */
  condition: Condition;

  /** 조건 변경 핸들러 */
  onChange: (condition: Condition) => void;

  /** 조건 삭제 핸들러 */
  onRemove: () => void;

  /** 드래그 핸들 속성 */
  dragHandleProps?: Record<string, unknown>;
}

/**
 * 단일 조건 편집 행 컴포넌트
 *
 * @example
 * <ConditionRow
 *   condition={{ id: '1', left: { type: 'element', value: '#email.value' }, operator: 'is_not_empty' }}
 *   onChange={(updated) => updateCondition(updated)}
 *   onRemove={() => removeCondition()}
 * />
 */
export function ConditionRow({
  condition,
  onChange,
  onRemove,
  dragHandleProps = {},
}: ConditionRowProps) {
  const isUnary = isUnaryOperator(condition.operator);

  // 좌변 타입 추론 (입력 값에 따라)
  const inferLeftType = (value: string): ConditionOperand["type"] => {
    if (value.startsWith("#") || value.startsWith(".")) return "element";
    if (value.startsWith("state.")) return "state";
    if (value.startsWith("event.")) return "event";
    return "literal";
  };

  // 좌변 입력 시 타입 자동 추론
  const handleLeftInputChange = (value: string) => {
    const type = inferLeftType(value);
    onChange({
      ...condition,
      left: { type, value },
    });
  };

  // 연산자 변경
  const handleOperatorChange = (operator: ConditionOperator) => {
    const updated: Condition = { ...condition, operator };
    // 단항 연산자면 right 제거
    if (isUnaryOperator(operator)) {
      delete updated.right;
    } else if (!updated.right) {
      // 이항 연산자인데 right가 없으면 추가
      updated.right = { type: "literal", value: "" };
    }
    onChange(updated);
  };

  // 우변 변경
  const handleRightChange = (value: string) => {
    if (!condition.right) return;
    const newRight: ConditionOperand = {
      ...condition.right,
      value,
    };
    onChange({ ...condition, right: newRight });
  };

  return (
    <div className="condition-row" role="group" aria-label="Condition">
      {/* Drag Handle */}
      <div className="condition-drag-handle" {...dragHandleProps}>
        <GripVertical
          size={iconEditProps.size}
          color={iconProps.color}
          strokeWidth={iconProps.strokeWidth}
        />
      </div>

      {/* Left Operand */}
      <TextField
        className="condition-operand condition-left"
        aria-label="Left operand"
      >
        <Input
          value={String(condition.left.value)}
          onChange={(e) => handleLeftInputChange(e.target.value)}
          placeholder="#element.value"
        />
      </TextField>

      {/* Operator Picker */}
      <OperatorPicker
        value={condition.operator}
        onChange={handleOperatorChange}
      />

      {/* Right Operand (hidden for unary operators) */}
      {!isUnary && (
        <TextField
          className="condition-operand condition-right"
          aria-label="Right operand"
        >
          <Input
            value={String(condition.right?.value ?? "")}
            onChange={(e) => handleRightChange(e.target.value)}
            placeholder="value"
          />
        </TextField>
      )}

      {/* Delete Button */}
      <Button
        className="iconButton condition-remove"
        onPress={onRemove}
        aria-label="Remove condition"
      >
        <DeleteIcon
          size={iconEditProps.size}
          color={iconProps.color}
          strokeWidth={iconProps.strokeWidth}
        />
      </Button>
    </div>
  );
}
