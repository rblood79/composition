import { resolveTextSourceText, textFromValue } from "@composition/specs";

/**
 * ADR-923 r17m1 — composite parent 의 propagation 대상 텍스트 (`label` 등) 를 Preview 가 읽는 단일 규칙.
 *
 * propagation engine (`resolvePropagatedProps` · Skia `applyParentPropagationProps` · Inspector
 * `buildPropagationUpdates`) 은 parent 값이 **`undefined` 일 때만** 자식을 건드리지 않고, `""`/`null` 은
 * 그대로 canonical 자식 (Label.children) 에 override 한다. Preview 도 같은 경계를 써야 세 표면이 같다:
 * parent 가 undefined 가 아니면 그 값을 그대로 (빈 문자열 포함 — 사용자가 비운 것), undefined 면 canonical
 * 자식의 텍스트 (parent 에 값이 없던 legacy 문서), 그것도 없으면 fallback.
 *
 * round 16 까지 `props.label || labelChild.children` 처럼 `||` 로 접어 사용자가 비운 `""` 가 stale 자식
 * 텍스트로 되살아났고 (Preview "Stale Group" / Skia·레이아웃 ""), SearchField/ProgressBar/Meter/ComboBox 는
 * 자식 우선이라 AI 가 parent 만 쓴 문서에서 Skia (parent override) 와 갈렸다.
 */
export function resolvePropagatedText(
  parentValue: unknown,
  child: { type: string; props?: Record<string, unknown> } | undefined,
  fallback = "",
): string {
  if (parentValue !== undefined) return textFromValue(parentValue);
  if (child) return resolveTextSourceText(child.type, child.props);
  return fallback;
}
