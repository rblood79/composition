import React from "react";
import {
  FieldErrorProps,
  FieldError as RACFieldError,
} from "react-aria-components/FieldError";
import { Group, GroupProps } from "react-aria-components/Group";
import { InputProps, Input as RACInput } from "react-aria-components/Input";
import { LabelProps, Label as RACLabel } from "react-aria-components/Label";
import { TextProps, Text as RACText } from "react-aria-components/Text";
import type { FieldType } from "../types";

import "./styles/Field.css";

export function Label(props: LabelProps) {
  return <RACLabel {...props} className="react-aria-Label" />;
}

export function Text(props: TextProps) {
  return <RACText {...props} className="react-aria-Text" />;
}

export function Description(props: TextProps) {
  return (
    <RACText {...props} slot="description" className="react-aria-Description" />
  );
}

export function FieldError(props: FieldErrorProps) {
  return <RACFieldError {...props} className="react-aria-FieldError" />;
}

export function FieldGroup(props: GroupProps) {
  return <Group {...props} className="react-aria-FieldGroup" />;
}

export function Input(props: InputProps) {
  return <RACInput {...props} className="react-aria-Input inset" />;
}

/**
 * DataField 컴포넌트 Props
 */
export interface DataFieldProps {
  /** 데이터 키 (예: "name", "email") */
  fieldKey?: string;
  /** 표시 레이블 */
  label?: string;
  /** 데이터 타입 */
  type?: FieldType;
  /** 데이터 값 */
  value?: unknown;
  /** 레이블 표시 여부 (기본: true) */
  showLabel?: boolean;
  /** 필드 표시 여부 (기본: true) */
  visible?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 인라인 스타일 */
  style?: React.CSSProperties;
  /** 자식 요소 (커스텀 렌더링) */
  children?: React.ReactNode;
}

/**
 * DataField 컴포넌트
 *
 * ListBox, Select 등의 Collection 컴포넌트에서 데이터 필드를 표시하는 컴포넌트입니다.
 * 타입에 따라 적절한 포맷으로 데이터를 렌더링합니다.
 *
 * @example
 * ```tsx
 * <DataField fieldKey="name" label="이름" type="string" value="John Doe" />
 * <DataField fieldKey="email" label="이메일" type="email" value="john@example.com" />
 * <DataField fieldKey="avatar" type="image" value="https://example.com/avatar.jpg" />
 * ```
 */
export function DataField({
  fieldKey,
  label,
  type = "string",
  value,
  showLabel = true,
  visible = true,
  className = "",
  style,
  children,
}: DataFieldProps): React.ReactElement | null {
  // visible이 false면 렌더링하지 않음
  if (visible === false) {
    return null;
  }

  // 자식 요소가 있으면 우선 렌더링
  if (children) {
    return (
      <div
        className={`react-aria-DataField custom ${className}`}
        style={style}
        data-field-key={fieldKey}
      >
        {showLabel && label && <span className="label">{label}</span>}
        <div className="value">{children}</div>
      </div>
    );
  }

  // 타입별 렌더링
  const renderValue = () => {
    // null/undefined 처리
    if (value === null || value === undefined) {
      return <span className="value-empty">-</span>;
    }

    switch (type) {
      case "boolean":
        return <span className="value-boolean">{value ? "✓" : "✗"}</span>;

      case "number":
        return (
          <span className="value-number">
            {typeof value === "number" ? value.toLocaleString() : String(value)}
          </span>
        );

      case "date":
        return (
          <span className="value-date">
            {value instanceof Date ? value.toLocaleDateString() : String(value)}
          </span>
        );

      case "email":
        return (
          <a
            href={`mailto:${value}`}
            className="value-email"
            onClick={(e) => e.stopPropagation()}
          >
            {String(value)}
          </a>
        );

      case "url":
        return (
          <a
            href={String(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="value-url"
            onClick={(e) => e.stopPropagation()}
          >
            {String(value)}
          </a>
        );

      case "image":
        return (
          <img
            src={String(value)}
            alt={label || fieldKey || "image"}
            className="value-image"
            loading="lazy"
          />
        );

      case "string":
      default:
        return <span className="value-string">{String(value)}</span>;
    }
  };

  return (
    <div
      className={`react-aria-DataField ${type} ${className}`}
      style={style}
      data-field-key={fieldKey}
    >
      {showLabel && label && <span className="label">{label}:</span>}
      <div className="value">{renderValue()}</div>
    </div>
  );
}
