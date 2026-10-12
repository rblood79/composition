import React from "react";

import "./PropertySelectGrid.css";

import "./PropertySwatch.css";

import { type PopoverWidthMode } from "./useControlPopoverMetrics";

export interface PropertySelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  /** 컬렉션 컬럼명 등 사용자 데이터는 번역하지 않는다. */
  translateOptions?: boolean;
  /**
   * 옵션 값의 해석 모드 (기본 `legacy`).
   *
   * - `legacy`: 기존 동작. item key = 옵션 값 자체이며 `"reset"` 은 스타일 초기화 명령으로
   *   해석해 `onChange("")` 로 바꾼다. 빈 값은 선택 없음(또는 reset 항목)으로 표현한다.
   * - `literal`: 옵션 값이 UI 문구가 아니라 **원본 데이터 키**다. item key 를 값과 일대일
   *   대응하는 비어 있지 않은 UI key 로 바꿔 빈 문자열도 유효한 항목으로 표현하고,
   *   선택 시 현재 options 에서 대응 항목을 찾아 **원본 값 그대로** 전달한다. 예약 문자열
   *   치환이 없으므로 `reset` 이라는 이름의 실제 필드도 손실 없이 저장된다.
   *
   * literal 모드는 라벨 번역 정책(`translateOptions`)과 독립이다 — 한쪽이 다른 쪽을
   * 활성화하지 않는다.
   */
  optionValueMode?: "legacy" | "literal";
  /**
   * 값 → 색 (CSS 색/토큰). 있으면 트리거와 항목 앞에 색 점 — 값이 곧 색인 variant (Button ·
   * Badge · StatusLight) 의 미리보기. 없는 값은 점 없이 글자만.
   */
  swatches?: Readonly<Record<string, string>>;
  /**
   * 팝오버를 목록 대신 **6열 스와치 격자** 로 (Theme 패널 tint-grid 어법 — 28 칸 · gap 8 · 선택
   * 체크). 값이 곧 색인 variant (Badge 25 · StatusLight 19, 2026-09-16 사용자 판정 「A 팝오버
   * grid」). 트리거는 그대로 색 점 + 이름. `swatches` 가 함께 있어야 칸에 색이 든다. 구획
   * (`gridSections` — 옵션 값 묶음, 순서대로) 사이엔 구분선. 어느 구획에도 없는 값은 마지막
   * 구획 뒤에 선다. RAC ListBox `layout="grid"` 라 화살표 2차원 이동 · 타이핑 검색 유지.
   * 칸의 이름은 `title` (hover) + 접근 이름 (`textValue`).
   */
  grid?: boolean;
  gridSections?: readonly (readonly string[])[];
  /**
   * 선택 불가 항목의 **옵션 값** (ADR-210 — columns 모드의 Pie/Radial). RAC `Select`
   * 의 `disabledKeys` 로 그대로 전달하며 (literal 모드는 UI key 로 변환) reset/literal/
   * 키보드 계약은 바꾸지 않는다. 사유 문구는 호출부가 별도 hint 로 둔다.
   */
  disabledKeys?: readonly string[];
  icon?: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  className?: string;
  /**
   * `legend` (기본, 필드 위 18 행) / `inline` (legend·아이콘 없이 28 상자만 — 값이 곧 라벨인
   * 셀렉트, Font Weight 「Semi Bold ▾」 등. 접근 이름은 label 그대로, panel-ui 03) /
   * `suffix` (라벨을 상자 안 우측 10 mono caps 로 — 「Primary VARIANT ▾」, panel-ui 07).
   */
  labelMode?: "legend" | "inline" | "suffix";
  suffixLabel?: string;
  description?: string; // Optional description (not displayed)
  /**
   * 컨트롤 박스 아래 필드 상태 문구 슬롯 (RAC `<Text slot="description">` / `.react-aria-FieldError`).
   * 값·데이터에 반응하는 메시지만 — 정적 설명은 여기 두지 않는다 (legend help 후속).
   */
  afterControl?: React.ReactNode;
  popoverWidthMode?: PopoverWidthMode;
}

/**
 * literal 모드의 UI item key — 원본 값과 일대일 대응하며 비어 있지 않다.
 *
 * `""` / `"reset"` / `"value:\"\""` 같은 서로 다른 원본 문자열이 같은 key 로 접히지
 * 않아야 하므로 JSON 직렬화를 쓴다. locale·목록 순서·라벨에 의존하지 않는다.
 */
export function literalKey(value: string): string {
  return `value:${JSON.stringify(value)}`;
}

/** 값 비교 memo 는 그대로, 호출은 최신 콜백으로 (`withLatestCallbacks`). */
