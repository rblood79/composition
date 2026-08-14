/**
 * DOM Preview 의 spec-backed 판정 catalog-aware 보강 (ADR-912 선행-6, 2026-06-04).
 *
 * **배경 (Label slice 실측)**: Preview generic 렌더 경로(CanonicalNodeRenderer / App.tsx)는
 *   `react-aria-{Type}` className + `data-size` 주입 여부를 `hasSpec(type)`(= `type in
 *   TAG_SPEC_MAP`) 로 판정해 왔다. 이 className/data-attr 가 있어야 컴포넌트 CSS
 *   (generated 또는 수동 `.react-aria-Label` 등) selector 가 매칭되어 size/variant 시각이
 *   반영된다.
 *
 * **문제**: TEXT_LEAF(Text/Heading/Paragraph/Code/Kbd) + Label 을 catalog 등록(ADR-912 위험군
 *   해소)해도, DOM 판정이 여전히 `hasSpec`(spec 의존)이라 step 4(spec 파일 삭제) 시
 *   `hasSpec=false` → className/data-size 소실 → Preview 폰트/크기 고정. 즉 catalog 등록만으로는
 *   step 4 차단 게이트가 안 닫혔다(Skia 만 해소, DOM 미해소).
 *
 * **해소**: catalog 등록 type(`isCatalogCutover`)도 spec-backed 로 간주. spec 삭제 후에도
 *   className/data-size 가 catalog 기준으로 유지된다. defaultSize 는 spec(getDefaultSizeForTag)
 *   부재 시 theme rule(`resolveComponentRule(type).defaultSize`)에서 fallback.
 *
 * **패키지 경계**: `hasSpec`/`getDefaultSizeForTag`(@composition/specs) + `isCatalogCutover`/
 *   `resolveComponentRule`(@composition/shared) 합성은 builder 레이어에서만 가능
 *   (specs ← shared ← builder, specs 가 shared 를 import 못 함). 두 Preview 호출부
 *   (CanonicalNodeRenderer / App.tsx)가 본 헬퍼를 공유.
 */
import { isCatalogCutover, resolveComponentRule } from "@composition/shared";
import { hasSpec, getDefaultSizeForTag } from "@composition/specs";

/**
 * Preview 가 `react-aria-{Type}` className + data-size/variant 를 주입할 spec-backed 판정.
 * spec(TAG_SPEC_MAP) 또는 catalog 등록(isCatalogCutover) type 이면 true.
 * **Why catalog 포함**: catalog 등록 leaf 가 step 4 spec 삭제 후에도 컴포넌트 CSS selector
 *   매칭을 유지하려면 className/data-attr 주입이 필요(Label 은 수동 Label.css 의존이라 특히 필수).
 */
export function isSpecOrCatalogBacked(type: string): boolean {
  return hasSpec(type) || isCatalogCutover(type);
}

/**
 * spec-backed 또는 catalog-backed type 의 defaultSize.
 * spec(getDefaultSizeForTag) 우선, 부재 시 theme rule(resolveComponentRule.defaultSize) fallback.
 * 둘 다 없으면 undefined (caller 가 "md" 등 최종 fallback 적용).
 */
export function resolveBackedDefaultSize(type: string): string | undefined {
  return (
    getDefaultSizeForTag(type) ??
    (resolveComponentRule(type)?.defaultSize as string | undefined)
  );
}

/**
 * generic Preview 렌더 경로의 `.button-base` utility 클래스 부여 판정.
 *
 * **배경 (ADR-913 slice 1, 2026-06-18)**: `cssEmitMode: "button-base"` 컴포넌트 CSS 는
 *   `--button-color` 변수만 emit 하고 `background: var(--button-color)` 는 `utilities.css
 *   .button-base` 에 위임한다 — DOM 요소가 `react-aria-{Type} button-base` 2 클래스를 모두
 *   가져야 배경이 칠해진다. shared 컴포넌트는 publish 경로에서 이 짝을 붙이지만 빌더 Preview
 *   의 generic 렌더(CanonicalNodeRenderer)는 누락했었다 (사용자 보고 "primary 회색").
 *   (Menu 의 트리거 Button 은 `rendererMap` MenuButton 으로 위임돼 shared 가 button-base 부여 —
 *   generic 경로 대상 아님.)
 *
 * 구 로컬 `BUTTON_BASE_TYPES` Set(손 미러, "동시 갱신" 주석 의존)은 catalog
 * `structure.cssEmitMode`/`structure.buttonBase` 파생의 shared `usesButtonBaseUtility` 로
 * 대체됨 (2026-08-14) — membership 선언은 `componentRulesTable.ts` 1곳.
 */
export { usesButtonBaseUtility } from "@composition/shared";
