import { fontFamily as specFontFamily } from "@composition/rendering";
import {
  measureWrappedTextHeight,
  measureFontMetrics,
  getTextMeasurer,
} from "../../utils/textMeasure";
import { preprocessTokens, tokenize } from "../../utils/canvas2dSegmentCache";
import {
  FIT_CONTENT as CSS_FIT_CONTENT,
  MIN_CONTENT as CSS_MIN_CONTENT,
  MAX_CONTENT as CSS_MAX_CONTENT,
} from "./cssValueParser";

/**
 * CSS intrinsic sizing sentinel 값
 *
 * Yoga/WASM가 fit-content를 네이티브 지원하지 않으므로,
 * parseSize()에서 sentinel 값으로 변환하여 BlockEngine/WASM에 전달한다.
 * AUTO(-1)와 동일한 패턴으로 Float32Array 직렬화 시 그대로 전달 가능.
 *
 * 통합 파서(cssValueParser.ts)에서 정의된 값을 re-export한다.
 */
export const FIT_CONTENT = CSS_FIT_CONTENT;
export const MIN_CONTENT = CSS_MIN_CONTENT;
export const MAX_CONTENT = CSS_MAX_CONTENT;

/**
 * 활성 TextMeasurer를 사용하여 텍스트 너비 측정
 *
 * Phase 4-1: getTextMeasurer() 전략 패턴 적용
 * - CanvasKit 초기화 후: CanvasKit Paragraph API (HarfBuzz 정확도)
 * - CanvasKit 미로드 시: Canvas 2D API (기존 동작)
 *
 * @param text - 측정할 텍스트
 * @param fontSize - 폰트 크기 (기본 14px)
 * @param fontFamily - 폰트 패밀리 (기본 Pretendard)
 * @param fontWeight - 폰트 두께 (기본 400)
 * @param extra - 렌더러 ParagraphStyle 정합성을 위한 추가 스타일 (기존 호출자 하위 호환)
 */
export function measureTextWidth(
  text: string,
  fontSize: number = 14,
  fontFamily: string = specFontFamily.sans,
  fontWeight: number | string = 400,
  extra?: {
    letterSpacing?: number;
    wordSpacing?: number;
    fontStyle?: number | string;
    fontStretch?: string;
    fontVariant?: string;
    lineHeight?: number;
  },
): number {
  if (!text) return 0;

  return getTextMeasurer().measureWidth(text, {
    fontSize,
    fontFamily,
    fontWeight,
    ...extra,
  });
}

// ---------------------------------------------------------------------------
// Intrinsic Size 주입 (§6 P1: 엔진 공유)
// ---------------------------------------------------------------------------

/**
 * ADR-923 Phase 4 (G5) → Phase 5 — 구 `INLINE_BLOCK_TAGS` 24 항목의 **두 역할 분리** (Phase 0 §B
 * 분류표, `docs/adr/evidence/923-phase0-inventory.md`). Phase 5 (2026-09-02) 에서 그 Set 은 삭제됐고
 * 이 분류표가 두 역할의 단일 정본이다 — 측정은 `INTRINSIC_MEASURE_TAGS` (아래, 명시 목록), 기본
 * display 는 `defaultDisplay.ts` `resolveDefaultDisplay` (catalog 파생 → hand 목록 → block).
 *
 * 구 Set 은 두 개념을 겸용해 왔다 — (a) 부모가 보는 **기본 display** (`getElementDisplay` →
 * `inline-block`) 와 (b) **intrinsic 측정 필요** (`needsWidth` 게이트 → `calculateContentWidth`).
 * 24 항목 전부 (b) 는 필요하지만 (a) 는 항목마다 다르다:
 * - role `AB` 11 — display 도 catalog 로 파생 가능 (inline-* — 사용자-가시 DOM 과 outer 일치)
 * - role `B` 6 — 측정만 필요. catalog/DOM 이 block-level (flex/grid/table) 인데 이 Set 에 있어 부모가
 *   inline-block 으로 봤다 (display 역할이 틀림 — Phase 5 에서 display 목록에서 빠진다)
 * - role `?` 7 — 분류 불가 + 사유 (catalog rule 없음 5 · Menu B7 의도된 차이 · DateInput display 없음)
 * display 원천: `catalog` (파생 가능 — 17) / `hand` (파생 원천 없음 → 손 목록 + 사유 — 7). hand 의
 * `handDisplay` 는 **동작 값** 이다: rule 없는 5 + dateinput 은 `inline-block`, calendargrid 는 `block`
 * (Phase 5 전환 — CalendarGrid Q4 `tests/parity/adr923CalendarGridQ4.browser.test.ts` +
 * evidence/923-phase4-preparation.md §9, Codex round 30 판정). 후보 (`domDisplay`) 는 근거가 붙기
 * 전까지 동작에 쓰지 않는다.
 *
 * Phase 5 배선 결과 (G5 의도된 diff 목록, `adr923IntrinsicMeasureSplit.test.ts` 고정): catalog 17 은
 * `inline-block` → catalog `containerStyles.display` (Button/ToggleButton inline-flex · badge 등
 * inline-flex · progresscircle grid · togglebuttongroup/toolbar/disclosureheader/calendarheader
 * flex · menu inline-flex), calendargrid `inline-block` → `block`, 나머지 hand 6 은 무변경.
 */
/** Phase 0 §B 역할 — AB: display 파생 + 측정 · B: 측정만 (display 역할이 틀림) · ?: 분류 불가 (사유) */
type InlineBlockTagRole = "AB" | "B" | "?";
/** 기본 display 의 원천 — catalog 파생 가능 / 손 목록 (파생 원천 없음) */
type InlineBlockTagDisplaySource = "catalog" | "hand";

interface InlineBlockTagClassification {
  /** intrinsic 측정 (`needsWidth` → `calculateContentWidth`) 이 필요한가 — 24 항목 전부 true */
  readonly measure: true;
  readonly role: InlineBlockTagRole;
  /** 기본 display 의 원천 */
  readonly display: InlineBlockTagDisplaySource;
  /**
   * `display: "hand"` 일 때 손 목록 값 — **현재 동작 값 하나만** 뜻한다: `resolveDefaultDisplay`
   * (ADR-923 Phase 5 배선) 가 catalog 에 display 가 없는 태그에 돌려주는 값 (`inline-block` 6 ·
   * calendargrid `block`). DOM 정합 후보값은 `domDisplay` 로 분리 (round 29 r29m2 — 한 필드에
   * "현재 값" 과 "후보값" 두 뜻을 싣지 않는다).
   */
  readonly handDisplay?: string;
  /**
   * 대응 DOM box 의 outer display (Q4 측정값, hand 항목만). `handDisplay` 와 다르면 전환 후보 —
   * Phase 5 (2026-09-02) 가 calendargrid 를 `block` 으로 전환해 현재 후보 0 (필드는 후속 판정용으로
   * 남긴다), `domEvidence` 가 측정 근거다.
   */
  readonly domDisplay?: string;
  readonly domEvidence?: string;
  readonly reason: string;
}

export const INLINE_BLOCK_TAG_CLASSIFICATION: Readonly<
  Record<string, InlineBlockTagClassification>
> = {
  button: {
    measure: true,
    role: "AB",
    display: "catalog",
    reason:
      "텍스트+아이콘 합성 leaf 폭 측정 (utils button 분기). display 는 catalog top-level (Phase 5 에서 inline-flex 전환 대상, DOM Button.css inline-flex)",
  },
  submitbutton: {
    measure: true,
    role: "?",
    display: "hand",
    handDisplay: "inline-block",
    reason:
      "catalog rule 없음 · 생성 참조 0 — 파생 원천 없음. 폭·높이는 button 분기 공유. Phase 5 cutover 후에도 손 목록 (inline-block) 유지 — 파생 원천 없음",
  },
  fancybutton: {
    measure: true,
    role: "?",
    display: "hand",
    handDisplay: "inline-block",
    reason:
      "catalog rule 없음 · 생성 참조 0 — 파생 원천 없음. button 분기 공유. Phase 5 cutover 후에도 손 목록 (inline-block) 유지 — 파생 원천 없음",
  },
  togglebutton: {
    measure: true,
    role: "AB",
    display: "catalog",
    reason:
      "텍스트 leaf 폭 측정. display 는 catalog top-level (Phase 5 inline-flex 전환 대상, DOM ToggleButton.css inline-flex)",
  },
  badge: {
    measure: true,
    role: "AB",
    display: "catalog",
    reason:
      "텍스트 leaf (전용 분기 없음 → 텍스트 fallback). catalog structure inline-flex = DOM",
  },
  progresscircle: {
    measure: true,
    role: "B",
    display: "catalog",
    reason:
      "self-render leaf (CIRCLE_LEAF_TAGS, width = diameter). catalog structure grid = block-level — 이 Set 등재가 부모 판정을 inline-block 으로 만들어 DOM 과 어긋남 (B)",
  },
  // 2026-09-21: 키가 `type` 이었다 — 99e4e7c96 의 `Element.tag → Element.type` 기계 rename 이 이 표의
  //   키 "tag" 까지 바꿨다 (INLINE_UI_SIZE_CONFIGS 와 같은 사고, 1299 행). 그 뒤로 Tag chip 은 측정 leaf
  //   가 아니었고, 09-19 「자식 0 컨테이너도 엔진 소유」 가 비측정 leaf 의 `width:fit-content` 를 엔진에
  //   넘기자 chip 이 content 0 = padding 24px 로 접혔다 (TagGroup 전부 · Preview 는 정상). Tag 는
  //   catalog rule (inline-flex) 이 있는 텍스트 leaf 라 catalog 파생.
  tag: {
    measure: true,
    role: "?",
    display: "hand",
    handDisplay: "inline-block",
    reason:
      "텍스트 leaf 측정 (calculateContentWidth inline UI 분기 · TAG_SIZE_CONFIG). chip projection (`appendTagRowProjection`) 의 `width:fit-content` 가 측정 스칼라를 받아야 한다. display 는 종전 손 목록 값 (inline-block) 유지 — Tag catalog rule 은 structure display 를 파생하지 않는다 (DOM .react-aria-Tag inline-flex 는 후속 판정)",
  },
  chip: {
    measure: true,
    role: "?",
    display: "hand",
    handDisplay: "inline-block",
    reason:
      "catalog rule 없음 (chip 은 TagList self-render) · 생성 참조 0. Phase 5 cutover 후에도 손 목록 (inline-block) 유지 — 파생 원천 없음",
  },
  checkbox: {
    measure: true,
    role: "AB",
    display: "catalog",
    reason:
      "합성 (indicator + Label 자식) childElements 경로 측정. catalog structure inline-flex (DOM 충돌 Checkbox.css flex vs generated inline-flex 는 Phase 5 HC2 판정)",
  },
  radio: {
    measure: true,
    role: "AB",
    display: "catalog",
    reason:
      "합성 (indicator + Label) 측정. catalog structure inline-flex (DOM 충돌 Radio.css flex vs generated inline-flex 는 Phase 5 HC2 판정)",
  },
  switch: {
    measure: true,
    role: "AB",
    display: "catalog",
    reason:
      "합성 (indicator + Label) 측정. catalog structure inline-flex = DOM Switch.css",
  },
  togglebuttongroup: {
    measure: true,
    role: "B",
    display: "catalog",
    reason:
      "합성 컨테이너 fit-content 측정 (utils :1711 분기). catalog top/structure flex = block-level (B)",
  },
  toolbar: {
    measure: true,
    role: "B",
    display: "catalog",
    reason:
      "자식 합산 fit-content 측정. catalog structure flex = block-level (B)",
  },
  statuslight: {
    measure: true,
    role: "AB",
    display: "catalog",
    reason:
      "합성 leaf (dot + text) 측정. catalog structure inline-flex (DOM generated dead — 실효 UA 기본, Phase 5 HC2 판정)",
  },
  link: {
    measure: true,
    role: "AB",
    display: "catalog",
    reason: "텍스트 leaf 측정. catalog structure inline-flex = DOM Link.css",
  },
  linkbutton: {
    measure: true,
    role: "?",
    display: "hand",
    handDisplay: "inline-block",
    reason:
      "catalog rule 없음 · 생성 참조 0. Phase 5 cutover 후에도 손 목록 (inline-block) 유지 — 파생 원천 없음",
  },
  breadcrumb: {
    measure: true,
    role: "AB",
    display: "catalog",
    reason:
      "합성 leaf (label + separator) 측정 (ADR-086 P5). catalog structure inline-flex (DOM generated dead → UA li, Phase 5 HC2 판정)",
  },
  icon: {
    measure: true,
    role: "AB",
    display: "catalog",
    reason:
      "self-render leaf (iconSize) 측정. catalog structure inline-flex = DOM generated Icon.css",
  },
  menu: {
    measure: true,
    role: "?",
    display: "catalog",
    reason:
      "트리거 텍스트 측정 (BUTTON_LIKE_TAGS). catalog top-level inline-flex = Canvas 트리거 박스 (DOM root 는 popover flex — ADR-151 B7 의도된 차이, top-level 이 대체)",
  },
  tab: {
    measure: true,
    role: "AB",
    display: "catalog",
    reason:
      "텍스트 leaf 측정 (텍스트 fallback). catalog structure inline-flex = DOM Tab.css",
  },
  disclosureheader: {
    measure: true,
    role: "B",
    display: "catalog",
    reason:
      "합성 leaf (chevron + text) 측정 — R5 선례 073751610 (미등록 시 width 0). catalog structure flex = block-level (B)",
  },
  calendarheader: {
    measure: true,
    role: "B",
    display: "catalog",
    reason:
      "합성 leaf (chevron + text + chevron) 측정. catalog structure flex = block-level (B)",
  },
  calendargrid: {
    measure: true,
    role: "B",
    display: "hand",
    handDisplay: "block",
    reason:
      "self-render leaf (cellSize*7) 측정. rule 은 있으나 catalog display 없음 → 파생 불가 → 손 목록. Phase 5 (2026-09-02) 에서 inline-block → block 전환 — Q4 (tests/parity/adr923CalendarGridQ4.browser.test.ts, evidence/923-phase4-preparation.md §9): production Calendar 트리에서 부모 Calendar 는 두 표면 모두 flex 컨테이너라 outer 는 inert (layout map 동일), 자유 배치 형태의 DOM 은 Preview resolveHtmlTag → <div> (block) · RAC 실체 <table> (outer block-level) 과 정합. Codex round 30 판정 (추가 측정 없이 block 선택 근거 충분)",
  },
  dateinput: {
    measure: true,
    role: "?",
    display: "hand",
    handDisplay: "inline-block",
    domDisplay: "inline-block",
    domEvidence:
      "DOM 문맥 셀렉터 inline-flex (outer inline) — 현재 값과 outer 동일, 전환 후보 아님",
    reason:
      "self-render leaf (segments + icon) 측정 (2026-06-23 버그). rule 은 있으나 catalog display 없음 → 파생 불가; DOM 은 문맥 셀렉터 inline-flex (outer inline 동일). Phase 5 cutover 후에도 손 목록 (inline-block) 유지 — DOM outer 와 같다",
  },
};

// ============================================
// white-space 기반 텍스트 측정
// ============================================

/**
 * white-space CSS 속성에 따른 텍스트 크기 측정
 *
 * - normal: 공백 축소 + 자동 줄바꿈 (기본 동작)
 * - nowrap: 공백 축소 + 줄바꿈 없이 한 줄
 * - pre: 공백 보존 + \n만 줄바꿈, 자동 줄바꿈 없음
 * - pre-wrap: 공백 보존 + \n + 자동 줄바꿈
 * - pre-line: 공백 축소 + \n + 자동 줄바꿈
 */
export function measureTextWithWhiteSpace(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string,
  whiteSpace: string,
  maxWidth: number,
  wordBreak?: string,
  overflowWrap?: string,
  lineHeightOverride?: number,
  /**
   * ADR-205 Phase 1 — 자간(px). 줄 수를 바꾸는 축이라 wrap leg 이 받아야 한다.
   * 해소는 호출부의 `resolveTextRenderStyle` 이 하고 여기는 운반만 한다.
   */
  letterSpacing?: number,
): { width: number; height: number } {
  // CSS line-height: normal 근사값 (fontBoundingBox 기반)
  // lineHeightOverride가 있으면 spec/config 기반 lineHeight 우선 사용
  const fm = measureFontMetrics(fontFamily, fontSize, fontWeight);
  const lineHeight = lineHeightOverride ?? fm.lineHeight;

  // ADR-008: word-break/overflow-wrap 타입 캐스팅
  const wb = wordBreak as "normal" | "break-all" | "keep-all" | undefined;
  const ow = overflowWrap as "normal" | "break-word" | "anywhere" | undefined;

  switch (whiteSpace) {
    case "nowrap": {
      // 줄바꿈 없이 한 줄
      const width = measureTextWidth(text, fontSize, fontFamily, fontWeight, {
        letterSpacing,
      });
      return { width, height: lineHeight };
    }
    case "pre": {
      // \n만 줄바꿈, 자동 줄바꿈 없음
      const lines = text.split("\n");
      let maxLineWidth = 0;
      for (const line of lines) {
        const w = measureTextWidth(line, fontSize, fontFamily, fontWeight, {
          letterSpacing,
        });
        if (w > maxLineWidth) maxLineWidth = w;
      }
      return { width: maxLineWidth, height: lines.length * lineHeight };
    }
    case "pre-wrap":
    case "pre-line": {
      // \n + 자동 줄바꿈 (pre-line은 공백 축소)
      const processedText =
        whiteSpace === "pre-line" ? text.replace(/[ \t]+/g, " ") : text;
      return {
        width: maxWidth,
        height: measureWrappedTextHeight(
          processedText,
          fontSize,
          fontWeight,
          fontFamily,
          maxWidth,
          lineHeightOverride,
          wb,
          ow,
          letterSpacing,
        ),
      };
    }
    default: {
      // normal: 기본 동작
      return {
        width: maxWidth,
        height: measureWrappedTextHeight(
          text,
          fontSize,
          fontWeight,
          fontFamily,
          maxWidth,
          lineHeightOverride,
          wb,
          ow,
          letterSpacing,
        ),
      };
    }
  }
}

// ============================================
// min-content / max-content 텍스트 너비 측정
// ============================================

/**
 * min-content 너비 계산
 *
 * CSS min-content: 가장 긴 단어(줄바꿈 불가능한 최소 단위)의 너비.
 * 텍스트를 단어 단위로 분리하여 가장 긴 단어의 렌더링 너비를 반환한다.
 *
 * @param text - 측정할 텍스트
 * @param fontSize - 폰트 크기 (기본 14px)
 * @param fontFamily - 폰트 패밀리
 * @param fontWeight - 폰트 두께
 * @returns 가장 긴 단어의 px 너비
 */
export function calculateMinContentWidth(
  text: string,
  fontSize: number = 14,
  fontFamily: string = specFontFamily.sans,
  fontWeight: number | string = 400,
  /** `keep-all` 이면 CJK 연속도 한 단위 (Chrome 과 같이). 생략은 normal. */
  wordBreak: string = "normal",
): number {
  if (!text) return 0;

  // 줄바꿈 단위는 렌더 힌트·wrap 측정과 같은 토큰화 (Intl.Segmenter · CJK 문자 사이 break · 금칙
  //   병합) 로 — min-content 는 그 단위 중 가장 넓은 것이다 (2026-09-20). 종전 공백 split 은 한글
  //   연속 "가나다라마바사" 를 한 단어 (112) 로 봐 엔진 폭 하한이 Chrome (한 음절) 보다 컸다.
  const tokens = preprocessTokens(tokenize(text, wordBreak), wordBreak);
  let maxWordWidth = 0;
  for (const token of tokens) {
    if (/^\s+$/.test(token.text)) continue;
    const width = measureTextWidth(
      token.text,
      fontSize,
      fontFamily,
      fontWeight,
    );
    if (width > maxWordWidth) {
      maxWordWidth = width;
    }
  }

  return Math.ceil(maxWordWidth);
}

/**
 * max-content 너비 계산
 *
 * CSS max-content: 줄바꿈 없이 한 줄로 렌더링했을 때의 전체 너비.
 *
 * @param text - 측정할 텍스트
 * @param fontSize - 폰트 크기 (기본 14px)
 * @param fontFamily - 폰트 패밀리
 * @param fontWeight - 폰트 두께
 * @returns 전체 텍스트의 한 줄 px 너비
 */
export function calculateMaxContentWidth(
  text: string,
  fontSize: number = 14,
  fontFamily: string = specFontFamily.sans,
  fontWeight: number | string = 400,
): number {
  if (!text) return 0;

  return Math.ceil(measureTextWidth(text, fontSize, fontFamily, fontWeight));
}
