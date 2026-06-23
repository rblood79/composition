import { describe, expect, it } from "vitest";

import { getSkiaPrimitive, getSkiaPrimitiveMode } from "../skiaPrimitives";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * ADR-912 deletion-risk(date) DateInput value — `datefield_segments` escape 회귀 게이트.
 *
 * DateInput catalog 발효(datefield_segments replace) 후 Skia 시각 불변식 검증:
 *   input box + border + 세그먼트 placeholder text(+picker 일 때 후행 calendar icon)를 자체 생성.
 *
 * **datefield_trigger(부모 picker 가 그리는 trigger field, 자식 없을 때)와 다른 점**: datefield_segments
 *   는 **자식 DateInput element 자신** 이 그리는 입력 box+segment placeholder. `_parentTag` 4종 분기:
 *   DateField/TimeField(segment) / DatePicker/DateRangePicker(picker icon 포함).
 *
 * 좌표/text = DateInput.spec.ts:218-331 render.shapes 1:1 이식(spec-free).
 */

// DateInput rule.sizes.md 미러 (height 30, fontSize text-sm).
const sizeMd: SizeSpec = {
  height: 30,
  paddingX: 12,
  paddingY: 4,
  fontSize: "{typography.text-sm}" as never,
  borderRadius: "{radius.md}" as never,
  gap: 0,
};

// DateInput rule.variants.default 미러 (text neutral / border / layer-2 fill).
const visual: ComponentVisualRule = {
  fill: {
    default: {
      base: "{color.layer-2}" as never,
      hover: "{color.layer-2}" as never,
      pressed: "{color.layer-2}" as never,
    },
  },
  text: "{color.neutral}" as never,
  border: "{color.border}" as never,
} as ComponentVisualRule;

const draw = getSkiaPrimitive("datefield_segments")!;

function texts(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type === "text");
}
function icons(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type === "icon_font");
}
function rects(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type === "roundRect");
}
function borders(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type === "border");
}

describe("skiaPrimitive 'datefield_segments' — DateInput value-fill (ADR-912 deletion-risk date)", () => {
  it("registry 에 replace 모드로 등록 (input box+segment 자체 생성, buildCatalogShapes box 대체)", () => {
    expect(draw).toBeDefined();
    expect(getSkiaPrimitiveMode("datefield_segments")).toBe("replace");
  });

  it("DateField(기본) — box + border + segment text 3 shape, picker icon 없음", () => {
    const shapes = draw({
      props: { _parentTag: "DateField", _granularity: "day", _locale: "en-US" },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect(rects(shapes)).toHaveLength(1); // input-bg
    expect(borders(shapes)).toHaveLength(1);
    expect(texts(shapes)).toHaveLength(1); // segment placeholder
    expect(icons(shapes)).toHaveLength(0); // DateField 는 picker icon 없음
  });

  it("DateField en-US segment text = 'MM / DD / YYYY'", () => {
    const shapes = draw({
      props: { _parentTag: "DateField", _granularity: "day", _locale: "en-US" },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect((texts(shapes)[0] as { text?: string }).text).toBe("MM / DD / YYYY");
  });

  it("locale 분기 — ko(아시아) = 'YYYY / MM / DD', de(유럽) = 'DD / MM / YYYY'", () => {
    const ko = draw({
      props: { _parentTag: "DateField", _granularity: "day", _locale: "ko-KR" },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    const de = draw({
      props: { _parentTag: "DateField", _granularity: "day", _locale: "de-DE" },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect((texts(ko)[0] as { text?: string }).text).toBe("YYYY / MM / DD");
    expect((texts(de)[0] as { text?: string }).text).toBe("DD / MM / YYYY");
  });

  it("TimeField — 시간 세그먼트 'HH : MM' (날짜 없음)", () => {
    const shapes = draw({
      props: {
        _parentTag: "TimeField",
        _granularity: "minute",
        _locale: "en-US",
      },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect((texts(shapes)[0] as { text?: string }).text).toBe("HH : MM");
  });

  it("TimeField hourCycle=12 second → 'HH : MM : SS  AM'", () => {
    const shapes = draw({
      props: {
        _parentTag: "TimeField",
        _granularity: "second",
        _hourCycle: 12,
        _locale: "en-US",
      },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect((texts(shapes)[0] as { text?: string }).text).toBe(
      "HH : MM : SS  AM",
    );
  });

  it("DatePicker — picker icon(calendar) 1개 추가 (box+border+text+icon = 4 shape)", () => {
    const shapes = draw({
      props: {
        _parentTag: "DatePicker",
        _granularity: "day",
        _locale: "en-US",
      },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    const ic = icons(shapes);
    expect(ic).toHaveLength(1);
    expect((ic[0] as { iconName?: string }).iconName).toBe("calendar");
  });

  it("DateRangePicker — 범위 segment 'MM / DD / YYYY – MM / DD / YYYY' + picker icon", () => {
    const shapes = draw({
      props: {
        _parentTag: "DateRangePicker",
        _granularity: "day",
        _locale: "en-US",
      },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect((texts(shapes)[0] as { text?: string }).text).toBe(
      "MM / DD / YYYY – MM / DD / YYYY",
    );
    expect(icons(shapes)).toHaveLength(1);
  });

  it("box 색 = rule visual.fill base(layer-2), border = visual.border, text = visual.text(neutral)", () => {
    const shapes = draw({
      props: { _parentTag: "DateField", _granularity: "day", _locale: "en-US" },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    expect((rects(shapes)[0] as { fill?: string }).fill).toBe(
      "{color.layer-2}",
    );
    expect((borders(shapes)[0] as { color?: string }).color).toBe(
      "{color.border}",
    );
    expect((texts(shapes)[0] as { fill?: string }).fill).toBe(
      "{color.neutral}",
    );
  });

  it("segment text 는 whiteSpace:nowrap — CSS Group(white-space:nowrap) 정합, 줄바꿈 금지", () => {
    // Skia 는 box+text+icon 을 한 노드에 그려, box width:100%(부모폭)일 때 좁은 폭에서
    //   text 가 maxWidth 로 줄바꿈됨. CSS Group 은 white-space:nowrap 이라 한 줄 유지 →
    //   Skia text 도 nowrap 이어야 시각 정합(nodeRendererText: nowrap → layoutMaxWidth 무한).
    for (const parentTag of [
      "DateField",
      "TimeField",
      "DatePicker",
      "DateRangePicker",
    ]) {
      const shapes = draw({
        props: { _parentTag: parentTag, _granularity: "day", _locale: "en-US" },
        size: sizeMd,
        visual,
        style: undefined,
      })!;
      const t = texts(shapes)[0] as { whiteSpace?: string };
      expect(t.whiteSpace).toBe("nowrap");
    }
  });

  it("picker calendar icon x좌표는 containerWidth(box폭)에 의존하지 않는다 — text 뒤 좌측 기준", () => {
    // 2026-06-23 그룹B 통일(store 추가 없이 escape 내부 결합 풀기): 발산의 근본은
    //   icon x = containerWidth - padRight - ... (box폭 의존, 우측 기준). box폭이 실제
    //   Taffy box w 와 어긋나면 icon 이 box 밖으로 격침. Select(SelectIcon flex 배치)는
    //   icon 위치가 box폭 무관 → 발산 불가. 동형으로, icon 을 text 뒤 좌측 기준(box폭 무관)
    //   으로 배치하면 escape 내부 box폭↔icon좌표 결합이 사라진다.
    const narrow = draw({
      props: {
        _parentTag: "DatePicker",
        _granularity: "day",
        _locale: "en-US",
        _containerWidth: 100,
        style: { width: 100 },
      },
      size: sizeMd,
      visual,
      style: { width: 100 },
    })!;
    const wide = draw({
      props: {
        _parentTag: "DatePicker",
        _granularity: "day",
        _locale: "en-US",
        _containerWidth: 500,
        style: { width: 500 },
      },
      size: sizeMd,
      visual,
      style: { width: 500 },
    })!;
    const narrowIconX = (icons(narrow)[0] as { x?: number }).x;
    const wideIconX = (icons(wide)[0] as { x?: number }).x;
    // box폭 무관 — 두 값이 동일해야 한다 (text 뒤 좌측 기준 배치).
    expect(narrowIconX).toBe(wideIconX);
  });

  it("picker calendar icon 은 segment text 끝보다 오른쪽에 위치 (text 뒤 자연 배치)", () => {
    const shapes = draw({
      props: {
        _parentTag: "DatePicker",
        _granularity: "day",
        _locale: "en-US",
        _containerWidth: 300,
        style: { width: 300 },
      },
      size: sizeMd,
      visual,
      style: { width: 300 },
    })!;
    const t = texts(shapes)[0] as { x?: number };
    const ic = icons(shapes)[0] as { x?: number };
    // icon 의 x 는 text 시작점(paddingX)보다 충분히 오른쪽 (text 폭 + gap 이후).
    expect(ic.x!).toBeGreaterThan(t.x! + 40);
  });

  it("picker text maxWidth 는 containerWidth(box폭)에 묶이지 않는다 — nowrap 한 줄 유지", () => {
    // nowrap 이므로 maxWidth 가 box폭 기반이면 안 됨(좁은 box 에서 줄바꿈/clip 유발).
    //   maxWidth 미설정(undefined) 또는 text 폭 기반이어야 box폭 발산과 무관.
    const narrow = draw({
      props: {
        _parentTag: "DatePicker",
        _granularity: "day",
        _locale: "en-US",
        _containerWidth: 80,
        style: { width: 80 },
      },
      size: sizeMd,
      visual,
      style: { width: 80 },
    })!;
    const t = narrow.find((s) => s.type === "text") as {
      maxWidth?: number;
    };
    // maxWidth 가 설정돼 있다면 box폭(80)보다 작으면 안 됨 (box폭 의존 금지).
    if (t.maxWidth !== undefined) {
      expect(t.maxWidth).toBeGreaterThan(80);
    }
  });

  it("style override — backgroundColor/borderColor/color 사용자 설정 우선", () => {
    const shapes = draw({
      props: {
        _parentTag: "DateField",
        _granularity: "day",
        _locale: "en-US",
        style: {
          backgroundColor: "#fff",
          borderColor: "#f00",
          color: "#00f",
        },
      },
      size: sizeMd,
      visual,
      style: { backgroundColor: "#fff", borderColor: "#f00", color: "#00f" },
    })!;
    expect((rects(shapes)[0] as { fill?: string }).fill).toBe("#fff");
    expect((borders(shapes)[0] as { color?: string }).color).toBe("#f00");
    expect((texts(shapes)[0] as { fill?: string }).fill).toBe("#00f");
  });
});
