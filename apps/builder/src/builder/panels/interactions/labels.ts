/**
 * ADR-158 Phase 2 · ADR-281 Decision 1 — 표시 레이블.
 *
 * capability 레이블은 `CAPABILITY_REGISTRY` 가 이미 갖고 있으므로 여기서는
 * When 축(RAC callback)과 Do 축 최상위 선택지만 다룬다. When 의 키는 손 목록이 아니라
 * 등록표의 그룹 (개념 = RAC 문서 절) 에서 유도한다 — `interactions.trigger.<개념>.<callback>`.
 */
import { triggerGroupOf } from "@composition/shared";

/** 문구 해소기 — 순수 모듈이라 훅을 못 쓴다, 호출부가 넘긴다 (ADR-200 후속). */
export type LabelTranslate = (
  key: string,
  params?: Record<string, string | number | boolean>,
) => string;

/** When 한 callback 의 카탈로그 키 (그 type 의 그룹 — 같은 callback 도 개념마다 문구가 다르다). */
export const triggerLabelKey = (group: string, event: string) =>
  `interactions.trigger.${group}.${event}`;

/** When 그룹 (개념) 머리글의 카탈로그 키. */
export const triggerGroupLabelKey = (group: string) =>
  `interactions.triggerGroup.${group}`;

/** 번역이 없으면 (t 가 키를 그대로 돌려줌) RAC 원문 callback 이름이 나가는 편이 낫다. */
export function triggerLabel(
  componentType: string,
  trigger: string,
  t: LabelTranslate,
): string {
  const group = triggerGroupOf(componentType, trigger);
  if (!group) return trigger;
  const key = triggerLabelKey(group.id, trigger);
  const text = t(key);
  return text === key ? trigger : text;
}

export function triggerGroupLabel(group: string, t: LabelTranslate): string {
  const key = triggerGroupLabelKey(group);
  const text = t(key);
  return text === key ? group : text;
}

export const ACTION_CHOICE_LABEL_KEYS = {
  navigate: "interactions.actionNavigate",
  toast: "interactions.actionToast",
  setState: "interactions.actionSetState",
  capability: "interactions.actionCapability",
  callEndpoint: "interactions.actionCallEndpoint",
} as const;
