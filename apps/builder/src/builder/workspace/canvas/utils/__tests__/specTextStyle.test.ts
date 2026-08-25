import { describe, expect, test } from "vitest";
import {
  // Checkbox/Radio/Switch — ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): spec 삭제 →
  //   측정 parity oracle 을 spec.render.shapes → catalog rule(catalogTextOracle)로 전환 (Button/Badge 선례).
  buildCatalogShapes,
  resolveToken,
  type ComponentSpec,
  type TextShape,
  type TokenRef,
  type SizeSpec,
} from "@composition/specs";
import { extractSpecTextStyle } from "../specTextStyle";
import {
  resolveSkiaCatalogRenderInput,
  resolveSkiaRule,
  ruleSizeToSizeSpec,
} from "../../skia/resolveSkiaVisualRule";

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

  /** spec-free catalog type 의 측정 oracle: draw path 와 동일 rule/buildCatalogShapes 경로. */
  function catalogTextOracle(
    catalogType: string,
    sizeName: string,
    props: Record<string, unknown>,
  ): { fontSize: number; fontWeight: number; fontFamily: string } | null {
    const rule = resolveSkiaRule(catalogType);
    if (!rule) return null;
    const ruleSize =
      rule.sizes[sizeName] ?? rule.sizes[rule.defaultSize ?? "md"];
    if (!ruleSize) return null;
    const size = ruleSizeToSizeSpec(ruleSize) as SizeSpec;
    const { visual, paint } = resolveSkiaCatalogRenderInput(
      catalogType,
      props,
      "default",
    );
    const shapes = buildCatalogShapes(visual, paint, props, size);
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
  // ADR-912 box+text leaf 군 (2026-06-11): Button/Badge/ToggleButton.spec 삭제 → legacy oracle
  //   소멸 → specFreeCatalogCases(catalog rule oracle)로 이전. Link 선례 동형.
  const boxTextCutoverCases: Array<{
    tag: string;
    spec: ComponentSpec<Record<string, unknown>>;
    size: string;
  }> = [];

  const specFreeCatalogCases: Array<{
    tag: string;
    catalogType: string;
    size: string;
  }> = [
    { tag: "link", catalogType: "Link", size: "md" },
    { tag: "button", catalogType: "Button", size: "md" },
    { tag: "badge", catalogType: "Badge", size: "sm" },
    { tag: "togglebutton", catalogType: "ToggleButton", size: "md" },
    // ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): Checkbox/Radio/Switch.spec 삭제 →
    //   replace-mode oracle(spec.render.shapes) 소멸 → catalog rule oracle 로 이전. rule variant
    //   textWeight:400 명시로 측정도 400 산출 → drift 0 (Button/Badge 동형).
    { tag: "checkbox", catalogType: "Checkbox", size: "md" },
    { tag: "radio", catalogType: "Radio", size: "md" },
    { tag: "switch", catalogType: "Switch", size: "md" },
  ];

  for (const { tag, spec, size } of boxTextCutoverCases) {
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

  for (const { tag, catalogType, size } of specFreeCatalogCases) {
    test(`${tag}: 측정 결과가 catalog rule oracle 과 fontSize/fontWeight/fontFamily 일치`, () => {
      const props = { size, children: "Sample" };
      const measured = extractSpecTextStyle(tag, props);
      const oracle = catalogTextOracle(catalogType, size, props);

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
    for (const { tag } of [...boxTextCutoverCases, ...specFreeCatalogCases]) {
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
 * (text-xs lineHeight 16 vs 18, Text fontWeight 400 vs 500, Heading 600 vs 500 등).
 *
 * oracle = spec.render.shapes 가 emit 하는 TextShape 의 lineHeight(px)/fontWeight/fontSize.
 * **모든 size(xs~3xl)에서 일치해야 drift 0** — buildCatalogShapes lineHeight 보강 +
 * rule textWeight(Text 400 / Heading 600 / Paragraph 400) 의 결정적 증명.
 * (2026-06-24: Heading textWeight 700→600 — 부모 컨텍스트 Heading factory inline 600 정합,
 *  measure 가 실제 렌더 fontWeight 와 일치해야 텍스트 폭 계산 정확)
 */
describe("extractSpecTextStyle — TEXT_LEAF catalog 측정 drift 0 (ADR-912 위험군 해소)", () => {
  /**
   * ADR-912 단계5 step4: oracle 을 spec.render.shapes → **catalog rule 기반**
   * (resolveSkiaRule + buildCatalogShapes)으로 전환. spec 파일 삭제 후에도 동작하며,
   * measure 함수(extractSpecTextStyle)의 rule wiring(size/variant/textWeight/fontFamily
   * 해석)이 동일 rule SSOT 를 정확히 소비하는지 검증한다 (rule→buildCatalogShapes 직접 경로
   * vs measure 경로 일치 = wiring 정합).
   */
  function textLeafOracle(
    catalogType: string,
    sizeName: string,
  ): {
    lineHeight: number;
    fontWeight: number;
    fontSize: number;
    fontFamily: string;
  } | null {
    const rule = resolveSkiaRule(catalogType);
    if (!rule) return null;
    const ruleSize =
      rule.sizes[sizeName] ?? rule.sizes[rule.defaultSize ?? "md"];
    if (!ruleSize) return null;
    const size = ruleSizeToSizeSpec(ruleSize) as SizeSpec;
    const props = { size: sizeName, children: "Sample" };
    const { visual, paint } = resolveSkiaCatalogRenderInput(
      catalogType,
      props,
      "default",
    );
    const shapes = buildCatalogShapes(visual, paint, props, size);
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

  // tag(measure key) → catalogType (rule 조회 key). measure 함수와 동일 매핑.
  const TEXT_LEAF_CASES: Array<{ tag: string; catalogType: string }> = [
    { tag: "text", catalogType: "Text" },
    { tag: "heading", catalogType: "Heading" },
    { tag: "paragraph", catalogType: "Paragraph" },
    // box형 mono — fontFamily generic 보강 검증 포함
    { tag: "code", catalogType: "Code" },
    { tag: "kbd", catalogType: "Kbd" },
  ];
  const TEXT_SIZES = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl"];

  for (const { tag, catalogType } of TEXT_LEAF_CASES) {
    for (const size of TEXT_SIZES) {
      test(`${tag} size=${size}: catalog 측정(lineHeight/fontWeight/fontSize)이 rule oracle 과 일치(drift 0)`, () => {
        const measured = extractSpecTextStyle(tag, {
          size,
          children: "Sample",
        });
        const oracle = textLeafOracle(catalogType, size);

        expect(measured, `${tag} ${size} measured`).not.toBeNull();
        expect(oracle, `${tag} ${size} oracle`).not.toBeNull();
        // lineHeight: px number, typography 토큰값 (fontSize*1.5 fallback 아님)
        expect(typeof measured!.lineHeight, `${tag} ${size} lh type`).toBe(
          "number",
        );
        expect(measured!.lineHeight, `${tag} ${size} lineHeight drift`).toBe(
          oracle!.lineHeight,
        );
        // fontWeight: rule textWeight 값 (500 fallback 아님 — Text/Para 400, Heading 600)
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

  test("Heading 은 fontWeight 600(rule textWeight), Text/Paragraph 는 400", () => {
    // 2026-06-24: Heading textWeight 700→600 (부모 컨텍스트 Heading factory inline 600 정합).
    expect(
      extractSpecTextStyle("heading", { size: "md", children: "x" })!
        .fontWeight,
    ).toBe(600);
    expect(
      extractSpecTextStyle("text", { size: "md", children: "x" })!.fontWeight,
    ).toBe(400);
    expect(
      extractSpecTextStyle("paragraph", { size: "md", children: "x" })!
        .fontWeight,
    ).toBe(400);
  });
});

/**
 * ADR-912 위험군 해소 — Label catalog 렌더 drift 0 (선행-6, 2026-06-04).
 *
 * Label 은 TEXT_LEAF(Text/Heading) 와 시각 source 동형이지만 measure 경로가 다르다 —
 * size/lineHeight 는 fullTreeLayout DFS injection(LABEL_SIZE_STYLE, spec/extractSpecTextStyle
 * 미경유)으로 처리되므로 위 TEXT_LEAF 측정 drift 테스트 대상이 아니다. 대신 **Skia 렌더 경로**
 * (catalog 전환 후 buildCatalogShapes) 가 그리는 Label text shape 가 LabelSpec.render.shapes 와
 * fontWeight(600)/lineHeight/fontSize drift 0 인지 검증한다 — 그리기 SSOT 일치.
 *
 * **catalog 전환 안전 근거**: Label rule(variants.default.textWeight=600 +
 * sizes[*].lineHeight={typography.*--line-height}) 보강으로 buildCatalogShapes generic 이
 * spec render.shapes 기본값(fontWeight 600 + getLabelLineHeight=동일 typography 토큰)과 일치.
 * 부모 의존 4단계 변형(label/necessity/align)은 dispatch 이전 specProps 단이라 catalog 직교(보존).
 */
describe("buildCatalogShapes — Label catalog 렌더 drift 0 (ADR-912 선행-6)", () => {
  // ADR-912 box+text leaf 군 (2026-06-11): Label.spec 삭제 → labelSpecOracle(spec.render.shapes)
  //   소멸. catalog 렌더의 불변(fontWeight 600 / align left / lineHeight non-null / fontSize>0)을
  //   절대값으로 직접 단언(legacy spec 대조 → catalog-only 검증). rule = componentRulesTable.Label SSOT.

  /** catalog 경로: resolveSkiaVisualRule + buildCatalogShapes 가 그리는 Label text shape. */
  function labelCatalogText(sizeName: string): {
    fontWeight: number;
    lineHeight: number | null;
    fontSize: number;
    align: string | undefined;
  } | null {
    const rule = resolveSkiaRule("Label");
    const ruleSize = rule?.sizes[sizeName];
    if (!ruleSize) return null;
    const sizeSpec = ruleSizeToSizeSpec(ruleSize) as SizeSpec;
    const props = { size: sizeName, children: "Sample" };
    const { visual, paint } = resolveSkiaCatalogRenderInput(
      "Label",
      props,
      "default",
    );
    const shapes = buildCatalogShapes(visual, paint, props, sizeSpec);
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
    } else if (typeof rawLh === "string") {
      const n = parseInt(rawLh as string, 10);
      lh = Number.isNaN(n) ? null : n;
    }
    const fw = t.fontWeight;
    return {
      fontWeight: typeof fw === "number" ? fw : parseInt(String(fw), 10) || 400,
      lineHeight: lh,
      fontSize: t.fontSize,
      align: t.align,
    };
  }

  const LABEL_SIZES = ["xs", "sm", "md", "lg", "xl"];

  for (const size of LABEL_SIZES) {
    test(`Label size=${size}: catalog 렌더 불변(fontWeight 600 / align left / lineHeight·fontSize 유효)`, () => {
      const catalog = labelCatalogText(size);
      expect(catalog, `${size} catalog`).not.toBeNull();
      // fontWeight: rule textWeight 600 (buildCatalogShapes 500 fallback 아님)
      expect(catalog!.fontWeight, `Label ${size} fontWeight=600`).toBe(600);
      // lineHeight: typography 토큰 px (fontSize*1.5 fallback 아님 → non-null)
      expect(
        catalog!.lineHeight,
        `Label ${size} lineHeight non-null`,
      ).not.toBeNull();
      expect(
        catalog!.lineHeight!,
        `Label ${size} lineHeight>0`,
      ).toBeGreaterThan(0);
      // fontSize: 동일 typography 토큰 (유효 px)
      expect(catalog!.fontSize, `Label ${size} fontSize>0`).toBeGreaterThan(0);
      // align: height=0 transparent inline → "left" (hasOpaqueBg 보강으로 center drift 정정).
      expect(catalog!.align, `Label ${size} align=left`).toBe("left");
    });
  }
});

/**
 * ADR-912 위험군 해소 — TEXT_LEAF/box leaf align/baseline drift 0 (선행-6 hasOpaqueBg 보강).
 *
 * buildCatalogShapes 의 `isInlineText` 판정이 `{color.transparent}` fill 을 box(center/middle)로
 * 오판하던 것을 `hasOpaqueBg`(보이는 배경) 기준으로 보강. height=0 transparent inline leaf
 * (Text/Heading/Paragraph/Label)는 left/top, height>0 box(Code/Kbd)는 center/middle 로 spec
 * render.shapes 와 align/baseline 정합. box 그리기(hasVisibleBg)는 미변경 → transparent 컨테이너
 * (ToggleButtonGroup/Switch/GridList/Modal) roundRect 보존(회귀 0, live 검증).
 */
describe("buildCatalogShapes — TEXT_LEAF/box align·baseline drift 0 (ADR-912 선행-6)", () => {
  function catalogTextAlign(type: string): {
    align: string | undefined;
    baseline: string | undefined;
  } | null {
    const rule = resolveSkiaRule(type);
    const ruleSize = rule?.sizes.md;
    if (!ruleSize) return null;
    const sizeSpec = ruleSizeToSizeSpec(ruleSize) as SizeSpec;
    const props = { size: "md", children: "Sample" };
    const { visual, paint } = resolveSkiaCatalogRenderInput(
      type,
      props,
      "default",
    );
    const shapes = buildCatalogShapes(visual, paint, props, sizeSpec);
    const t = shapes.find(
      (s): s is TextShape & { type: "text" } => s.type === "text",
    );
    if (!t) return null;
    return { align: t.align, baseline: t.baseline };
  }

  // height=0 transparent inline → left (Label baseline 은 height=0 무영향이라 top 허용)
  const INLINE_LEAF = ["Text", "Heading", "Paragraph", "Label"];
  for (const type of INLINE_LEAF) {
    test(`${type}: height=0 transparent inline → align=left (center drift 정정)`, () => {
      const r = catalogTextAlign(type);
      expect(r, `${type} text shape`).not.toBeNull();
      expect(r!.align, `${type} align`).toBe("left");
    });
  }

  // height>0 box → center/middle (Code/Kbd spec render.shapes 와 일치)
  const BOX_LEAF = ["Code", "Kbd"];
  for (const type of BOX_LEAF) {
    test(`${type}: height>0 box → align=center/baseline=middle (box 유지)`, () => {
      const r = catalogTextAlign(type);
      expect(r, `${type} text shape`).not.toBeNull();
      expect(r!.align, `${type} align`).toBe("center");
      expect(r!.baseline, `${type} baseline`).toBe("middle");
    });
  }
});
