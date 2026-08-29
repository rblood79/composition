/**
 * Keyboard Shortcuts Type Definitions
 *
 * 키보드 단축키 시스템의 타입 정의
 *
 * @since Phase 2 구현 (2025-12-28)
 */

import type { KeyboardModifier, ShortcutCategory } from "@/builder/hooks";

// ============================================
// Scope Types
// ============================================

/**
 * 단축키 활성화 스코프
 *
 * - global: 항상 활성
 * - canvas-focused: 캔버스에 포커스가 있을 때
 * - panel:*: 특정 패널이 활성화되었을 때
 * - modal: 모달이 열려있을 때
 * - text-editing: 텍스트 입력 중
 */
export type ShortcutScope =
  | "global"
  | "canvas-focused"
  | "panel:properties"
  | "panel:styles"
  | "panel:events"
  | "panel:navigator"
  | "modal"
  | "text-editing";

// ============================================
// Shortcut Definition Types
// ============================================

/**
 * 단축키 정의 (핸들러 제외)
 *
 * 설정 파일에서 사용되는 단축키 메타데이터
 */
export interface ShortcutDefinition {
  /** 키 (예: 'z', 'c', '=') */
  key: string;

  /** KeyboardEvent.code (예: 'Space', 'NumpadAdd') */
  code?: string;

  /** Modifier 키 조합 */
  modifier: KeyboardModifier;

  /** 카테고리 */
  category: ShortcutCategory;

  /** 활성화 스코프 (배열이면 여러 스코프에서 활성) */
  scope: ShortcutScope | readonly ShortcutScope[];

  /** 우선순위 (높을수록 먼저 실행) */
  priority: number;

  /** 입력 필드에서도 동작 여부 */
  allowInInput?: boolean;

  /** capture 단계에서 처리 여부 */
  capture?: boolean;

  /** 설명 */
  description: string;

  /**
   * 명령 팔레트 노출 여부 (ADR-195). 생략 = 노출.
   *
   * `false` 는 **팔레트로는 실행할 수 없는 것이 맞는** 항목에만 붙인다 — 팔레트
   * 자신과, RAC `TreeBase` 네이티브 키보드가 처리해 registry 등록 자체가 없는
   * 레이어 트리 8종(포커스된 행에 작용하므로 팔레트가 닫히며 복원되는 포커스가
   * 그 행이라는 보장이 없다). 정적 게이트가 allowlist 로 고정한다.
   */
  palette?: false;

  /** 다국어 설명 */
  i18n?: {
    ko?: string;
    ja?: string;
    [locale: string]: string | undefined;
  };
}

/**
 * 단축키 핸들러 맵
 *
 * 키를 `string` 으로 두는 것은 의도다 — 여기서 `ShortcutId`(정본은
 * `config/keyboardShortcuts.ts` 의 `keyof typeof SHORTCUT_DEFINITIONS`)를
 * 참조하면 config → keyboard → config 순환이 된다.
 */
export type ShortcutHandlers = Record<string, () => void>;

/**
 * 단축키 정의 맵 — **`SHORTCUT_DEFINITIONS` 에 타입 주석으로 붙이지 말 것.**
 *
 * 주석(`const X: ShortcutDefinitions = {...} as const`)은 `as const` 를 이겨
 * `typeof X` 를 이 `Record<string, …>` 로 만들고, 그러면 그로부터 파생되는
 * `ShortcutId = keyof typeof SHORTCUT_DEFINITIONS` 가 **`string` 으로 무너진다**.
 * 실측(2026-08-17): 존재하지 않는 단축키 id 를 `ShortcutId` 에 대입해도
 * 컴파일이 통과했고, 30+ 소비처의 `as ShortcutId` 캐스팅이 전부 no-op 이었다.
 * 형태 검사가 필요하면 `satisfies ShortcutDefinitions` 를 쓸 것 — 그래야
 * `keyof` 가 리터럴 union 을 유지한 채 항목별 검사도 받는다.
 */
export type ShortcutDefinitions = Record<string, ShortcutDefinition>;

// ============================================
// Help Panel Types
// ============================================

/**
 * 도움말 패널용 단축키 그룹
 */
export interface ShortcutGroup {
  /** 그룹 ID */
  id: ShortcutCategory;

  /** 그룹 라벨 */
  label: string;

  /** 그룹 내 단축키 ID 목록 */
  shortcuts: string[];
}

/**
 * 도움말 패널용 단축키 표시 정보
 */
export interface ShortcutDisplayInfo {
  /** 단축키 ID */
  id: string;

  /** 플랫폼별 표시 문자열 (예: "⌘Z" 또는 "Ctrl+Z") */
  display: string;

  /** 설명 */
  description: string;

  /** 카테고리 */
  category: ShortcutCategory;
}

// ============================================
// Conflict Detection Types
// ============================================

/**
 * 단축키 충돌 정보
 */
export interface ShortcutConflict {
  /** 기존 단축키 ID */
  existingId: string;

  /** 새 단축키 ID */
  newId: string;

  /** 충돌하는 키 조합 */
  keyCombo: string;

  /** 해결 방법 */
  resolution: "override" | "skip" | "error";
}

// ============================================
// Re-exports
// ============================================

export type { KeyboardModifier, ShortcutCategory } from "@/builder/hooks";
