/**
 * Builder 의 cascade layer 순서 — 정본은 `src/index.css` 첫 `@layer …;` 선언이다.
 *
 * 레이어 순서는 문서에서 그 이름이 처음 나온 때 정해진다. production 빌드는 공용 CSS chunk
 * (LoadingSpinner · overlay · EmptyState · AIPanel …) 를 main CSS 보다 먼저 <link> 하고, 그 chunk
 * 에 `@layer builder-system{…}` · `@layer components{…}` 가 있어 두 레이어가 먼저 등록됐다 — index.css
 * 의 선언이 늦게 와 base (Tailwind 리셋) 가 builder-system 을 이기고 패널 · 툴바의 margin · padding ·
 * 크기가 0 이 됐다 (2026-10-16 dev ↔ prod 계산 스타일 140 요소 차이). dev 는 index.css 가 먼저라
 * 드러나지 않았다. 그래서 빌더 index.html 의 head 맨 앞에 같은 선언을 인라인으로 둔다.
 */
export function readCascadeLayerOrder(indexCss: string): string {
  const statement = /@layer\s+[\w-]+(?:\s*,\s*[\w-]+)+\s*;/.exec(indexCss)?.[0];
  if (!statement)
    throw new Error("index.css 에 @layer 순서 선언 (`@layer a, b, …;`) 이 없다");
  return statement;
}

export function cascadeLayerOrderTag(indexCss: string) {
  return {
    tag: "style",
    attrs: { "data-cascade-layer-order": "" },
    children: readCascadeLayerOrder(indexCss),
    injectTo: "head-prepend" as const,
  };
}
