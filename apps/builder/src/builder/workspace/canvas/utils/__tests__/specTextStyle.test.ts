import { describe, expect, test } from "vitest";
import {
  ButtonSpec,
  BadgeSpec,
  ToggleButtonSpec,
  LinkSpec,
  CheckboxSpec,
  RadioSpec,
  SwitchSpec,
  TextSpec,
  HeadingSpec,
  ParagraphSpec,
  CodeSpec,
  KbdSpec,
  resolveToken,
  type ComponentSpec,
  type TextShape,
  type TokenRef,
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

/**
 * ADR-912 위험군 해소 — TEXT_LEAF catalog 등록 후 측정 drift 0 (2026-06-04).
 *
 * Text/Heading/Paragraph 는 catalog 등록(`cutover:"catalog"` + `catalogType`)으로 측정 source 가
 * spec.render.shapes → buildCatalogShapes(rule 기반)로 전환됐다. **height=0 순수 TEXT_LEAF**
 * 라 lineHeight 가 layout height 본질이므로, buildCatalogShapes lineHeight/textWeight push 가
 * 없으면 catalog 측정이 fontSize*1.5 / fontWeight 500 fallback 으로 떨어져 spec 과 drift 한다
 * (text-xs lineHeight 16 vs 18, Text fontWeight 400 vs 500, Heading 700 vs 500 등).
 *
 * oracle = spec.render.shapes 가 emit 하는 TextShape 의 lineHeight(px)/fontWeight/fontSize.
 * **모든 size(xs~3xl)에서 일치해야 drift 0** — buildCatalogShapes lineHeight 보강 +
 * rule textWeight(Text 400 / Heading 700 / Paragraph 400) 의 결정적 증명.
 */
describe("extractSpecTextStyle — TEXT_LEAF catalog 측정 drift 0 (ADR-912 위험군 해소)", () => {
  /** spec.render.shapes TextShape 에서 측정 oracle(lineHeight px / fontWeight / fontSize) 추출. */
  function textLeafOracle(
    spec: ComponentSpec<Record<string, unknown>>,
    sizeName: string,
  ): {
    lineHeight: number;
    fontWeight: number;
    fontSize: number;
    fontFamily: string;
  } | null {
    const size = spec.sizes[sizeName] ?? spec.sizes[spec.defaultSize];
    if (!size) return null;
    const shapes = spec.render.shapes(
      { size: sizeName, children: "Sample" },
      size,
      "default",
    );
    const t = shapes.find(
      (s): s is TextShape & { type: "text" } => s.type === "text",
    );
    if (!t) return null;
    let lh: number | null = null;
    const rawLh = t.lineHeight;
    if (typeof rawLh === "number") lh = rawLh;
    else if (typeof rawLh === "string" && (rawLh as string).startsWith("{")) {
      const r = resolveToken(rawLh as unknown as TokenRef);
      lh = typeof r === "number" ? r : null;
    }
    const fw = t.fontWeight;
    return {
      lineHeight: lh!,
      fontWeight: typeof fw === "number" ? fw : parseInt(String(fw), 10) || 400,
      fontSize: t.fontSize,
      fontFamily: t.fontFamily,
    };
  }

  const TEXT_LEAF_CASES: Array<{
    tag: string;
    spec: ComponentSpec<Record<string, unknown>>;
  }> = [
    { tag: "text", spec: TextSpec as ComponentSpec<Record<string, unknown>> },
    {
      tag: "heading",
      spec: HeadingSpec as ComponentSpec<Record<string, unknown>>,
    },
    {
      tag: "paragraph",
      spec: ParagraphSpec as ComponentSpec<Record<string, unknown>>,
    },
    // box형 mono — fontFamily generic 보강 검증 포함
    { tag: "code", spec: CodeSpec as ComponentSpec<Record<string, unknown>> },
    { tag: "kbd", spec: KbdSpec as ComponentSpec<Record<string, unknown>> },
  ];
  const TEXT_SIZES = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl"];

  for (const { tag, spec } of TEXT_LEAF_CASES) {
    for (const size of TEXT_SIZES) {
      test(`${tag} size=${size}: catalog 측정(lineHeight/fontWeight/fontSize)이 spec oracle 과 일치(drift 0)`, () => {
        const measured = extractSpecTextStyle(tag, {
          size,
          children: "Sample",
        });
        const oracle = textLeafOracle(spec, size);

        expect(measured, `${tag} ${size} measured`).not.toBeNull();
        expect(oracle, `${tag} ${size} oracle`).not.toBeNull();
        // lineHeight: px number, typography 토큰값 (fontSize*1.5 fallback 아님)
        expect(typeof measured!.lineHeight, `${tag} ${size} lh type`).toBe(
          "number",
        );
        expect(measured!.lineHeight, `${tag} ${size} lineHeight drift`).toBe(
          oracle!.lineHeight,
        );
        // fontWeight: rule textWeight 값 (500 fallback 아님 — Text/Para 400, Heading 700)
        expect(measured!.fontWeight, `${tag} ${size} fontWeight drift`).toBe(
          oracle!.fontWeight,
        );
        // fontSize: typography 토큰값
        expect(measured!.fontSize, `${tag} ${size} fontSize drift`).toBe(
          oracle!.fontSize,
        );
        // fontFamily: rule fontFamily 값 (sans fallback 아님 — Code/Kbd mono 검증)
        expect(measured!.fontFamily, `${tag} ${size} fontFamily drift`).toBe(
          oracle!.fontFamily,
        );
      });
    }
  }

  test("Heading 은 fontWeight 700(rule textWeight), Text/Paragraph 는 400", () => {
    expect(
      extractSpecTextStyle("heading", { size: "md", children: "x" })!
        .fontWeight,
    ).toBe(700);
    expect(
      extractSpecTextStyle("text", { size: "md", children: "x" })!.fontWeight,
    ).toBe(400);
    expect(
      extractSpecTextStyle("paragraph", { size: "md", children: "x" })!
        .fontWeight,
    ).toBe(400);
  });
});
