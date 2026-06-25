/**
 * ADR-912 1A-(b) — DOM 시각 override 어댑터 (override 전용, HC#3).
 *
 * 노드의 시각 override(`props.style`)를 DOM 인라인 style 로 투영한다.
 *
 * **override 전용 (1A-(b) 결정)**: DOM 의 base 시각값(variant 색/size 시각)은 build-time
 *   generated CSS(`react-aria-{Type}[data-variant][data-size]` selector)가 적용한다 — 런타임
 *   인라인 색/size 주입이 아니다(ADR-912 1A 실측, breakdown §2-6 DOM/Skia 비대칭). 따라서 본
 *   어댑터는 base 를 만지지 않고 `props.style` 의 사용자 편집값만 `React.CSSProperties` 호환
 *   객체로 통과시킨다 — RAC 정통(unstyled primitive + theme generated CSS) + override layer.
 *
 * **닫는 seam**: `CanonicalNodeRenderer` 의 catalog generic(cutover) 경로는 `toRacProps` 만
 *   spread 하고 `style` 을 누락해 — Button 등 cutover primitive 에서 props.style override 가
 *   DOM Preview 에 반영되지 않았다. 본 어댑터를 그 경로에 주입해 override 상실을 닫는다.
 *
 * **반환 타입**: shared 는 React 타입 의존을 outputs(순수 데이터 변환)에 두지 않는다 — `toRacProps`
 *   와 동일하게 `Record<string, unknown> | undefined` 를 반환하고, 소비처(.tsx)에서
 *   `as React.CSSProperties` 캐스팅한다(`CanonicalNodeRenderer.tsx:255` 기존 패턴과 동형).
 *
 * **base⊕override 완결 병합은 1A-(c)**: token 해소(`resolveToken`, specs 전용)를 포함한 base⊕
 *   override 병합은 Skia 어댑터(`toSkiaStyle`)에서 수행한다(DOM 은 base 를 CSS 가 담당해 불요).
 */
import type { CanonicalNode } from "../../types/composition-document.types";
import type { ResolvedNode } from "../../types/canonical-resolver.types";
/**
 * 노드 → DOM 인라인 style (override 전용).
 *
 * `resolveMergedStyle(node).override` 만 투영 — base 는 generated CSS 가 적용하므로 제외.
 * override 가 비어 있으면 `undefined` (불필요한 빈 `style={}` 회피).
 *
 * @returns `React.CSSProperties` 호환 객체 또는 undefined. 소비처에서 `as React.CSSProperties` 캐스팅.
 */
export declare function toReactStyle(node: CanonicalNode | ResolvedNode): Record<string, unknown> | undefined;
//# sourceMappingURL=toReactStyle.d.ts.map