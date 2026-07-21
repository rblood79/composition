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
import { getTextLineHeight } from "../../primitives/typography";

/**
 * ADR-078 Phase 3: ListBox/ListBoxItem metric 단일 소스 resolver.
 *
 * ListBoxItem escape(listbox_item) / layout `calculateContentHeight` ListBox 분기 /
 * 부모 ListBox spacing metric 이 동일 공식을 사용하도록 공급. fontSize → lineHeight 는
 * `getTextLineHeight`(= `ceil(fontSize*1.5)`) 단일 소스 — label/description 은 **Text** leaf 로
 * authoring 되므로 origin(실 Text 자식, leaf Text 레이아웃 = 1.5×fs)·CSS(line-height 1.5)와 동일
 * 모델이어야 한다. **Why (2026-07-21 사용자 보고 2건)**: (1) 과거 계단 매핑(>16→28 cap)은 2xl+
 * 를 전부 28 로 눌러 size 를 키워도 행 높이가 안 커졌다. (2) 그 후 `getLabelLineHeight`(typography
 * 토큰: 3xl→36)로 바꿨으나 이는 standalone **Label**(LABEL_SIZE_STYLE)용이라 collection **Text**
 * label 에는 여전히 origin/CSS(3xl→45)와 어긋나 instance 행만 짧게 렌더됐다. Text line box =
 * 1.5×fs 로 3경로(origin·instance·CSS) 통일.
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
  // Text leaf line box(1.5×fontSize) — origin 실 Text 자식·CSS(line-height 1.5)와 동일 모델.
  //   getLabelLineHeight(typography 토큰: 3xl→36)를 쓰면 instance 만 짧게 렌더돼 3경로 불일치.
  const lineHeight = getTextLineHeight(fontSize);
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
  /**
   * description 줄의 line-height — label 과 다른 size(예: label 3xl / description 2xl)를
   * 지원. 미지정 시 `lineHeight`(label) 과 동일(BC — description 이 label 과 같은 size 인 경우).
   */
  descriptionLineHeight?: number;
  rowGap: number;
  paddingTop: number;
  paddingBottom: number;
  hasDescription: boolean;
  minHeight?: number;
}): number {
  const descriptionLineHeight = input.descriptionLineHeight ?? input.lineHeight;
  const contentHeight = input.hasDescription
    ? input.lineHeight + input.rowGap + descriptionLineHeight
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

/**
 * ListBox 컨테이너 spacing + item/header metric.
 *
 * **ADR-912 ListBox spec 삭제 (2026-06-17)**: 본 resolver 는 ListBox.spec.ts 에서 이관됐다
 * (resolveGridListSpacingMetric 동형 선례). `render.shapes`(Skia)는 catalog rule + collection
 * shell 로 이미 전환됐고, 부모 ListBox 의 layout `calculateContentHeight` ListBox 분기(builder
 * `utils.ts`)는 본 resolver 를 직접 소비한다. spec body(ComponentSpec 객체) 삭제와 무관하게
 * 보존되어야 하므로 본 모듈로 분리한다. `resolveListBoxItemMetric`(동일 모듈) 위에
 * ListBox-specific 확장(itemPaddingX / itemHeight / headerHeight / sectionTopPad)을 합성.
 *
 * 호출자:
 *  - Layout: `apps/builder/.../engines/utils.ts` `calculateContentHeight` ListBox 분기
 */
export interface ListBoxSpacingMetric {
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  rowGap: number;
  columnGap: number;
  borderWidth: number;
  fontSize: number;
  itemPaddingX: number;
  itemHeight: number;
  /** description(label+desc) 행 높이 — render.shapes 와 정합. 잘림 방지용. */
  itemHeightWithDescription: number;
  headerHeight: number;
  headerFontSize: number;
  sectionTopPad: number;
}

export interface ListBoxSpacingInput {
  /** element.props.style — padding/gap/borderWidth/fontSize 우선 소스 */
  style?: Record<string, unknown>;
  /** style.gap/rowGap 미지정 시 기본 rowGap (= item 수직 간격). 기본 2 */
  defaultGap?: number;
  /** style.fontSize 미지정 시 기본 fontSize (TokenRef 는 caller 가 resolveSpecFontSize 로 해소). 기본 14 */
  defaultFontSize?: number;
  /** style.padding* 미지정 시 기본 좌우 padding. 기본 4 */
  defaultPaddingX?: number;
  /** style.padding* 미지정 시 기본 상하 padding. 기본 4 */
  defaultPaddingY?: number;
}

export function resolveListBoxSpacingMetric(
  input: ListBoxSpacingInput,
): ListBoxSpacingMetric {
  const defaultPaddingX = input.defaultPaddingX ?? 4;
  const defaultPaddingY = input.defaultPaddingY ?? 4;
  const base = resolveContainerSpacing({
    style: input.style,
    defaults: {
      paddingTop: defaultPaddingY,
      paddingRight: defaultPaddingX,
      paddingBottom: defaultPaddingY,
      paddingLeft: defaultPaddingX,
      rowGap: input.defaultGap ?? 2,
      columnGap: input.defaultGap ?? 2,
      borderWidth: 1,
      fontSize: input.defaultFontSize ?? 14,
    },
  });
  const itemMetric = resolveListBoxItemMetric(base.fontSize);
  return {
    ...base,
    itemPaddingX: itemMetric.paddingX,
    itemHeight: itemMetric.itemHeight,
    itemHeightWithDescription: itemMetric.itemHeightWithDescription,
    headerHeight: Math.round(base.fontSize * 1.75),
    headerFontSize: Math.round(base.fontSize * 0.85),
    sectionTopPad: Math.round(base.fontSize * 0.5),
  };
}
