/**
 * ADR-912 1A-(c) — Skia 시각 어댑터 (base⊕override 완결 병합, HC#3/#4).
 *
 * 노드의 시각값을 **token-해소된 merged style map** 으로 산출한다. DOM 어댑터
 * (`toReactStyle`)와 **같은 `resolveMergedStyle` base/override 분리 코어를 재사용**하되,
 * Skia 는 런타임에 TokenRef 를 구체값으로 해소해야 하므로 `resolveToken` 으로 완결 병합한다.
 *
 * **1A-(b) 와의 차이 (token 해소 들어옴)**: 1A-(b) DOM `toReactStyle` 은 override 전용이라
 *   token 해소 불요(사용자 입력 = 이미 구체값, base 는 generated CSS 담당). 1A-(c) Skia 는
 *   base(theme rule)를 런타임에 직접 그리므로 base 의 TokenRef(`{typography.text-xs}` 등)를
 *   해소해야 한다 → 본 어댑터가 token 해소 단일 진입점.
 *
 * **패키지 위치 (의존 그래프 실측 2026-06-03)**: 의존 방향은 `shared → specs` (shared 가
 *   `@composition/specs` 의존, specs 는 shared 의존 0 — specs 가 하위 레이어). 분리 코어
 *   `resolveMergedStyle`(shared)과 token 해소기 `resolveToken`(specs)을 **둘 다 접근 가능한
 *   곳은 shared** 다 — specs 에 두면 resolveMergedStyle 재사용 불가(역방향). 따라서 본 어댑터는
 *   `toReactStyle` 과 같은 `shared/catalog/outputs/` 에 두고 specs 의 `resolveToken` 을 import 한다.
 *
 * **merged map 범위 (1A scope)**: base = `ComponentRuleSize`(size 시각값 — fontSize/
 *   borderRadius/borderWidth/height/lineHeight/iconSize) + override = `props.style`. **variant
 *   색상은 제외** — 색은 1A-(a) 에서 DOM=generated CSS / Skia=runtime `visual`(caller 가
 *   `resolveComponentRule` 에서 주입)이 same-source 로 처리 완료(`resolveMergedStyle` 의 base 에
 *   미포함, `MergedStyle` 주석 참조). 색의 단일 어댑터 흡수는 단계 5(VisualRule seam 제거).
 *
 * **소비처 (1B wiring)**: `buildCatalogShapes`(specs) 와 `skiaPrimitives` 가 현재 산재
 *   13키 `style?.X ?? base` ad-hoc 병합으로 읽는 것을, 본 어댑터의 merged map 소비로 수렴한다
 *   (buildCatalogShapes 삭제 아님 — 입력을 merged map 으로 정리). builder `buildSpecNodeData`
 *   dispatch wiring 은 1B 범위 — 본 단계(1A-(c))는 어댑터 신설 + 단위 G-adapter 증명까지.
 */
import { resolveToken } from "@composition/specs";
import { resolveMergedStyle } from "../resolvers/resolveMergedStyle";
/**
 * TokenRef(`{category.name}`) 문자열 판정. resolveToken 호출 대상만 해소하고 그 외(숫자/
 * 이미 구체값 문자열)는 그대로 통과시키기 위한 가드.
 */
function isTokenRef(value) {
    return typeof value === "string" && /^\{(\w+)\.(.+)\}$/.test(value);
}
/**
 * 노드 → token-해소된 merged style map (base ⊕ override).
 *
 * `resolveMergedStyle(node)` 으로 base/override 를 분리(DOM `toReactStyle` 과 같은 코어)한 뒤,
 * `{ ...base, ...override }` 로 병합(override 키가 base 를 덮음)하고, TokenRef 값을
 * `resolveToken` 으로 해소한다. override 가 비고 base 도 없으면(컨테이너 shell 등) 빈 객체.
 *
 * @param node base = theme rule size, override = props.style.
 * @param theme color TokenRef 해소용 (light/dark). 기본 light.
 * @returns Skia shape 가 소비할 구체값 style map (TokenRef 0).
 */
export function toSkiaStyle(node, theme = "light") {
    const { base, override } = resolveMergedStyle(node);
    // base(ComponentRuleSize) ⊕ override(props.style) — override 키가 base 를 덮는다.
    const merged = { ...base, ...override };
    // TokenRef 값만 구체값으로 해소. 숫자/이미 구체값 문자열은 통과.
    const resolved = {};
    for (const key of Object.keys(merged)) {
        const value = merged[key];
        resolved[key] = isTokenRef(value) ? resolveToken(value, theme) : value;
    }
    return resolved;
}
//# sourceMappingURL=toSkiaStyle.js.map