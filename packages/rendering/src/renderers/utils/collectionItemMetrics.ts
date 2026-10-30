/**
 * Collection item metric resolvers — ListBoxItem / GridListItem.
 *
 * **ADR-912 collection sub-part cutover (2026-06-14)**: ListBoxItem.spec / GridListItem.spec 의
 * `render.shapes`(Skia 시각)는 catalog rule + `listbox_item`/`gridlist_card` skiaPrimitive escape 로
 * 이전됐다. 그러나 layout intrinsic height 계산(builder `utils.ts`)과 부모 spec(ListBox/GridList)의
 * spacing metric 은 여전히 item 의 padding/lineHeight/gap 공식을 공유 소비한다. 이 metric resolver
 * 들은 spec body(ComponentSpec 객체) 삭제와 무관하게 **보존**되어야 하므로 본 모듈로 분리한다.
 *
 * **패키지 경계**: rendering → shared 역방향 import 는 금지 (shared 가 rendering 을 의존) 라 본 모듈은
 * rule 을 읽지 못한다. 그래서 rule 값 (padding · gap · radius …) 은 호출자 — `skiaPrimitives.ts` 의
 * `gridlist_card` · `listbox_item` 이 rule `sizes` 에서 받아 인자로 넘기고, 본 모듈은 **공식만** 둔다
 * (`resolveCollectionRowMetric` · `resolveListBoxItemInset`).
 *
 * **ADR-295 Phase 3d (2026-10-30)**: production 소비처는 `skiaPrimitives.ts` 하나다 (옛 layout
 * `calculateContentHeight` · 부모 spec 은 삭제됐다). `resolveListBoxSpacingMetric` ·
 * `resolveGridListSpacingMetric` 과 그 안의 item 상수 (`resolveListBoxItemMetric` ·
 * `resolveGridListItemMetric`) 는 자기 단위 테스트 밖 소비처가 0 이고, 값이 이미 rule 과 갈렸다
 * (ListBoxItem paddingY 4 ↔ rule 7 · GridListItem padding 16·12 / radius 8 / border 1 ↔ rule 12·8 /
 * none / none). 화면에 쓰이지 않는 사본이다 — 새 소비처를 만들지 말고 rule 을 읽는다.
 *
 * @packageDocumentation
 */

import { resolveContainerSpacing } from "../../primitives/containerSpacing";
import {
  getTextLineHeight,
  getDescriptionLineHeight,
} from "../../primitives/typography";
import { measureSpecWrappedTextHeight } from "./measureText";

/**
 * ADR-078 Phase 3: ListBox/ListBoxItem metric 단일 소스 resolver.
 *
 * 부모 ListBox spacing metric (`resolveListBoxSpacingMetric`) 이 소비 (옛 escape · layout
 * `calculateContentHeight` 소비처는 삭제됐다). fontSize → lineHeight 는
 * `getTextLineHeight`(= `ceil(fontSize*1.5)`) 단일 소스 — label/description 은 **Text** leaf 로
 * authoring 되므로 origin(실 Text 자식, leaf Text 레이아웃 = 1.5×fs)·CSS(line-height 1.5)와 동일
 * 모델이어야 한다. **Why (2026-07-21 사용자 보고 2건)**: (1) 과거 계단 매핑(>16→28 cap)은 2xl+
 * 를 전부 28 로 눌러 size 를 키워도 행 높이가 안 커졌다. (2) 그 후 `getLabelLineHeight`(typography
 * 토큰: 3xl→36)로 바꿨으나 이는 standalone **Label**(LABEL_SIZE_STYLE)용이라 collection **Text**
 * label 에는 여전히 origin/CSS(3xl→45)와 어긋나 instance 행만 짧게 렌더됐다. Text line box =
 * 1.5×fs 로 3경로(origin·instance·CSS) 통일.
 *
 * 값 (paddingX 12 / paddingY 4 / gap 2) 은 rule 의 옛 사본이다 — ADR-295 Phase 3c-2 뒤 rule
 * `ListBoxItem.sizes.M.paddingY` 는 7 이다. 소비처는 `resolveListBoxSpacingMetric` (테스트 전용) 뿐이라
 * 화면에 닿지 않는다 (위 머리말).
 *
 * **2026-07-22 라이브 실측 정합**: label 은 react-aria-Text 기본 16 (item/container fontSize
 * 미상속 — preview iframe 실측: item fontSize 14 여도 label 16/24) → getTextLineHeight(16)=24.
 * description 은 CSS `[slot=description]` line-height 1.333× (getDescriptionLineHeight) 로 12→16
 * (label 1.5× 와 대조). 따라서 itemHeight = 4*2 + 24 = 32, itemHeightWithDescription =
 * 4*2 + 24 + 2 + 16 = 50. `fontSize` 인자는 container fontSize 로 label/desc line box 를 결정하지
 * 않으므로(비상속) item height 산출에 미사용.
 */
function resolveListBoxItemMetric(_fontSize: number): {
  paddingX: number;
  paddingY: number;
  lineHeight: number;
  /** label↔description 수직 간격. escape rowGap 기본값. */
  gap: number;
  /** `paddingY * 2 + label line box` — Skia/layout 양쪽이 동일 공식으로 소비하는 item height. */
  itemHeight: number;
  /**
   * `paddingY * 2 + label(24) + gap + desc(16)` — description(label+desc) 행 높이.
   * ListBox 컨테이너가 description 항목을 잘리지 않게 수용하는 단일 공식.
   */
  itemHeightWithDescription: number;
} {
  // 옛 rule 사본 (rule 은 지금 paddingY 7 — 함수 머리말).
  const paddingX = 12;
  const paddingY = 4;
  const gap = 2;
  // label: react-aria-Text 기본 16 → getTextLineHeight(16)=24 (1.5×, slot CSS override 없음).
  const labelLineHeight = getTextLineHeight(COLLECTION_TEXT_DEFAULT_FONT_SIZE);
  // description: CSS [slot=description] line-height 1.333× → 12→16 (label 1.5× 와 별도 비율).
  const descriptionLineHeight = getDescriptionLineHeight(12);
  return {
    paddingX,
    paddingY,
    lineHeight: labelLineHeight,
    gap,
    itemHeight: paddingY * 2 + labelLineHeight,
    itemHeightWithDescription:
      paddingY * 2 + labelLineHeight + gap + descriptionLineHeight,
  };
}

/** 행/카드 수직 스택의 블록 역할. */
export type CollectionRowSlotRole = "label" | "description";

/**
 * ADR-160: collection projection 행(ListBoxItem / GridListItem) 텍스트 측정 SSOT.
 *
 * layout(M1, `utils.ts`)·escape(M3, `skiaPrimitives.ts`)·`buildSpecNodeData` 가 **동일 심볼**로
 * 행 metric(rowHeight + slot 블록 높이·top offset + wrap maxWidth)을 산출하도록 통일한다. 기존엔
 * layout-util 함수와 escape 별도 함수가 폰트/폭/lineHeight/anchoring 을 각자 재현해 icon/check 행에서
 * wrap 폭이 어긋났다(design ADR-160 §2.1 발견 1 — M1 은 `w−padL−padR`, escape 는
 * `w−textX−padR−rightReserve`). 본 함수가 그 통로를 봉쇄한다.
 *
 * **측정 주체 계약**: `containerWidth` 는 확정된 행/카드 폭(px). scene projection 시점의 "100%"/calc
 * 이 아니라 `buildSpecNodeData` width injection(`style.width`, layout 이후) 또는 layout availableWidth
 * 가 확정한 값을 넘겨야 wrap 폭이 정확하다(§2.1 발견 2). 순서상 M1(layout)·buildSpecNodeData 는 본
 * 함수의 **공동 호출자**, escape 는 주입된 결과의 소비자다(측정 호출 수 count-neutral).
 *
 * caller 별 차이는 입력으로 흡수한다:
 *  - **ListBox**: `singleEntryCentered=true`(1줄 세로 중앙), `textX`=paddingLeft+icon 예약,
 *    `rightReserve`=check, description `lineHeight`=1.333×fs. baseline:middle → 텍스트 y=`block.y+lh/2`.
 *  - **GridList**: `singleEntryCentered=false`(항상 top), `textX`=cardPaddingX, `rightReserve`=0,
 *    description `lineHeight`=1.5×fs. top-anchored → 텍스트 y=`block.y`.
 *
 * 본 함수는 블록 wrap 측정·스택 offset·rowHeight 공식만 소유한다(폰트/reserve/lineHeight 는 caller 산출).
 */
export interface CollectionRowMetricEntry {
  role: CollectionRowSlotRole;
  text: string;
  fontSize: number;
  fontWeight: number | string;
  /** 단일 줄 line box(px) — caller 가 typography 규칙으로 산출(LB desc 1.333× / 그 외 1.5×). */
  lineHeight: number;
}

export interface CollectionRowMetricInput {
  /** 확정 행/카드 폭(px). `buildSpecNodeData` style.width 또는 layout availableWidth. */
  containerWidth: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  /** 항목 간 수직 간격(px) — ListBox rowGap / GridList descGap. */
  gap: number;
  /** 최소 행 높이(px). ListBox 20, GridList 미지정(0). */
  minHeight?: number;
  /** `style.height` 명시 override(px). 지정 시 rowHeight 로 그대로 사용. */
  explicitHeight?: number;
  /** 텍스트 좌측 origin(px). ListBox=paddingLeft+icon 예약, GridList=cardPaddingX. */
  textX: number;
  /** 우측 예약(px). ListBox check=checkSize+slotGap, GridList 0. */
  rightReserve?: number;
  fontFamily: string;
  /** 표시 순서대로의 slot(존재하는 것만). label / description. */
  entries: CollectionRowMetricEntry[];
  /** 단일 entry 를 세로 중앙 배치(ListBox true, GridList false). */
  singleEntryCentered?: boolean;
  /** entries 가 비었을 때 contentHeight fallback(보통 label 단일 줄). */
  fallbackLineHeight: number;
}

export interface CollectionRowSlotBlock {
  /** wrap 반영 블록 높이(px). */
  height: number;
  /** 행 좌표계 내 블록 top(px). escape 는 baseline:middle 시 `y + lineHeight/2` 를 텍스트 y 로 쓴다. */
  y: number;
  /** 해당 블록 단일 줄 line box(px) — escape 텍스트 baseline 계산용. */
  lineHeight: number;
}

export interface CollectionRowMetric {
  rowHeight: number;
  /** wrap 측정에 쓴 콘텐츠 폭(px). escape maxWidth 와 동일해야 measure↔paint 정합. */
  maxWidth: number;
  /** 텍스트 좌측 origin(px). */
  textX: number;
  /** 패딩 제외 콘텐츠 높이(px). */
  contentHeight: number;
  /** 존재하는 slot 의 블록 geometry. */
  slotBlocks: Partial<Record<CollectionRowSlotRole, CollectionRowSlotBlock>>;
  /** 표시 순서 slot 목록(입력 순서 보존). */
  order: CollectionRowSlotRole[];
}

export function resolveCollectionRowMetric(
  input: CollectionRowMetricInput,
): CollectionRowMetric {
  const rightReserve = input.rightReserve ?? 0;
  const maxWidth = Math.max(
    1,
    input.containerWidth - input.textX - input.paddingRight - rightReserve,
  );

  // 블록 높이 — wrap 측정(주입 측정기, 미주입/미측정/빈 텍스트 시 단일 줄 fallback = BC).
  const blockHeights = input.entries.map((entry) => {
    if (!entry.text) return entry.lineHeight;
    return (
      measureSpecWrappedTextHeight(
        entry.text,
        entry.fontSize,
        entry.fontWeight,
        input.fontFamily,
        maxWidth,
        entry.lineHeight,
      ) ?? entry.lineHeight
    );
  });

  const contentHeight =
    input.entries.length === 0
      ? input.fallbackLineHeight
      : blockHeights.reduce(
          (sum, h, i) => sum + h + (i > 0 ? input.gap : 0),
          0,
        );

  const rowHeight =
    input.explicitHeight ??
    Math.max(
      input.paddingTop + input.paddingBottom + contentHeight,
      input.minHeight ?? 0,
    );

  const slotBlocks: Partial<
    Record<CollectionRowSlotRole, CollectionRowSlotBlock>
  > = {};
  const order = input.entries.map((e) => e.role);

  if (input.entries.length === 1 && input.singleEntryCentered) {
    // 단일 entry 세로 중앙(ListBox 1줄 계약).
    const e = input.entries[0]!;
    slotBlocks[e.role] = {
      height: blockHeights[0]!,
      y: (rowHeight - blockHeights[0]!) / 2,
      lineHeight: e.lineHeight,
    };
  } else {
    // top-anchored 스택 — 첫 블록 top = paddingTop, 이후 이전 블록·gap 누적.
    let y = input.paddingTop;
    input.entries.forEach((e, i) => {
      slotBlocks[e.role] = {
        height: blockHeights[i]!,
        y,
        lineHeight: e.lineHeight,
      };
      y += blockHeights[i]! + input.gap;
    });
  }

  return {
    rowHeight,
    maxWidth,
    textX: input.textX,
    contentHeight,
    slotBlocks,
    order,
  };
}

/**
 * ADR-160 후속(2026-07-23): ListBoxItem 행의 텍스트 좌우 inset(`textX`/`rightReserve`) 단일 공식.
 *
 * escape(`listbox_item`)·layout(M1 `resolveListBoxItemRowHeightFromStyle`)가 **동일 심볼**로 icon/
 * check 예약을 산출 → `resolveCollectionRowMetric` 에 넘기는 wrap maxWidth
 * (`containerWidth − textX − paddingRight − rightReserve`)가 두 경로에서 일치한다. ADR-160 §2.1
 * 발견 1(M1 은 `w−padL−padR`, escape 는 `w−textX−padR−rightReserve` 로 icon/check 행 wrap 폭이
 * 어긋남)의 **입력 산출** 잔존을 봉쇄하는 helper. geometry 통로(rowHeight/블록 offset)는 이미
 * `resolveCollectionRowMetric` 이 소유하고, 본 helper 는 그 함수의 `textX`/`rightReserve` 입력만
 * 공유한다.
 *
 * 값(`iconSize`/`slotInset`/`hasIcon`/`showCheck`)은 caller 가 각자 컨텍스트에서 산출해 전달한다
 * (escape=ctx.size + slot style, M1=slot 구성 + isSelected). 공식만 단일 소스.
 *
 * - `textX`: icon 있으면 `max(paddingLeft, slotInset + iconSize + slotGap)`(아이콘 glyph 우측 +
 *   간격), 없으면 `paddingLeft`. `max` 는 큰 좌측 padding 이 아이콘 폭을 넘는 경우의 floor.
 * - `rightReserve`: selection check 표시 시 `checkSize + slotGap`(우측 예약), 아니면 0.
 */
export interface ListBoxItemInsetInput {
  /** 콘텐츠 좌측 padding(px) — style.paddingLeft ?? size.paddingX. */
  paddingLeft: number;
  /** 아이콘 x 배치 기준(px) — size.paddingX(대칭 padding). 보통 paddingLeft 과 동일. */
  slotInset: number;
  /** 아이콘 glyph 크기(px) — iconSlotStyle.fontSize ?? size.iconSize ?? 16. */
  iconSize: number;
  /** 아이콘 slot 활성 + 아이콘 존재. */
  hasIcon: boolean;
  /** selection check 예약 여부(isSelected). */
  showCheck: boolean;
  /** check glyph 크기(px). 기본 iconSize(escape 계약). */
  checkSize?: number;
  /** icon↔text / text↔check 간격(px). 기본 6(escape slotGap). */
  slotGap?: number;
}

export interface CollectionRowInset {
  /** 텍스트 좌측 origin(px). */
  textX: number;
  /** 텍스트 우측 예약(px). */
  rightReserve: number;
}

export function resolveListBoxItemInset(
  input: ListBoxItemInsetInput,
): CollectionRowInset {
  const slotGap = input.slotGap ?? 6;
  const checkSize = input.checkSize ?? input.iconSize;
  return {
    textX: input.hasIcon
      ? Math.max(input.paddingLeft, input.slotInset + input.iconSize + slotGap)
      : input.paddingLeft,
    rightReserve: input.showCheck ? checkSize + slotGap : 0,
  };
}

/**
 * collection item(GridListItem/ListBoxItem)의 label/description slot 자식(react-aria-Text)이
 * 명시 size 없이 authoring 될 때의 렌더 font-size(px). react-aria-Text 는 부모 font-size 를
 * 상속하지 않고 이 값으로 고정(라이브 실측: 14px 부모 안에서도 16). GridList 는 `[slot=*]`
 * line-height/font-size override 가 없어 label·description 둘 다 이 값(→ line box 24). ListBox
 * 는 description 만 `--lb-desc-size`(--text-xs=12) override 로 12. 명시 slot size 가 있으면 우선.
 */
export const COLLECTION_TEXT_DEFAULT_FONT_SIZE = 16;

/**
 * ADR-090 Phase 2: GridListItem card metric 단일 소스 resolver.
 *
 * 부모 GridList spacing metric(resolveGridListSpacingMetric)이 소비. fontSize-based 분기
 * (>14: 20/16/12, >12: 16/12/8, ≤12: 12/10/8)를 내부 캡슐화.
 *
 * descGap = label↔description 수직 간격 = GridListItem flex `gap: var(--spacing-2xs)` = **2**
 * (2026-07-22 라이브 실측). 과거 4/6 은 CSS 와 불일치(카드 +2 drift)라 전 size 2 로 통일 —
 * --spacing-2xs 는 size 무관 고정값이므로 분기하지 않는다.
 * 값 (fontSize=14 기준: paddingX 16 / paddingY 12 / borderRadius 8 / borderWidth 1) 은 rule 의 옛
 * 사본이다 — rule `GridListItem.sizes.M` 은 지금 paddingX 12 / paddingY 8 / `{radius.none}` /
 * `{border.width.none}` (2026-10-25 S2 ListView 행). `gridlist_card` 는 padding · radius · gap 을 rule
 * `size` 에서 읽고 (ADR-295 Phase 3d 부터 gap 도), 본 함수의 소비처는 `resolveGridListSpacingMetric`
 * (테스트 전용) 뿐이라 화면에 닿지 않는다 (위 머리말).
 */
function resolveGridListItemMetric(fontSize: number): {
  cardPaddingX: number;
  cardPaddingY: number;
  cardBorderRadius: number;
  cardBorderWidth: number;
  descGap: number;
  selectionBoxSize: number;
} {
  // cardBorderWidth = componentRulesTable.GridListItem.sizes.M.borderWidth(1) — 카드 border-box
  //   높이 산출용(부모 GridList §1.55c). colors.border 로 실제 렌더되는 1px 테두리를 반영해야
  //   컨테이너 높이가 projected 카드(content+padding+border) 와 정합한다(누락 시 카드당 -2px).
  //   border 는 size 무관 고정(catalog 정의 md 단일)이라 분기하지 않는다.
  // fontSize>14: large 카드 (20/16/12)
  if (fontSize > 14) {
    return {
      cardPaddingX: 20,
      cardPaddingY: 16,
      cardBorderRadius: 12,
      cardBorderWidth: 1,
      descGap: 2,
      selectionBoxSize: 20,
    };
  }
  // fontSize>12: medium 카드 (16/12/8) — rule sizes.M 기본값 매칭
  if (fontSize > 12) {
    return {
      cardPaddingX: 16,
      cardPaddingY: 12,
      cardBorderRadius: 8,
      cardBorderWidth: 1,
      descGap: 2,
      selectionBoxSize: 20,
    };
  }
  // fontSize≤12: small 카드 (12/10/8)
  return {
    cardPaddingX: 12,
    cardPaddingY: 10,
    cardBorderRadius: 8,
    cardBorderWidth: 1,
    descGap: 2,
    selectionBoxSize: 20,
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
  cardBorderWidth: number;
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
    cardBorderWidth: itemMetric.cardBorderWidth,
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
