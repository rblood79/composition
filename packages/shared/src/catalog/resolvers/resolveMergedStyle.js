/**
 * ADR-912 1A-(b) — base/override 2층 분리 코어 (HC#3).
 *
 * 컴포넌트 노드의 시각값을 **base(theme rule) + override(props.style) 2층**으로 분리한다.
 * base/override schema 의 단일 진실 — 두 backend(DOM `toReactStyle` / Skia `toSkiaStyle`)가
 * 같은 분리 구조를 소비한다.
 *
 * **1A-(b) scope (token 미해소 통과)**: 본 함수는 base 시각값을 정본 table(`resolveComponentRule`)
 *   에서 `ComponentRuleSize` 형태 그대로 꺼낸다 — TokenRef(`{typography.text-xs}`) 문자열을
 *   **해소하지 않고 통과**시킨다. 실제 token→값 해소(`resolveToken`)는 specs 패키지 전용이라
 *   shared 경계(`specs ← shared`)상 여기서 호출 불가. token 해소를 포함한 완결 병합은
 *   1A-(c) Skia 어댑터(specs 측)에서 base⊕override 를 resolveToken 으로 해소해 수행한다.
 *   DOM `toReactStyle` 은 override 전용(사용자가 이미 구체값 입력)이라 token 해소 불필요.
 *
 * **패키지 경계**: `resolveComponentRule` (shared 내부 자급) 만 사용 → specs import 0.
 */
import { resolveComponentRule } from "./resolveComponentRule";
/** node.props.style 을 Record 로 안전 추출 (object 가 아니면 빈 객체). */
function readStyleOverride(node) {
    const style = node.props?.style;
    if (style && typeof style === "object" && !Array.isArray(style)) {
        return style;
    }
    return {};
}
/** node.props.size 를 string 으로 추출 (없으면 undefined → rule.defaultSize fallback). */
function readSize(node) {
    const size = node.props?.size;
    return typeof size === "string" ? size : undefined;
}
/**
 * 노드 → base(theme rule size) / override(props.style) 분리.
 *
 * base 는 정본 table 에서 `node.props.size`(없으면 `rule.defaultSize`) 의 `ComponentRuleSize`.
 * rule 미등록(컨테이너 shell 등) 또는 size 미존재면 base = undefined → merged 는 override 만.
 */
export function resolveMergedStyle(node, doc) {
    const override = readStyleOverride(node);
    const rule = resolveComponentRule(node.type, doc);
    if (!rule)
        return { base: undefined, override };
    const size = readSize(node) ?? rule.defaultSize;
    const base = size != null ? rule.sizes[size] : undefined;
    return { base, override };
}
//# sourceMappingURL=resolveMergedStyle.js.map