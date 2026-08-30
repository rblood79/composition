/**
 * ADR-158 Phase 2 — 표시 레이블.
 *
 * capability 레이블은 `CAPABILITY_REGISTRY` 가 이미 갖고 있으므로 여기서는
 * When 축(RAC callback)과 Do 축 최상위 선택지만 다룬다.
 */

/** 문구 해소기 — 순수 모듈이라 훅을 못 쓴다, 호출부가 넘긴다 (ADR-200 후속). */
export type LabelTranslate = (
  key: string,
  params?: Record<string, string | number | boolean>,
) => string;

/** RAC callback → 카탈로그 키. 미등록 trigger 는 원문 그대로 노출한다. */
export const TRIGGER_LABEL_KEYS: Readonly<Record<string, string>> = {
  onPress: "interactions.triggerOnPress",
  onChange: "interactions.triggerOnChange",
  onSelectionChange: "interactions.triggerOnSelectionChange",
  onExpandedChange: "interactions.triggerOnExpandedChange",
  onOpenChange: "interactions.triggerOnOpenChange",
  onInputChange: "interactions.triggerOnInputChange",
  onChangeEnd: "interactions.triggerOnChangeEnd",
  onAction: "interactions.triggerOnAction",
  onRemove: "interactions.triggerOnRemove",
  onSubmit: "interactions.triggerOnSubmit",
  onReset: "interactions.triggerOnReset",
  onFocus: "interactions.triggerOnFocus",
  onBlur: "interactions.triggerOnBlur",
};

/** 미등록 trigger 는 RAC 원문(onCustomThing)이 그대로 나가는 편이 낫다. */
export function triggerLabel(trigger: string, t: LabelTranslate): string {
  const key = TRIGGER_LABEL_KEYS[trigger];
  return key ? t(key) : trigger;
}

export const ACTION_CHOICE_LABEL_KEYS = {
  navigate: "interactions.actionNavigate",
  toast: "interactions.actionToast",
  capability: "interactions.actionCapability",
} as const;
