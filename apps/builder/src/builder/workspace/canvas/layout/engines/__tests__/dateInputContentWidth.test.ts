import { describe, expect, test } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { INLINE_BLOCK_TAGS, calculateContentWidth } from "../utils";

/**
 * DateInput intrinsic content width — Skia box 가 콘텐츠(segment text + icon)보다
 *   작아져 텍스트가 box 밖으로 넘치던 버그(2026-06-23) 회귀 게이트.
 *
 * 근본 원인: layout 분기가 DateInput 에 `width:"100%"` 를 주입했는데, 부모
 *   DatePicker/DateRangePicker container 가 width:auto(body align-items:flex-start
 *   에서 콘텐츠 shrink)라 Taffy 가 `100%` 를 작게 계산 → box < 콘텐츠. escape 노드는
 *   자식이 없어 intrinsic width 0 → CSS 의 min-content 보장이 없다.
 *
 * 수정: DisclosureHeader/CalendarHeader 동형 — (1) INLINE_BLOCK_TAGS 에 "dateinput"
 *   등록 → needsWidth=true. (2) calculateContentWidth dateinput 분기 = paddingX +
 *   segmentTextWidth + (picker 면 gap + iconSize + padRight, 아니면 우측 paddingX)
 *   (datefieldSegments escape Skia 공식과 1:1 대칭). 콘텐츠 자연폭 = CSS DatePicker
 *   container(body align-items:flex-start 에서 113px 콘텐츠 fit) 시각 정합.
 */
const makeDateInput = (props: Record<string, unknown> = {}): CanvasLayoutNode =>
  ({
    id: "di-1",
    type: "DateInput",
    props: {
      _parentTag: "DatePicker",
      _granularity: "day",
      _locale: "en-US",
      size: "md",
      ...props,
    },
  }) as CanvasLayoutNode;

describe("DateInput intrinsic content width (2026-06-23 box < content 버그)", () => {
  test("INLINE_BLOCK_TAGS 에 dateinput 등록 — width 주입 대상 (needsWidth 트리거)", () => {
    expect(INLINE_BLOCK_TAGS.has("dateinput")).toBe(true);
  });

  test("calculateContentWidth — width 0 아님 (box width 0 버그 차단)", () => {
    const w = calculateContentWidth(makeDateInput());
    expect(w).toBeGreaterThan(0);
  });

  test("DatePicker(picker) — paddingX + text + gap + iconSize + padRight 골격 이상", () => {
    // rule md: paddingX 12 + (text "MM / DD / YYYY") + gap 4 + iconSize 16 + padRight 4.
    //   text 폭은 measure 환경 의존이지만, 좌 padding + icon + gap + padRight 골격은 항상 포함.
    const w = calculateContentWidth(makeDateInput());
    expect(w).toBeGreaterThanOrEqual(12 + 4 + 16 + 4);
  });

  test("DateField(non-picker) — icon 공간 없음, picker 보다 좁다 (같은 날짜 텍스트)", () => {
    const picker = calculateContentWidth(
      makeDateInput({ _parentTag: "DatePicker" }),
    );
    const field = calculateContentWidth(
      makeDateInput({ _parentTag: "DateField" }),
    );
    expect(field).toBeLessThan(picker);
  });

  test("DateRangePicker(범위 '–') — DatePicker 보다 넓다 (범위 텍스트 2배)", () => {
    const single = calculateContentWidth(
      makeDateInput({ _parentTag: "DatePicker" }),
    );
    const range = calculateContentWidth(
      makeDateInput({ _parentTag: "DateRangePicker" }),
    );
    expect(range).toBeGreaterThan(single);
  });

  test("locale 분기 — placeholder 폭 반영 (asian YYYY / MM / DD vs en MM / DD / YYYY 동일 자릿수면 근사)", () => {
    // 자릿수는 같지만 measure 가 동작함을 확인 (둘 다 > 0, 골격 이상).
    const en = calculateContentWidth(makeDateInput({ _locale: "en-US" }));
    const ko = calculateContentWidth(makeDateInput({ _locale: "ko-KR" }));
    expect(en).toBeGreaterThan(0);
    expect(ko).toBeGreaterThan(0);
  });

  test("명시적 style.width override 우선 (intrinsic 무시)", () => {
    const w = calculateContentWidth(makeDateInput({ style: { width: 320 } }));
    expect(w).toBe(320);
  });

  test("size 클수록 폭 크다 (xl > md, padding/icon/fontSize 증가)", () => {
    const md = calculateContentWidth(makeDateInput({ size: "md" }));
    const xl = calculateContentWidth(makeDateInput({ size: "xl" }));
    expect(xl).toBeGreaterThan(md);
  });
});
