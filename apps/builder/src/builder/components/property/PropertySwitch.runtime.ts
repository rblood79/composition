import React from "react";

export interface PropertySwitchProps {
  label: string;
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
  icon?: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  className?: string;
  description?: string; // Optional description (not displayed)
  /**
   * `legend` (기본, 필드 위 18 행 + 28 상자) / `inline` — 라벨 왼쪽 · 스위치 오른쪽 한 행 28,
   * 상자 없음 (「Disabled ─────── ●」, panel-ui 07 tglrow). 접근 이름은 aria-label 그대로.
   */
  labelMode?: "legend" | "inline";
}

/** 값 비교 memo 는 그대로, 호출은 최신 콜백으로 (`withLatestCallbacks`). */
