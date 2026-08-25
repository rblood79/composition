import React from "react";

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

// `ToggleButtonProps` / `ButtonProps` 는 삭제됐다 (2026-08-17) — 소비처 0건.
// 이름이 겹치는 `SwatchIconButton.tsx` / `ActionIconButton.tsx` 의
// `RACToggleButtonProps` 는 `react-aria-components` 에서 별칭 import 하는
// 것이라 이 선언과 무관했다. 실제 Button props 정본은
// `packages/shared/src/components/Button.tsx` (RACButtonProps 확장).

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

  // 이벤트 시스템 — legacy 잔존 데이터. shape 무의존이라 `unknown[]` 이다
  // (구 `ElementEvent` 선언은 소비처 0 으로 은퇴. 2026-08-17: 마지막 reader
  // `getElementEvents` 도 삭제 — ADR-158 이 인터랙션을 canonical root `events`
  // 컬렉션으로 옮겼다. 이 필드는 roundtrip 보존만 되는 legacy 저장 데이터다).
  events?: unknown[];

  // 추가 속성 (인덱스 시그니처에 legacy events 배열 포함)
  [key: string]:
    | string
    | number
    | boolean
    | React.CSSProperties
    | React.ReactNode
    | readonly string[]
    | unknown[]
    | ((event: React.MouseEvent<HTMLElement>) => void)
    | ((event: React.ChangeEvent<HTMLElement>) => void)
    | ((event: React.FocusEvent<HTMLElement>) => void)
    | ((event: React.KeyboardEvent<HTMLElement>) => void)
    | undefined;
}

// ADR-128 cloud decommission 후 Supabase Database interface 는 production caller 0 (auth 만 active).
// 본 interface 와 row 정의 (pages / elements / design_tokens / documents) 는 dead — 제거됨 (2026-05-15).
// auth 사용은 `env/supabase.client.ts` 의 `createClient()` 가 직접 처리.
