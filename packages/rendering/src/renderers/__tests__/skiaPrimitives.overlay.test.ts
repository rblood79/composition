import { describe, expect, it } from "vitest";

// ADR-912 단계5 step4 Dialog 단건 (2026-06-16): DialogSpec import 제거 — spec 삭제.
//   overlay_backdrop parity 는 draw fn 하드코딩 상수 절대값 단언으로 전환(spec oracle 불요).
// ADR-912 단계5 step4 Popover 단건 (2026-06-16): PopoverSpec import 제거 — spec 삭제. popover_arrow
//   parity 는 rule-mirror visual + 결정론적 절대값 단언으로 전환(Tooltip 전환 패턴).
// ADR-166 Phase 4 (2026-07-25): shadow primitive 2건 은퇴 → 절대값 단언이 부재 단언으로 바뀜(:370).
import { getSkiaPrimitive, getSkiaPrimitiveMode } from "./catalogPaintFixture";
import type { ComponentVisualRule, SizeSpec } from "../../types";
import type { Shape, TokenRef } from "../../types";

// arrow stroke = bg fill base. componentRulesTable.Popover surface(default) variant fill base.
//   popover_arrow stroke = style.backgroundColor ?? visual.fill.default.base.
const POPOVER_SURFACE_FILL_BASE = "{color.layer-2}" as TokenRef;
const popoverVisual = {
  fill: { default: { base: POPOVER_SURFACE_FILL_BASE } },
} as unknown as ComponentVisualRule;

/**
 * ADR-142 Inc3 family ⑥(overlays) — overlay 시각 패턴 draw module parity.
 *
 * **정본 (ADR-142 R4 / HC#11, 사용자 confirm 2026-06-01)**: portal/overlay 의 비-box+text
 * 시각(shadow / V-arrow / backdrop / dashed)은 `skiaPrimitive` draw module 이 그린다. 값은
 * module 내부 상수(현 render.shapes 하드코딩 1:1 이식) — spec runtime 참조 0(#8 충족),
 * ComponentRule 스키마 확장 불필요(theme 메타 이전은 ADR-142 미요구 over-engineering).
 *
 * draw module 의 합성 모드는 registry 메타(`getSkiaPrimitiveMode`)다. overlay 패턴 =
 * `"append"`(buildCatalogShapes box+text 출력에 합성), 기존 6 primitive(checkbox/radio/dot/
 * divider/icon_font/switch) = `"replace"`(box+text 대체, 불변). draw fn 시그니처는 기존과
 * 동일(`Shape[] | null`) — 기존 6 parity 테스트 무수정.
 *
 * 각 draw module 이 legacy render.shapes 의 해당 shape 와 완전 parity 임을 보장한다(회귀 0).
 *
 * **ADR-912 단계5 step4 Tooltip 단건 (2026-06-16)**: Tooltip.spec 삭제로 Tooltip oracle(spec.
 * render.shapes/spec.sizes) 소멸. tooltip_arrow 는 spec-free draw module(maxWidth=skiaPrimitives
 * 내부 인라인 TOOLTIP_ARROW_MAX_WIDTH) 이므로, legacy spec oracle 대신 **rule-mirror visual +
 * 결정론적 절대값**으로 단언(selection.test 전환 패턴). Popover/Dialog 는 spec 보존(미삭제) → oracle 유지.
 */

/** legacy render.shapes 출력에서 특정 type 의 shape 만 추출. */
function only(shapes: Shape[], ...types: string[]): Shape[] {
  return shapes.filter((s) => types.includes(s.type));
}

/**
 * ADR-187 (2026-05, `markPresentationBackground`): arrow 선은 툴팁/팝오버의 **배경색**으로
 * 긋기 때문에 background-fill presentation 드래그에 본체와 함께 따라와야 한다. 그래서
 * 두 arrow primitive 는 모든 line 에 `presentationRole: "background-fill"` 을 찍는다.
 * 좌표 기대값은 draw fn 좌표식 1:1 미러로 두고, 이 role 만 여기서 한 번에 씌운다.
 */
function asBackgroundFill(lines: Shape[]): Shape[] {
  return lines.map((line) => ({
    ...line,
    presentationRole: "background-fill",
  })) as unknown as Shape[];
}

// ADR-256 Phase 8a · 8e (2026-10-08): `tooltip_arrow` · `popover_arrow` 는 삭제됐다 — overlay 화살표는
//   `OverlayArrow` 노드 (사용자 승인). 아래 shadow 은퇴 블록이 둘의 부재도 가드한다.

// ADR-166 Phase 4 (2026-07-25): 구 `dialog_shadow` / `popover_shadow` 절대값 단언을 **부재 단언**으로
//   전환. 두 primitive 는 인자 무관 하드코딩 상수라 테마를 따르지 않았고, `target:"bg"` shadow 가
//   bg 추출 경로에서 삼켜져 캔버스 출력도 0이었다(실측). 그림자는 catalog `{shadow.*}` TokenRef
//   단일 채널로만 나간다 — 이 절대값 단언이 "primitive 가 살아 있다"는 인상을 준 것이 설계 문서의
//   잘못된 전제로 이어졌으므로, 값이 아니라 **registry 부재**를 가드한다.
describe("skiaPrimitive shadow 계열 은퇴 — 그림자는 catalog boxShadow 단일 채널", () => {
  it.each(["dialog_shadow", "popover_shadow"])(
    "'%s' 는 registry 에 없다 (재도입 시 catalog 그림자와 이중 그리기)",
    (key) => {
      expect(getSkiaPrimitive(key)).toBeUndefined();
    },
  );

  it("생존한 overlay primitive 는 그림자가 아닌 것들뿐이다", () => {
    // backdrop(전체화면 암전) 은 box-shadow 로 표현 불가 → primitive 존치가 정당.
    expect(getSkiaPrimitive("overlay_backdrop")).toBeDefined();
  });

  it.each(["tooltip_arrow", "popover_arrow"])(
    "'%s' 는 registry 에 없다 (ADR-256 Phase 8a — 화살표는 OverlayArrow 노드)",
    (key) => {
      expect(getSkiaPrimitive(key)).toBeUndefined();
    },
  );
});

describe("skiaPrimitive 'overlay_backdrop' — Dialog backdrop parity", () => {
  const draw = getSkiaPrimitive("overlay_backdrop");

  it("registry 에 prepend 모드로 등록되어 있다(backdrop=base 앞)", () => {
    expect(draw).toBeDefined();
    expect(getSkiaPrimitiveMode("overlay_backdrop")).toBe("prepend");
  });

  // ADR-912 단계5 step4 Dialog 단건 (2026-06-16): Dialog.spec 삭제로 spec oracle 소멸. overlay_backdrop
  //   draw fn 은 인자 무관 하드코딩 상수(`() => [rect]`) → 결정론적 절대값 단언 (Tooltip 전환 패턴).
  it("Dialog backdrop(rect -9999..99999, rgba(0,0,0,0.5)) — 결정론적 절대값", () => {
    const shapes = draw!({
      props: {},
      size: {} as never,
      visual: undefined,
      style: undefined,
    });
    expect(shapes).toEqual([
      {
        type: "rect",
        x: -9999,
        y: -9999,
        width: 99999,
        height: 99999,
        fill: "rgba(0, 0, 0, 0.5)",
        fillAlpha: 0.5,
      },
    ]);
  });
});

describe("기존 6 primitive 는 replace 모드 (불변)", () => {
  for (const key of [
    "checkbox",
    "radio",
    "dot",
    "divider",
    "icon_font",
    "switch_toggle",
  ]) {
    it(`${key} — replace 모드`, () => {
      expect(getSkiaPrimitiveMode(key)).toBe("replace");
    });
  }
});
