import { describe, expect, test } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { INTRINSIC_MEASURE_TAGS, calculateContentWidth } from "../utils";

/**
 * DateInput intrinsic content width — Skia box 가 콘텐츠(segment text + icon)보다
 *   작아져 텍스트가 box 밖으로 넘치던 버그(2026-06-23) 회귀 게이트.
 *
 * 근본 원인: layout 분기가 DateInput 에 `width:"100%"` 를 주입했는데, 부모
 *   DatePicker/DateRangePicker container 가 width:auto(body align-items:flex-start
 *   에서 콘텐츠 shrink)라 Taffy 가 `100%` 를 작게 계산 → box < 콘텐츠. escape 노드는
 *   자식이 없어 intrinsic width 0 → CSS 의 min-content 보장이 없다.
 *
 * 수정: DisclosureHeader/CalendarHeader 동형 — (1) INTRINSIC_MEASURE_TAGS 에 "dateinput"
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
  test("INTRINSIC_MEASURE_TAGS 에 dateinput 등록 — width 주입 대상 (needsWidth 트리거)", () => {
    expect(INTRINSIC_MEASURE_TAGS.has("dateinput")).toBe(true);
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

  test("picker 안 DateInput = segment text 폭만 (padding/gap/icon 미포함) — standalone DateField 보다 좁다", () => {
    // 2026-07-14 정정: 종전 테스트는 "picker 가 icon 공간만큼 더 넓다" 를 기대했다. 그 전제는
    //   layout 이 옛 escape-box 공식(paddingX + text + gap + icon + padRight)을 쓰던 시절의 것이다.
    //   실제 renderer(skiaPrimitives datefieldSegments)는 picker 일 때 box/border/icon 을 **안 그리고**
    //   segment text 만 그린다 — box 는 SelectTrigger, icon 은 SelectIcon 이 담당(이중 렌더 방지).
    //   DOM 실측(2026-07-14)도 picker 안 DateInput = border 0 / padding 0 / DateSegment 뿐 (71.1px).
    //   layout 이 padding+icon 을 또 더해 DatePicker 가 178 로 팽창(DOM 113.1)하던 것이 버그였다.
    //   → picker 는 **순수 텍스트 폭**, standalone DateField 는 **좌우 padding 포함 box** 라
    //     같은 날짜 텍스트면 DateField 쪽이 더 넓다.
    const picker = calculateContentWidth(
      makeDateInput({ _parentTag: "DatePicker" }),
    );
    const field = calculateContentWidth(
      makeDateInput({ _parentTag: "DateField" }),
    );
    expect(picker).toBeLessThan(field);
    // DateField = picker(텍스트) + paddingX*2 (md=12) — icon/gap 은 어느 쪽에도 없다.
    expect(field - picker).toBe(24);
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
