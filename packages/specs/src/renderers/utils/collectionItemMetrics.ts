/**
 * Collection item metric resolvers — ListBoxItem / GridListItem.
 *
 * **ADR-912 collection sub-part cutover (2026-06-14)**: ListBoxItem.spec / GridListItem.spec 의
 * `render.shapes`(Skia 시각)는 catalog rule + `listbox_item`/`gridlist_card` skiaPrimitive escape 로
 * 이전됐다. 그러나 layout intrinsic height 계산(builder `utils.ts`)과 부모 spec(ListBox/GridList)의
 * spacing metric 은 여전히 item 의 padding/lineHeight/gap 공식을 공유 소비한다. 이 metric resolver
 * 들은 spec body(ComponentSpec 객체) 삭제와 무관하게 **보존**되어야 하므로 본 모듈로 분리한다.
 *
 * **패키지 경계**: layout resolver(builder)와 부모 spec(specs)이 모두 호출하므로 specs 내부에 둔다.
 * catalog rule(shared/catalog)은 같은 metric 값을 Skia 그리기용으로 보유하나(이미 spec.sizes 값을
 * 복사), specs → shared 역방향 import 는 금지이므로 본 모듈은 rule 을 참조하지 않고 상수로 유지한다.
 * rule(Skia 그리기) ↔ 본 resolver(layout 높이)가 같은 값을 갖는 것이 D3 대칭의 조건.
 *
 * @packageDocumentation
 */

import { resolveContainerSpacing } from "../../primitives/containerSpacing";

/**
 * ADR-078 Phase 3: ListBox/ListBoxItem metric 단일 소스 resolver.
 *
 * ListBoxItem escape(listbox_item) / layout `calculateContentHeight` ListBox 분기 /
 * 부모 ListBox spacing metric 이 동일 공식을 사용하도록 공급. fontSize → lineHeight 매핑
 * (CSS `var(--text-{size}--line-height)` 기본값): xs(≤12)→16 / sm(≤14)→20 / base(≤16)→24 / lg(>16)→28.
 *
 * 기본값(paddingX 12 / paddingY 4 / gap 2)은 componentRulesTable.ListBoxItem.sizes.md 와 동일.
 */
export function resolveListBoxItemMetric(fontSize: number): {
  paddingX: number;
  paddingY: number;
  lineHeight: number;
  /** label↔description 수직 간격. escape rowGap 기본값. */
  gap: number;
  /** `paddingY * 2 + lineHeight` — Skia/layout 양쪽이 동일 공식으로 소비하는 item height. */
  itemHeight: number;
  /**
   * `paddingY * 2 + lineHeight + gap + lineHeight` — description(label+desc) 행 높이.
   * ListBox 컨테이너가 description 항목을 잘리지 않게 수용하는 단일 공식.
   */
  itemHeightWithDescription: number;
} {
  // componentRulesTable.ListBoxItem.sizes.md 정합 (paddingX 12 / paddingY 4 / gap 2).
  const paddingX = 12;
  const paddingY = 4;
  const gap = 2;
  const lineHeight =
    fontSize <= 12 ? 16 : fontSize <= 14 ? 20 : fontSize <= 16 ? 24 : 28;
  return {
    paddingX,
    paddingY,
    lineHeight,
    gap,
    itemHeight: paddingY * 2 + lineHeight,
    itemHeightWithDescription: paddingY * 2 + lineHeight + gap + lineHeight,
  };
}

/**
 * ADR-147 Layer D (§2.6): ListBoxItem padding-box 행 높이 단일 공식.
 * escape(listbox_item rowHeight 기본값) 와 layout `calculateContentHeight` listboxitem 분기가
 * 동일 심볼을 호출하도록 보장 — per-element override(padding/rowGap/minHeight)를 보존하면서 공식
 * 중복(drift) 차단.
 */
export function resolveListBoxItemRowHeight(input: {
  lineHeight: number;
  rowGap: number;
  paddingTop: number;
  paddingBottom: number;
  hasDescription: boolean;
  minHeight?: number;
}): number {
  const contentHeight = input.hasDescription
    ? input.lineHeight + input.rowGap + input.lineHeight
    : input.lineHeight;
  return Math.max(
    input.paddingTop + input.paddingBottom + contentHeight,
    input.minHeight ?? 20,
  );
}

/**
 * ADR-090 Phase 2: GridListItem card metric 단일 소스 resolver.
 *
 * GridListItem escape(gridlist_card) / 부모 GridList spacing metric(resolveGridListSpacingMetric)이
 * 카드 시각 생성 시 본 resolver 를 소비. fontSize-based 분기(>14: 20/16/12/6, >12: 16/12/8/4,
 * ≤12: 12/10/8/4)를 내부 캡슐화.
 *
 * 기본값(fontSize=14 기준: paddingX 16 / paddingY 12 / borderRadius 8 / descGap 4)은
 * componentRulesTable.GridListItem.sizes.md 와 동일.
 */
export function resolveGridListItemMetric(fontSize: number): {
  cardPaddingX: number;
  cardPaddingY: number;
  cardBorderRadius: number;
  descGap: number;
} {
  // fontSize>14: large 카드 (20/16/12/6)
  if (fontSize > 14) {
    return {
      cardPaddingX: 20,
      cardPaddingY: 16,
      cardBorderRadius: 12,
      descGap: 6,
    };
  }
  // fontSize>12: medium 카드 (16/12/8/4) — rule sizes.md 기본값 매칭
  if (fontSize > 12) {
    return {
      cardPaddingX: 16,
      cardPaddingY: 12,
      cardBorderRadius: 8,
      descGap: 4,
    };
  }
  // fontSize≤12: small 카드 (12/10/8/4)
  return {
    cardPaddingX: 12,
    cardPaddingY: 10,
    cardBorderRadius: 8,
    descGap: 4,
  };
}

/**
 * ADR-907 Layer D: GridList 컨테이너 spacing metric 단일 소스 resolver.
 *
 * **ADR-912 GridList spec 삭제 (2026-06-17)**: 본 resolver 는 GridList.spec.ts 에서 이관됐다.
 * `render.shapes`(Skia)는 catalog rule + `gridlist_card` skiaPrimitive escape 로 이미 전환됐고,
 * 부모 GridList 의 layout `calculateContentHeight` GridList 분기(builder `utils.ts`)는 본 resolver 를
 * 직접 소비한다. spec body(ComponentSpec 객체) 삭제와 무관하게 보존되어야 하므로 본 모듈로 분리한다.
 *
 * 호출자:
 *  - Layout: `apps/builder/.../engines/utils.ts` `calculateContentHeight` GridList 분기
 *  - Preview: 별도 진입 없음 (DOM/CSS 가 직접 style 소비)
 */
export interface GridListSpacingMetric {
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  rowGap: number;
  columnGap: number;
  borderWidth: number;
  fontSize: number;
  numCols: number;
  cardPaddingX: number;
  cardPaddingY: number;
  cardBorderRadius: number;
  descGap: number;
}

export interface GridListSpacingInput {
  /** element.props.style — padding/gap/borderWidth/fontSize 우선 소스 */
  style?: Record<string, unknown>;
  /** "stack" | "grid". stack 은 numCols=1 강제, grid 는 columns 사용 */
  layout?: "stack" | "grid";
  /** grid 모드에서만 사용. 1 미만은 1 로 clamp */
  columns?: number;
  /** style.gap 미지정 시 기본 row/columnGap. 기본 12 */
  defaultGap?: number;
  /** style.fontSize 미지정 시 기본 fontSize. 기본 14 */
  defaultFontSize?: number;
}

export function resolveGridListSpacingMetric(
  input: GridListSpacingInput,
): GridListSpacingMetric {
  const base = resolveContainerSpacing({
    style: input.style,
    defaults: {
      rowGap: input.defaultGap ?? 12,
      columnGap: input.defaultGap ?? 12,
      fontSize: input.defaultFontSize ?? 14,
    },
  });
  const numCols = input.layout === "grid" ? Math.max(1, input.columns ?? 2) : 1;
  const itemMetric = resolveGridListItemMetric(base.fontSize);
  return {
    ...base,
    numCols,
    cardPaddingX: itemMetric.cardPaddingX,
    cardPaddingY: itemMetric.cardPaddingY,
    cardBorderRadius: itemMetric.cardBorderRadius,
    descGap: itemMetric.descGap,
  };
}
