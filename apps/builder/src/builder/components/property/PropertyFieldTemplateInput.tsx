/**
 * ADR-159 P4a — `{field}` 템플릿 텍스트 입력 + 컬럼 피커.
 *
 * slot Text(및 템플릿 텍스트 prop) 편집용: 자유 입력을 유지하면서, 소유 collection 의
 * 컬럼 목록에서 선택하면 **커서 위치에 `{key}` 를 삽입**하고 즉시 commit 한다.
 * 텍스트 자체의 저장 규약은 PropertyInput 과 동일 (blur/Enter commit).
 */
import React, { useRef, useState, useEffect } from "react";
import {
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from "react-aria-components";
import { Braces } from "lucide-react";
import { iconEditProps } from "../../../utils/ui/uiConstants";
import { PropertyFieldset } from "./PropertyFieldset";
import { useControlPopoverMetrics } from "./useControlPopoverMetrics";
import "./PropertyFieldTemplateInput.css";

interface PropertyFieldTemplateInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** 소유 collection 의 컬럼(필드) 키 목록 — 피커 항목. */
  columns: string[];
  placeholder?: string;
  disabled?: boolean;
}

export function PropertyFieldTemplateInput({
  label,
  value,
  onChange,
  columns,
  placeholder,
  disabled,
}: PropertyFieldTemplateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState<string>(value ?? "");

  // 필드 삽입 팝오버를 패널 표준 규약(PropertySelect / PropertyUnitInput 과 동일)에
  // 맞춰 control 외곽 박스(`.react-aria-Group`) 폭·좌측에 정렬한다. controlRef 는
  // input+trigger 컨테이너에 붙이고, anchor(group)는 PropertyFieldset 이 렌더하므로
  // closest 자동 해석에 맡긴다.
  const pickerPopover = useControlPopoverMetrics();

  // 외부 값 변경(선택 요소 전환 등) 시 로컬 상태 동기화.
  useEffect(() => {
    setInputValue(value ?? "");
  }, [value]);

  const commit = (next: string) => {
    if (next !== value) onChange(next);
  };

  const insertField = (key: string) => {
    const token = `{${key}}`;
    const input = inputRef.current;
    const start = input?.selectionStart ?? inputValue.length;
    const end = input?.selectionEnd ?? inputValue.length;
    const next = inputValue.slice(0, start) + token + inputValue.slice(end);
    setInputValue(next);
    // 피커 선택은 즉시 commit — 캔버스 행 보간이 바로 반영되도록.
    commit(next);
    // 커서를 삽입 토큰 뒤로 복원.
    requestAnimationFrame(() => {
      input?.focus();
      const caret = start + token.length;
      input?.setSelectionRange(caret, caret);
    });
  };

  return (
    <PropertyFieldset legend={label}>
      <div className="property-field-template-input">
        <input
          ref={inputRef}
          className="react-aria-Input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={() => commit(inputValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(inputValue);
          }}
          placeholder={placeholder ?? "텍스트 또는 {field}"}
          disabled={disabled}
        />
        <MenuTrigger>
          <Button
            className="react-aria-Button field-picker-trigger"
            aria-label="필드 삽입"
            isDisabled={disabled || columns.length === 0}
            // 팝오버를 필드 박스(부모 react-aria-Group) 좌측·폭에 정렬하려면 offset 을
            // 트리거 버튼 기준으로 계산해야 한다 — controlRef 를 우측 버튼에 붙이면
            // margin-left = group.left − button.left 로 팝오버가 부모 시작점에 맞춰진다.
            ref={pickerPopover.controlRef}
          >
            <span aria-hidden="true" className="field-picker-icon">
              <Braces size={iconEditProps.size} />
            </span>
          </Button>
          <Popover
            className="react-aria-Popover property-select-popover"
            style={pickerPopover.popoverStyle}
          >
            <Menu
              className="react-aria-Menu field-picker-menu"
              aria-label="collection 필드"
              onAction={(key) => insertField(String(key))}
            >
              {columns.map((column) => (
                <MenuItem
                  key={column}
                  id={column}
                  className="react-aria-MenuItem"
                  textValue={column}
                >
                  {`{${column}}`}
                </MenuItem>
              ))}
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
    </PropertyFieldset>
  );
}
