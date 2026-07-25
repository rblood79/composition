/**
 * ADR-158 Phase 2 — 표시 레이블.
 *
 * capability 레이블은 `CAPABILITY_REGISTRY` 가 이미 갖고 있으므로 여기서는
 * When 축(RAC callback)과 Do 축 최상위 선택지만 다룬다.
 */

/** RAC callback → 한국어 레이블. 미등록 trigger 는 원문 그대로 노출한다. */
export const TRIGGER_LABELS: Readonly<Record<string, string>> = {
  onPress: "누를 때",
  onChange: "값이 바뀔 때",
  onSelectionChange: "선택이 바뀔 때",
  onExpandedChange: "펼침이 바뀔 때",
  onOpenChange: "열림이 바뀔 때",
  onInputChange: "입력이 바뀔 때",
  onChangeEnd: "값 변경이 끝날 때",
  onAction: "항목을 실행할 때",
  onRemove: "항목을 제거할 때",
  onSubmit: "제출할 때",
  onReset: "초기화할 때",
  onFocus: "포커스를 받을 때",
  onBlur: "포커스를 잃을 때",
};

export const ACTION_CHOICE_LABELS = {
  navigate: "페이지 이동",
  toast: "토스트 표시",
  capability: "컴포넌트 기능…",
} as const;
