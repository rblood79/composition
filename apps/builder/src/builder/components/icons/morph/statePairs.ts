/**
 * ICON_STATE_PAIRS — 상태 쌍 정본 (ADR-197 Phase 2)
 *
 * 빌더 크롬의 아이콘 정본은 셋이고 축이 다르다:
 *
 * - **액션** `config/actionIcons.ts` — 같은 액션이 여러 화면에 나올 때의 그림
 * - **속성 필드** `config/propertyFieldIcons.ts` — catalog 필드 key 의 그림
 * - **상태 쌍** (여기) — 한 컨트롤의 on/off **형태**
 *
 * 등재 조건 (`.claude/rules/panel-structure.md` §아이콘):
 *
 * 1. 한 컨트롤의 두 상태여야 한다 — 탭 아이콘, 1회 실행 액션, 서로 다른 요소는 아니다.
 * 2. 양끝이 `getIconData` 에 있어야 한다 (`statePairs.test.ts` 가 집행).
 * 3. 같은 화면의 필드 아이콘과 그림이 겹치지 않아야 한다 — `propertyFieldIcons` 가
 *    `isReadOnly: Lock` / `isQuiet: EyeOff` / `showValueLabel: Eye` 를 쓰므로,
 *    `lock` · `visible` 쌍은 그 필드와 같은 화면에 서지 않는지 확인하고 등재한다.
 *
 * 짝이 없으면 등재하지 않는다 — `StateIcon` 이 레지스트리 키만 받는 것이 곧
 * fallback 규칙이다 (짝 없는 토글은 기존 정적 아이콘 + `data-selected` 유지).
 */

/** `[off, on]` — index 1 이 "활성 · 잠김 · 보임 · 펼침". */
export const ICON_STATE_PAIRS = {
  /** aspectRatio 잠금 — 사용자 예시의 lock-keyhole 쌍 (고리만 회전). */
  lock: ["lock-keyhole-open", "lock-keyhole"],
  /** breakpoint 별 표시/숨김. */
  visible: ["eye-off", "eye"],
  /**
   * Action Bar 고정. index 1 이 `pin-off` 인 것은 기존 어법을 지킨 것이다 —
   * 고정된 상태에서 "고정 해제" 를 가리키는 액션 아이콘으로 써 왔다.
   */
  pin: ["pin", "pin-off"],
  /** 접기/펼치기 (chevron 90° 회전 — 수학에서 나온다). */
  expand: ["chevron-right", "chevron-down"],
  /** 라이트/다크. */
  theme: ["sun", "moon"],
  /** 여백 컨트롤 펼침 (화살촉만 반전). */
  spacing: ["maximize-2", "minimize-2"],
} as const satisfies Record<string, readonly [off: string, on: string]>;

export type IconStatePair = keyof typeof ICON_STATE_PAIRS;
