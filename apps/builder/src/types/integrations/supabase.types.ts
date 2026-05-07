import React from "react";
import { TokenValue } from "../theme";
import type { ElementEvent } from "../events/events.types";

type AriaRole =
  | "button"
  | "checkbox"
  | "menuitem"
  | "menubar"
  | "navigation"
  | "progressbar"
  | "separator"
  | "slider"
  | "switch"
  | "tab"
  | "tabpanel"
  | "textbox"
  | "presentation"
  | undefined;

export interface ToggleButtonProps {
  isSelected?: boolean;
  defaultSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  isDisabled?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  "data-element-id"?: string;
  [key: string]:
    | string
    | number
    | boolean
    | React.ReactNode
    | React.CSSProperties
    | ((isSelected: boolean) => void)
    | undefined;
}

export interface ButtonProps {
  isDisabled?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  "data-element-id"?: string;
  [key: string]:
    | string
    | number
    | boolean
    | React.ReactNode
    | React.CSSProperties
    | (() => void)
    | undefined;
}

export interface ToggleButtonGroupProps {
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  isDisabled?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  "data-element-id"?: string;
  selectionMode?: "single" | "multiple";
  orientation?: "horizontal" | "vertical";
  [key: string]:
    | string
    | string[]
    | boolean
    | React.ReactNode
    | React.CSSProperties
    | ((value: string[]) => void)
    | "single"
    | "multiple"
    | "horizontal"
    | "vertical"
    | undefined;
}

export interface ElementProps {
  tag?: string;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
  role?: AriaRole;
  tabIndex?: number;
  // Panel 관련 props
  title?: string;
  variant?: "default" | "tab" | "sidebar" | "card" | "modal";

  // HTML 글로벌 속성
  id?: string;
  lang?: string;
  translate?: "yes" | "no";
  dir?: "ltr" | "rtl" | "auto";
  hidden?: boolean;
  // 폼 관련 속성
  name?: string;
  value?: string | number | readonly string[];
  defaultValue?: string | number | readonly string[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  // ARIA 속성
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-hidden"?: boolean;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: boolean;
  "aria-controls"?: string;
  "aria-pressed"?: boolean | "mixed";
  // ToggleButton 속성
  isSelected?: boolean;
  defaultSelected?: boolean;
  // 이벤트 핸들러
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  onChange?: (event: React.ChangeEvent<HTMLElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
  onKeyUp?: (event: React.KeyboardEvent<HTMLElement>) => void;
  // 데이터 속성
  [key: `data-${string}`]: string | number | boolean | undefined;

  // 이벤트 시스템 (명시적으로 정의)
  events?: ElementEvent[];

  // 추가 속성 (인덱스 시그니처에 ElementEvent[] 타입 추가)
  [key: string]:
    | string
    | number
    | boolean
    | React.CSSProperties
    | React.ReactNode
    | readonly string[]
    | ElementEvent[]
    | ((event: React.MouseEvent<HTMLElement>) => void)
    | ((event: React.ChangeEvent<HTMLElement>) => void)
    | ((event: React.FocusEvent<HTMLElement>) => void)
    | ((event: React.KeyboardEvent<HTMLElement>) => void)
    | undefined;
}

export interface Database {
  public: {
    Tables: {
      pages: {
        Row: {
          id: string;
          title: string;
          project_id: string;
          slug: string;
          parent_id?: string | null;
          order_num?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      elements: {
        Row: {
          id: string;
          type: string;
          props: ElementProps;
          page_id: string;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      design_tokens: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          type: string;
          value: TokenValue;
          created_at?: string;
        };
      };
    };
  };
}

export interface ListBoxItemData {
  id: string;
  type?: "simple" | "complex" | "custom";
  text?: string;
  label?: string;
  description?: string;
  subtitle?: string;
  image?: {
    src: string;
    alt?: string;
    size?: "small" | "medium" | "large";
  };
  icon?: {
    name: string;
    size?: number;
    color?: string;
  };
  disabled?: boolean;
  selected?: boolean;
  style?: React.CSSProperties;
  className?: string;
  metadata?: Record<string, unknown>;
  actions?: Array<{
    id: string;
    label: string;
    icon?: string;
    onClick?: () => void;
  }>;
}

export interface ListBoxProps extends Omit<
  ElementProps,
  keyof { [key: string]: unknown }
> {
  label?: string;
  orientation?: "horizontal" | "vertical";
  itemLayout?: "default" | "compact" | "detailed" | "grid";
  items?: ListBoxItemData[];
  [key: string]: unknown;
}
