import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalDistributeCenter,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowUpRight,
  ClipboardPaste,
  Component,
  Copy,
  CopyPlus,
  Group,
  Magnet,
  RulerDimensionLine,
  Trash2,
  Ungroup,
  Unlink,
} from "lucide-react";
import type { ComponentType } from "react";
import type { AlignmentType } from "../stores/utils/elementAlignment";
import type { DistributionType } from "../stores/utils/elementDistribution";

/**
 * 아이콘 컴포넌트 참조 타입.
 *
 * provider 계열은 `.ts` 라 JSX 를 쓸 수 없어 `ReactNode` 가 아니라 컴포넌트
 * 타입이다. 치수·색은 호출부가 정하므로 여기서는 선택 prop 으로만 둔다.
 */
export type ActionIcon = ComponentType<{
  size?: number | string;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

/**
 * **2개 이상 surface 에 노출되는 사용자 액션**의 아이콘 정본.
 *
 * ## 왜 필요한가 (2026-08-16 실측)
 *
 * 빌더 크롬 아이콘은 106개 파일이 `lucide-react` 를 각자 import 한다 (고유
 * 220심볼 / import 지점 537 / 그 중 105심볼이 2개 이상 파일에 중복). 대부분은
 * 1회성이라 그대로 두는 것이 맞지만, **같은 액션이 여러 화면에 나오는 항목**은
 * 한쪽만 바꾸면 같은 동작이 다른 그림으로 읽힌다. 실제로 두 건이 갈려 있었다:
 *
 * | 액션 | 갈린 형태 |
 * | --- | --- |
 * | 삭제 | `Trash2` 25곳 vs **`Trash`** — FramesTab 2파일 (라이브) |
 * | 눈금자 토글 | 컨텍스트 메뉴 `Ruler` vs SettingsPanel `RulerDimensionLine` — **같은 `setShowRulers`** |
 *
 * HistoryPanel `ENTRY_TYPE_ICONS` 의 `page-guide` 주석("눈금자 토글과 같은
 * 아이콘")처럼 손으로 맞춘 흔적도 이미 있다 — 규약이 코드에 없으니 매번 사람이
 * 기억해야 했다.
 *
 * ## 등재 기준
 *
 * 1. 같은 사용자 액션이 **2개 이상 surface** 에 노출된다.
 * 2. 그 액션이 **한 벌로 읽히는 묶음**에 속하면 묶음 전체를 함께 등재한다
 *    (정렬 8종처럼 낱개만 등재하면 나머지가 다시 갈린다).
 *
 * 기준에 안 맞으면 등재하지 않는다 — z-order 4종·줌 2종처럼 컨텍스트 메뉴에만
 * 있는 것은 직접 import 가 맞다. 조회 비용만 늘고 막아 주는 것이 없다.
 *
 * ## 무엇을 소유하지 않는가 — 치수·색
 *
 * 같은 삭제 액션이라도 컨텍스트 메뉴는 14px, 툴바는 `iconProps.size`(16px)이고
 * **그게 맞다** (surface 밀도가 다르다). registry 는 "무엇을" 만 소유하고
 * "얼마나 크게 / 무슨 색" 은 호출부가 정한다. 치수까지 넣으면 registry 가
 * surface 별 분기를 흡수하며 비대해진다.
 *
 * ## 집행
 *
 * `actionIcons.static.test.ts` 가 두 조항을 기계 집행한다 — 등재 심볼의
 * registry 밖 직접 import 0건, 등재 항목별 소비처 ≥1. registry 만 두면 새 코드가
 * 안 쓰면 그만이라 반쪽이 된다 (ADR-900 잔재 게이트가 소비자 0건인 채 수개월
 * 남았던 것과 같은 형태).
 */
export const ACTION_ICONS = {
  // ── 편집 ──────────────────────────────────────────────
  /** 컨텍스트 메뉴 · 다중 선택 툴바 · Styles/Properties 패널 헤더 */
  copy: Copy,
  paste: ClipboardPaste,
  duplicate: CopyPlus,
  /** 컨텍스트 메뉴 · 다중 선택 툴바 · History 항목 · FramesTab */
  delete: Trash2,

  // ── 구성 ──────────────────────────────────────────────
  /** 컨텍스트 메뉴 · 다중 선택 툴바 · History 항목 */
  group: Group,
  ungroup: Ungroup,

  // ── 컴포넌트 (origin/instance) ────────────────────────
  /** 컨텍스트 메뉴 · Properties 패널 Component 섹션 */
  component: Component,
  goToOrigin: ArrowUpRight,
  detach: Unlink,

  // ── 정렬·분배 ─────────────────────────────────────────
  /** 정렬 서브메뉴 자신을 가리키는 대표 아이콘 */
  align: AlignCenterHorizontal,
  alignLeft: AlignLeft,
  alignCenter: AlignCenter,
  alignRight: AlignRight,
  alignTop: AlignVerticalJustifyStart,
  alignMiddle: AlignVerticalJustifyCenter,
  alignBottom: AlignVerticalJustifyEnd,
  distributeHorizontal: AlignHorizontalDistributeCenter,
  distributeVertical: AlignVerticalDistributeCenter,

  // ── 뷰 토글 ───────────────────────────────────────────
  /**
   * 컨텍스트 메뉴 · Settings 패널. `Ruler` 가 아니라 `RulerDimensionLine` 이다 —
   * Settings 패널과 History 의 `page-guide` 가 이미 이 그림을 쓰고 있었고,
   * 가이드는 눈금자에서 만들어 눈금자로 되돌려 지우므로 한 기능군이어야 한다.
   */
  toggleRulers: RulerDimensionLine,
  toggleSnap: Magnet,
} as const satisfies Record<string, ActionIcon>;

export type ActionIconKey = keyof typeof ACTION_ICONS;

/**
 * 정렬 6방향의 도메인 타입 키 매핑.
 *
 * 컨텍스트 메뉴는 `AlignmentType` 으로 순회하고 다중 선택 툴바는 버튼을 하나씩
 * 적는다 — 두 형태가 같은 값을 읽도록 여기서 한 번만 대응시킨다. 순회하는 쪽이
 * 자기 맵을 따로 만들면 그 맵이 두 번째 정의처가 된다.
 */
export const ALIGNMENT_ICONS: Record<AlignmentType, ActionIcon> = {
  left: ACTION_ICONS.alignLeft,
  center: ACTION_ICONS.alignCenter,
  right: ACTION_ICONS.alignRight,
  top: ACTION_ICONS.alignTop,
  middle: ACTION_ICONS.alignMiddle,
  bottom: ACTION_ICONS.alignBottom,
};

/** 분배 2축의 도메인 타입 키 매핑 ([[ALIGNMENT_ICONS]] 와 같은 이유). */
export const DISTRIBUTION_ICONS: Record<DistributionType, ActionIcon> = {
  horizontal: ACTION_ICONS.distributeHorizontal,
  vertical: ACTION_ICONS.distributeVertical,
};
