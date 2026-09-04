/**
 * ADR-923 Phase 5 후속 (2026-09-04) — `fullTreeLayout` 3.6 (implicit child style → batch 패치) 이
 * 쓰는 sub-part 자식의 delta 기준 판정.
 *
 * 이력: 처음에는 3.6 의 fit-content 폭 재측정 판정 3개 (재측정 대상 여부 · 재측정 텍스트 · propagation 을
 * 얹은 입력) 도 여기 있었다. 착수 5 재확인 (같은 날) 에서 그 재측정의 폭 write 가 어느 경로에서도 최종
 * rect 에 닿지 않는 dead 경로로 확정돼 (1px 변이 → parity 1110 · unit 482 · live 무반응) 3.6 블록과
 * 함께 삭제했다 — evidence/923-phase5-followup-fitcontent-remeasure-text-source.md §8.
 */
import type { CanvasLayoutNode } from "../layoutNode";
import { projectReadOnlySubpart, type ElementLookup } from "./readOnlySubpart";

export interface SubpartAwareImplicitStyles {
  /** delta 기준 style — sub-part 면 투영값, 아니면 store 인라인. */
  origStyle: Record<string, unknown>;
  /** batch 에 패치할 style — sub-part 면 implicit 이 추가·변경한 키만. */
  modStyle: Record<string, unknown>;
  isSubpartChild: boolean;
}

/**
 * read-only sub-part (2026-09-03 판정 A) 는 자식 인라인이 DOM 에 닿을 채널이 없다. implicitStyles 는
 * 자식 style 을 `{...cs, 주입}` 으로 복사하므로 그 인라인 (DOM 미도달 junk) 이 modStyle 에 그대로
 * 실린다 — 자식 visit 에서 걷어낸 인라인이 3.6 에서 되살아나지 않도록 **implicit 이 추가·변경한 키만**
 * 남긴다. 기준은 raw 인라인이 아니라 투영값이라, factory `width:fit-content` 에 걸리는 폭 재측정도
 * 같이 건너뛴다 (투영 style 에는 width 키워드가 없다).
 */
export function resolveSubpartAwareImplicitStyles(
  originalEl: CanvasLayoutNode,
  modifiedChild: CanvasLayoutNode,
  elementsMap: ElementLookup,
): SubpartAwareImplicitStyles {
  const projectedOriginal = projectReadOnlySubpart(originalEl, elementsMap);
  const isSubpartChild = projectedOriginal !== originalEl;
  const origStyle = (projectedOriginal.props?.style ?? {}) as Record<
    string,
    unknown
  >;
  const full = (modifiedChild.props?.style ?? {}) as Record<string, unknown>;
  if (!isSubpartChild) return { origStyle, modStyle: full, isSubpartChild };
  const modStyle: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(full)) {
    if (v !== origStyle[k]) modStyle[k] = v;
  }
  return { origStyle, modStyle, isSubpartChild };
}
