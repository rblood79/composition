import { describe, expect, test } from "vitest";
import {
  ButtonSpec,
  BadgeSpec,
  ToggleButtonSpec,
  LinkSpec,
  CheckboxSpec,
  RadioSpec,
  SwitchSpec,
  type ComponentSpec,
  type TextShape,
} from "@composition/specs";
import { extractSpecTextStyle } from "../specTextStyle";

/**
 * A안 회귀 가드: TEXT_LEAF_TAGS(text/heading/paragraph/...) 의 size 변경이
 * layout height 로 전파되려면 extractSpecTextStyle 이 size 기준 fontSize 와
 * **px number 로 resolve 된 lineHeight** 를 반환해야 한다.
 *
 * 버그: Text 의 size 를 M→L 로 바꿔도 height 가 24px(=16*1.5) 로 고정.
 * 원인: layout 의 text leaf 경로가 spec size 를 읽지 않아 fontSize 16 fallback.
 */
describe("extractSpecTextStyle — TEXT_LEAF_TAGS size→fontSize/lineHeight (A안)", () => {
  test("text: md vs lg 는 fontSize/lineHeight 모두 size 를 따라 달라진다", () => {
    const md = extractSpecTextStyle("text", { size: "md", children: "x" });
    const lg = extractSpecTextStyle("text", { size: "lg", children: "x" });

    expect(md).not.toBeNull();
    expect(lg).not.toBeNull();

    // lineHeight 는 TokenRef 문자열이 아니라 px number 로 resolve 되어야 한다
    expect(typeof md!.lineHeight).toBe("number");
    expect(typeof lg!.lineHeight).toBe("number");

    // 토큰: text-base--line-height(24) < text-lg--line-height(28)
    expect(lg!.lineHeight!).toBeGreaterThan(md!.lineHeight!);

    // fontSize 도 size 를 반영 (text-base 16 < text-lg 18)
    expect(lg!.fontSize).toBeGreaterThan(md!.fontSize);
  });

  test("heading/paragraph/kbd/code 도 lineHeight 를 number 로 반환한다", () => {
    for (const tag of ["heading", "paragraph", "kbd", "code"]) {
      const md = extractSpecTextStyle(tag, { size: "md", children: "x" });
      expect(md, tag).not.toBeNull();
      expect(typeof md!.lineHeight, tag).toBe("number");
    }
  });
});

/**
 * ADR-912 단계 5 step 2 — text measurement spec 의존 끊기 parity.
 *
 * generic 발효 type(isCatalogSkiaCutover=true: Button/Badge/ToggleButton/Link/
 * Checkbox/Radio/Switch)의 extractSpecTextStyle 은 측정 source 를 **rule 기반**
 * buildCatalogShapes(resolveSkiaVisualRule)로 산출한다 — spec.render.shapes /
 * resolveComponentVisual(spec) 미참조(measurement 의 spec 의존 0, 그리기 dispatch 와 동일
 * rule SSOT).
 *
 * **replace-mode 포함 (step 2)**: 과거 checkbox/radio/switch 는 generic 측정의 fontWeight
 * fallback 500 ↔ spec label 미emit(400) drift 회피로 render.shapes 측정을 유지했으나,
 * Checkbox/Radio/Switch rule variant 에 textWeight:400 명시(componentRulesTable)로 rule 측정도
 * 400 산출 → drift 0. 따라서 replace 도 rule 기반 측정으로 전환.
 *
 * parity oracle: extractSpecTextStyle 결과의 fontSize/fontWeight/fontFamily 가
 * **render.shapes 가 emit 하는 TextShape 와 동일**해야 한다(시각 대칭 단일 진실). replace type 은
 * spec label fontWeight 미emit→400 이고 rule textWeight=400 이라 oracle(render.shapes)과 일치.
 */
describe("extractSpecTextStyle — generic 발효 type 측정 parity (ADR-912 선행)", () => {
  /** render.shapes 가 emit 하는 TextShape 에서 측정 필드를 직접 뽑는 oracle. */
  function shapesTextOracle(
    spec: ComponentSpec<Record<string, unknown>>,
    sizeName: string,
    props: Record<string, unknown>,
  ): { fontSize: number; fontWeight: number; fontFamily: string } | null {
    const size = spec.sizes[sizeName] ?? spec.sizes[spec.defaultSize];
    if (!size) return null;
    const shapes = spec.render.shapes(props, size, "default");
    const t = shapes.find(
      (s): s is TextShape & { type: "text" } => s.type === "text",
    );
    if (!t) return null;
    const fw = t.fontWeight;
    return {
      fontSize: t.fontSize,
      fontWeight:
        typeof fw === "number"
          ? fw
          : typeof fw === "string"
            ? parseInt(fw, 10) || 400
            : 400,
      fontFamily: t.fontFamily,
    };
  }

  /**
   * box+text 발효 type — 측정 source 가 buildCatalogShapes 로 전환됨.
   * buildCatalogShapes 가 그리는 text 와 render.shapes 의 text 가 폰트 속성 동일해야 함
   * (그리기·측정 SSOT 일치 = 시각 대칭).
   */
  const boxTextCutoverCases: Array<{
    tag: string;
    spec: ComponentSpec<Record<string, unknown>>;
    size: string;
  }> = [
    { tag: "button", spec: ButtonSpec, size: "md" },
    { tag: "badge", spec: BadgeSpec, size: "sm" },
    {
      tag: "togglebutton",
      spec: ToggleButtonSpec as ComponentSpec<Record<string, unknown>>,
      size: "md",
    },
    { tag: "link", spec: LinkSpec, size: "md" },
  ];

  /**
   * replace-mode skiaPrimitive type — step 2 에서 rule 기반 측정으로 전환됨.
   * rule variant textWeight:400 명시로 generic 측정도 spec label(미emit→400)과 일치(drift 0).
   */
  const replacePrimitiveCases: Array<{
    tag: string;
    spec: ComponentSpec<Record<string, unknown>>;
    size: string;
  }> = [
    { tag: "checkbox", spec: CheckboxSpec, size: "md" },
    { tag: "radio", spec: RadioSpec, size: "md" },
    { tag: "switch", spec: SwitchSpec, size: "md" },
  ];

  for (const { tag, spec, size } of [
    ...boxTextCutoverCases,
    ...replacePrimitiveCases,
  ]) {
    test(`${tag}: 측정 결과가 render.shapes oracle 과 fontSize/fontWeight/fontFamily 일치`, () => {
      const props = { size, children: "Sample" };
      const measured = extractSpecTextStyle(tag, props);
      const oracle = shapesTextOracle(spec, size, props);

      expect(measured, `${tag} measured`).not.toBeNull();
      expect(oracle, `${tag} oracle`).not.toBeNull();
      expect(measured!.fontSize, `${tag} fontSize`).toBe(oracle!.fontSize);
      expect(measured!.fontWeight, `${tag} fontWeight`).toBe(
        oracle!.fontWeight,
      );
      expect(measured!.fontFamily, `${tag} fontFamily`).toBe(
        oracle!.fontFamily,
      );
    });
  }

  test("box+text 발효 type 은 텍스트 측정이 비어있지 않다(fontSize > 0)", () => {
    for (const { tag } of [...boxTextCutoverCases, ...replacePrimitiveCases]) {
      const m = extractSpecTextStyle(tag, { size: "md", children: "x" });
      expect(m, tag).not.toBeNull();
      expect(m!.fontSize, tag).toBeGreaterThan(0);
    }
  });
});
