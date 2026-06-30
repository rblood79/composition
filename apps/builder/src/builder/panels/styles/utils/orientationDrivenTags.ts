/**
 * orientation-SSOT 컨테이너 단일 소스
 *
 * 일부 컨테이너는 flexDirection 의 SSOT 가 `props.style.flexDirection` 이 아니라
 * `props.orientation` prop 이다(commit d9ef79bcb, ToggleButtonGroup 도입). 렌더
 * derive 경로(fullTreeLayout / implicitStyles / CSS [data-orientation])가
 * `orientation → flexDirection`(vertical→column / horizontal→row)을 단방향 도출하고
 * inline style.flexDirection 을 무시한다.
 *
 * 이 컨테이너들에서 Style 패널 Direction 토글은:
 *  1) 편집 입력을 style 이 아닌 `props.orientation` 으로 번역해야 양방향 동기화 +
 *     화면 반영이 된다(이중 저장 아님 — 단일 SSOT 유지).
 *  2) `block` 은 모델에 없는 상태이므로 토글에서 disable.
 *
 * ⚠️ ButtonGroup 은 SSOT 가 정반대(style.flexDirection 이 Skia/Taffy 직접 read,
 *    orientation 은 CSS/preview 전용 채널)라 여기 포함하지 않는다 — 포함 시 새 drift.
 *    CheckboxGroup/RadioGroup 은 orientation 이 items-wrapper 축이고 그룹 축은
 *    labelPosition 인 2축 직교 구조라 비동형. (2026-06-30 전수조사 결론)
 *
 * element.type 은 PascalCase 저장 → derive 경로(`.toLowerCase()` 비교)와 동일하게
 * 정규화한 소문자 집합으로 둔다.
 */
export const ORIENTATION_DRIVEN_TAGS: ReadonlySet<string> = new Set([
  "togglebuttongroup",
  "toolbar",
]);

/** 선택 요소가 orientation-SSOT 컨테이너인지 (PascalCase type 입력 허용). */
export function isOrientationDrivenTag(type: string | undefined): boolean {
  return ORIENTATION_DRIVEN_TAGS.has((type ?? "").toLowerCase());
}

/** Direction 토글 값 → orientation prop 값 (block 은 모델에 없어 horizontal 흡수). */
export function flexDirectionToOrientation(
  value: string,
): "horizontal" | "vertical" {
  return value === "column" ? "vertical" : "horizontal";
}
