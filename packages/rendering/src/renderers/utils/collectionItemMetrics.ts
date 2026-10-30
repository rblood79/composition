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
 * `calculateContentHeight` · 부모 spec 은 삭제됐다). rule 의 손 사본이던 item 상수와 그것만 읽던 테스트
 * 전용 spacing resolver (`resolveListBoxSpacingMetric` · `resolveGridListSpacingMetric`) 는 지웠다 —
 * 값은 rule 에서 읽는다.
 *
 * @packageDocumentation
 */

import { measureSpecWrappedTextHeight } from "./measureText";

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

