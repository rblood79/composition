/**
 * LayoutPresetSelector Types
 *
 * Phase 6: Layout 프리셋 시스템을 위한 타입 정의
 */

import type { CSSProperties } from "react";

/**
 * 프리셋 카테고리 (ADR-168).
 *
 * `PRESET_CATEGORIES` 가 `Record<PresetCategory, …>` 라 여기 추가하면 메타 선언 누락이
 * 컴파일 에러가 된다. 패널의 그룹 목록도 `PRESET_CATEGORIES` 에서 파생하므로, 카테고리
 * 추가 시 손댈 곳은 이 union 과 메타 한 쌍뿐이다.
 */
export type PresetCategory =
  | "basic"
  | "navigation"
  | "list"
  | "feed"
  | "complex"
  | "dashboard";

/**
 * breakpoint override 묶음 (ADR-168).
 *
 * desktop 은 base(`defaultStyle`/`containerStyle`)가 담당하므로 여기엔 없다 — 저장 형식이
 * desktop-first cascade 라 base 가 곧 desktop 값이고, 중복 선언은 두 소스를 만든다.
 * 작성 편의를 위해 **BP → 스타일** 형태로 쓰고, 저장 시 `toResponsiveConfig` 가
 * **키 → BP** (`ResponsiveValue`) 로 전치한다.
 */
export type ResponsiveStyleSet = {
  tablet?: CSSProperties;
  mobile?: CSSProperties;
};

/**
 * Slot 정의
 */
export interface SlotDefinition {
  /** Slot 이름 (고유 식별자) */
  name: string;
  /** 필수 여부 */
  required: boolean;
  /** 설명 */
  description?: string;
  /** 기본 스타일 (= desktop) */
  defaultStyle?: CSSProperties;
  /**
   * breakpoint 별 override (ADR-168).
   *
   * 슬롯은 grid 배치와 flex 크기를 **병기**한다 — grid 모드에서 `flex` 는 무시되고 flex
   * 모드에서 grid line 이 무시되므로, mobile 재배치가 대부분 컨테이너 `display` 한 줄로
   * 끝나고 슬롯 트리는 평면으로 유지된다.
   */
  responsiveStyle?: ResponsiveStyleSet;
}

/**
 * SVG 미리보기 영역.
 *
 * `derivePreviewAreas` 가 프리셋 정의에서 breakpoint 별로 파생한다 (ADR-168 P-1) — 손으로
 * 적는 배열이 아니다. 수동 배열이던 시절엔 레이아웃을 고쳐도 썸네일이 옛 모양을 계속 보여줬다.
 */
export interface PreviewArea {
  /** 영역 이름 (React key 겸용 — 유일해야 한다) */
  name: string;
  /** X 위치 (%) */
  x: number;
  /** Y 위치 (%) */
  y: number;
  /** 너비 (%) */
  width: number;
  /** 높이 (%) */
  height: number;
  /**
   * Slot 여부.
   *
   * `false` = 슬롯이 아닌 보조 사각형 (격자 슬롯 내부의 카드 셀). 이름표가 붙지 않고 배경도
   * 가장 안쪽 표면으로 낮춘다.
   */
  isSlot: boolean;
  /** 필수 여부 */
  required?: boolean;
}

/**
 * 레이아웃 프리셋
 */
export interface LayoutPreset {
  /** 프리셋 ID */
  id: string;
  /** 프리셋 이름 */
  name: string;
  /** 설명 */
  description: string;
  /** 카테고리 */
  category: PresetCategory;
  /** Slot 정의 목록 */
  slots: SlotDefinition[];
  /** 컨테이너 스타일 (CSS Grid/Flexbox) = desktop */
  containerStyle?: CSSProperties;
  /**
   * 컨테이너의 breakpoint 별 override (ADR-168).
   *
   * 좁은 폭에서 사이드바를 **줄이는 게 아니라 형태를 바꾸는** 것이 레퍼런스 공통 원칙이라
   * (M3 canonical / Apple HIG split view / column drop), mobile 은 대개
   * `display: grid → flex` + `flexDirection: column` 로 세로 스택 전환이다.
   */
  responsiveContainerStyle?: ResponsiveStyleSet;
}

/**
 * 프리셋 적용 모드
 */
export type PresetApplyMode = "replace" | "merge" | "cancel";

/**
 * 기존 Slot 정보
 */
export interface ExistingSlotInfo {
  /** Slot 이름 */
  slotName: string;
  /** Element ID */
  elementId: string;
  /** 자식 요소 존재 여부 */
  hasChildren: boolean;
}

/**
 * 프리셋 카테고리 메타데이터
 */
export interface PresetCategoryMeta {
  label: string;
  icon: string;
}
