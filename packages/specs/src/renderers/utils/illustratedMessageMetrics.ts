/**
 * IllustratedMessage metric SSOT — DOM(IllustratedMessage.tsx) / Skia escape
 * (skiaPrimitives illustrated_message) / layout(calculateContentHeight) 3경로 공유.
 *
 * **ADR-151 후속 (2026-07-17)**: marker passthrough 수정으로 CSS 측정이 가능해지며
 * Skia 48 vs CSS 240 시각 발산이 드러났다 — escape 는 placeholder+텍스트 ~180px 를
 * 그리는데 layout 높이 분기가 없어 박스(48)를 넘쳤고, escape 기하도 top-left 고정
 * (padding/중앙 배치 부재) 이라 DOM(flex column center) 과 어긋났다. 본 metric 이
 * 세 경로의 단일 산식이다 (Layer D 동일 resolver 원칙 — ADR-907 §2.6).
 *
 * catalog(COMPONENT_RULES_TABLE.IllustratedMessage.sizes) 가 paddingX/paddingY/gap/
 * headingFontSize/fontSize 를 보유 — caller 가 해당 size entry 를 `sizeLike` 로 전달
 * (read-through). box(일러스트 placeholder 변) 는 catalog 대응 키 부재라 본 모듈
 * 인라인 유지 (StatusLight dotSize 선례 — escape/DOM 고유 layout 치수).
 *
 * line height 는 1.5 고정 — DOM 이 heading/description 에 `lineHeight: 1.5` 를 명시
 * (md: 18→27 / 14→21, 총 240 = 24·2 + 120 + 12 + 27 + 12 + 21).
 */
import { resolveSpecFontSize } from "./resolveSpecFontSize";

/** 일러스트 placeholder 변 (정사각) — escape/DOM 공유, catalog 키 부재 축. */
export const ILLUSTRATED_MESSAGE_BOX: Readonly<Record<string, number>> = {
  sm: 80,
  md: 120,
  lg: 160,
};

const PADDING_FALLBACK: Readonly<Record<string, number>> = {
  sm: 16,
  md: 24,
  lg: 32,
};
const GAP_FALLBACK: Readonly<Record<string, number>> = {
  sm: 8,
  md: 12,
  lg: 16,
};
const HEADING_FS_FALLBACK: Readonly<Record<string, number>> = {
  sm: 16,
  md: 18,
  lg: 20,
};

export interface IllustratedMessageSizeLike {
  paddingX?: unknown;
  paddingY?: unknown;
  gap?: unknown;
  headingFontSize?: unknown;
  fontSize?: unknown;
}

export interface IllustratedMessageMetric {
  box: number;
  paddingX: number;
  paddingY: number;
  gap: number;
  headingFs: number;
  descFs: number;
  headingLine: number;
  descLine: number;
  /**
   * content-box 높이 (padding 제외 — box + gap·2 + headingLine + descLine).
   * layout 분기 계약: calculateContentHeight caller(fullTreeLayout:1936)가 element
   * style padding 을 별도 가산하므로 padding 포함 반환 시 이중 계상 (240+48=288 실측).
   */
  contentHeight: number;
  /** 전체 박스 높이 (metric padding 포함) — style padding 부재 시의 DOM 총높이. */
  totalHeight: number;
}

export function resolveIllustratedMessageMetric(
  sizeName: string,
  sizeLike?: IllustratedMessageSizeLike,
): IllustratedMessageMetric {
  const key = ILLUSTRATED_MESSAGE_BOX[sizeName] ? sizeName : "md";
  const box = ILLUSTRATED_MESSAGE_BOX[key];
  const paddingX =
    typeof sizeLike?.paddingX === "number"
      ? sizeLike.paddingX
      : PADDING_FALLBACK[key];
  const paddingY =
    typeof sizeLike?.paddingY === "number"
      ? sizeLike.paddingY
      : PADDING_FALLBACK[key];
  const gap =
    typeof sizeLike?.gap === "number" ? sizeLike.gap : GAP_FALLBACK[key];
  const headingFs = resolveSpecFontSize(
    sizeLike?.headingFontSize as string | number | undefined,
    HEADING_FS_FALLBACK[key],
  );
  const descFs = resolveSpecFontSize(
    sizeLike?.fontSize as string | number | undefined,
    14,
  );
  const headingLine = Math.round(headingFs * 1.5);
  const descLine = Math.round(descFs * 1.5);
  const contentHeight = box + gap + headingLine + gap + descLine;
  return {
    box,
    paddingX,
    paddingY,
    gap,
    headingFs,
    descFs,
    headingLine,
    descLine,
    contentHeight,
    totalHeight: contentHeight + paddingY * 2,
  };
}

/** IllustratedMessage 기본 글자 — Preview · Skia · layout 세 표면이 같은 값을 갖는 단일 지점. */
export const ILLUSTRATED_MESSAGE_DEFAULT_HEADING = "No content";
export const ILLUSTRATED_MESSAGE_DEFAULT_DESCRIPTION =
  "There is nothing to display.";

/**
 * IllustratedMessage heading/description 텍스트 원천 (ADR-923 r19m1).
 *
 * - 부재 (undefined) → 기본 글자 (세 표면 동일 — 종전 Skia 의 `??` 와 같다).
 * - 명시적 `""` → `""` 그대로: consumer 는 그 줄 자체를 접는다 (Preview 는 div 미렌더, layout
 *   `illustratedmessage` 높이는 gap + line 차감, Skia `illustrated_message` 는 shape 미생성 + y 접힘).
 *   종전 Preview 의 `||` 는 사용자가 비운 "" 를 기본 글자로 되살려 Skia (빈 줄) 와 갈렸다.
 */
export function resolveIllustratedMessageText(
  props: Record<string, unknown> | undefined,
): { heading: string; description: string } {
  const heading = props?.heading;
  const description = props?.description;
  return {
    heading:
      typeof heading === "string"
        ? heading
        : ILLUSTRATED_MESSAGE_DEFAULT_HEADING,
    description:
      typeof description === "string"
        ? description
        : ILLUSTRATED_MESSAGE_DEFAULT_DESCRIPTION,
  };
}
