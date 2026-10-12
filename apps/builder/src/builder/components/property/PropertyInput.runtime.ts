import React from "react";

import "./PropertyInput.css";

export interface PropertyInputProps {
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number" | "color";
  icon?: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  placeholder?: string;
  className?: string;
  multiline?: boolean; // New prop for multiline input
  min?: string | number; // 최소값
  max?: string | number; // 최대값
  disabled?: boolean; // Disable input (read-only)
  description?: string; // Optional description (not displayed)
  /**
   * ADR-214 Phase 3 — `{{` 자동완성 후보 (가시성 사슬의 변수 이름). 캐럿 앞이 `{{ 접두` 이면
   * 목록을 보여 주고 Enter/클릭으로 `{{ name }}` 을 넣는다. 미지정이면 종전 입력.
   */
  stateNames?: readonly string[];
  /** `suffix` — legend·아이콘 없이 라벨을 상자 안 우측 (10 mono caps) 으로 (panel-ui 07). */
  labelMode?: "legend" | "suffix";
  suffixLabel?: string;
  /** 컨트롤 아래 필드 상태 문구 (`<span slot="description">` — `PropertySelect.afterControl` 과 같은 자리). */
  afterControl?: React.ReactNode;
}

export const STATE_TRIGGER = /\{\{\s*([A-Za-z_$][\w$]*)?$/;

/** 값 비교 memo 는 그대로, 호출은 최신 콜백으로 (`withLatestCallbacks`). */
