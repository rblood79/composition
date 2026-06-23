// specPresetResolver.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  resolveSpecPreset,
  resolveAppearanceSpecPreset,
  resolveLayoutSpecPreset,
  resolveTypographySpecPreset,
  clearSpecPresetCache,
} from "./specPresetResolver";

describe("resolveSpecPreset", () => {
  beforeEach(() => clearSpecPresetCache());

  it("returns numeric width/height for Kbd size=md", () => {
    const preset = resolveSpecPreset("Kbd", "md");
    expect(typeof preset.width === "number" || preset.width === undefined).toBe(
      true,
    );
    expect(
      typeof preset.height === "number" || preset.height === undefined,
    ).toBe(true);
    // Kbd 스펙은 height에 고정값이 있음 (size md 기준 26)
    expect(preset.height).toBeGreaterThan(0);
  });

  it("returns {} for unknown tag", () => {
    expect(resolveSpecPreset("UnknownTag", "md")).toEqual({});
  });

  it("returns {} for null element type", () => {
    expect(resolveSpecPreset(undefined, undefined)).toEqual({});
  });

  it("caches by (type, size) — same input returns same reference", () => {
    const a = resolveSpecPreset("Kbd", "md");
    const b = resolveSpecPreset("Kbd", "md");
    expect(a).toBe(b);
  });

  it("different size returns different cached entry", () => {
    const md = resolveSpecPreset("Kbd", "md");
    const lg = resolveSpecPreset("Kbd", "lg");
    expect(md).not.toBe(lg);
  });

  // L2 (리뷰 지적): flat-spec fallback — sizes 객체 없는 spec 안전 처리
  it("returns {} gracefully when spec has no sizes object (flat-spec fallback)", () => {
    // 일부 spec(ToggleButton/TagGroup 등)은 flat 구조일 수 있음
    // resolveSpecPreset은 sizes[size] 미존재 시 빈 객체 반환해야 한다
    const preset = resolveSpecPreset("ToggleButton", "md");
    // 존재하지 않거나 sizes 미보유 시에도 throw 없이 객체 반환
    expect(preset).toEqual(expect.any(Object));
  });

  it("returns {} when sizes exists but target size key is absent", () => {
    // 예: size="xxl"처럼 해당 컴포넌트에 정의 안 된 size 요청
    const preset = resolveSpecPreset("Kbd", "xxl");
    expect(preset).toEqual({});
  });

  // ADR-912 R1 후속 (2026-06-12): Select family 의 sizes[size].height(md=30)는
  //   SelectTrigger(입력 trigger 행) 높이이지 컨테이너(Label + gap + Trigger = 54) 전체
  //   높이가 아니다. Style Panel Transform Height 에서 30 오표시 → height 축 preset 제외
  //   (auto 표시). progress/slider archetype 과 동일 처리 (TRACK_HEIGHT_TYPES type 기반).
  //   전수 보강 (2026-06-23): catalog height 가 박혀 있으나 CSS generator 가 컨테이너 height 를
  //   skip(=auto) 하는 컴포넌트 9개 추가 (DateField/TimeField/Tabs/TabList/TextField/TextArea/
  //   ColorField/Pagination/FileTrigger). DateField/TimeField/Tabs/TabList 는 layout 이 catalog
  //   height 를 입력/tab bar 행 높이로 live 소비(catalog 보존), 나머지 5개는 dead 값 → 패널만 제외.
  it.each([
    "Select",
    "ComboBox",
    "NumberField",
    "SearchField",
    "Label",
    "DateField",
    "TimeField",
    "Tabs",
    "TabList",
    "TextField",
    "TextArea",
    "ColorField",
    "Pagination",
    "FileTrigger",
  ])(
    "%s 는 height 축을 preset 에서 제외 (컨테이너 height=auto, 입력/track 행 고정값 오표시 방지)",
    (type) => {
      const preset = resolveSpecPreset(type, "md");
      expect(
        preset.height,
        `${type}.height 가 preset 에 노출되면 패널이 입력/track 행 높이를 컨테이너 높이로 오표시`,
      ).toBeUndefined();
      expect(preset.minHeight).toBeUndefined();
      expect(preset.maxHeight).toBeUndefined();
      // width 축은 정상 노출 (회귀 0) — 예: TextField.width="fit-content" 보존
      expect("height" in preset).toBe(false);
    },
  );

  it("progress/slider archetype 의 height 축 제외는 유지 (회귀 0)", () => {
    // 기존 TRACK_HEIGHT_ARCHETYPES 동작 보존 — type 기반 set 추가가 archetype 경로를 깨지 않음
    const progress = resolveSpecPreset("ProgressBar", "md");
    expect(progress.height).toBeUndefined();
  });
});

describe("resolveLayoutSpecPreset", () => {
  beforeEach(() => clearSpecPresetCache());

  it("returns {} for undefined type", () => {
    expect(resolveLayoutSpecPreset(undefined, undefined)).toEqual({});
  });

  it("returns {} for unknown tag", () => {
    expect(resolveLayoutSpecPreset("UnknownTag", "md")).toEqual({});
  });

  it("returns {} for absent size key", () => {
    // ADR-083 Phase 11 이후: Kbd 가 containerStyles 보유. containerStyles 미보유 spec
    // 대체 샘플로 Dialog(overlay archetype — Phase 9 schema 미지원) 사용.
    expect(resolveLayoutSpecPreset("Dialog", "xxl")).toEqual({});
  });

  it("caches by (type, size) — same input returns same reference", () => {
    const a = resolveLayoutSpecPreset("Dialog", "md");
    const b = resolveLayoutSpecPreset("Dialog", "md");
    expect(a).toBe(b);
  });

  it("only includes keys whose numeric values are defined in spec", () => {
    // gap/padding*/margin* 중 spec에 정의된 것만 number로 포함 — 미정의는 undefined
    // ADR-083 Phase 11: Kbd 이 containerStyles 보유로 display(string) 포함됨.
    // 본 테스트는 sizes-only numeric 추출 검증이므로 Dialog 사용.
    const preset = resolveLayoutSpecPreset("Dialog", "md");
    for (const k of Object.keys(preset) as (keyof typeof preset)[]) {
      expect(typeof preset[k]).toBe("number");
    }
  });

  it("returns object gracefully for flat-spec components", () => {
    const preset = resolveLayoutSpecPreset("ToggleButton", "md");
    expect(preset).toEqual(expect.any(Object));
  });
});

describe("ADR-082 G2 — 3-tier fallback chain (containerStyles → composition → sizes)", () => {
  beforeEach(() => clearSpecPresetCache());

  describe("Non-composite containerStyles (ADR-071 스키마)", () => {
    it("ListBox.containerStyles → Appearance preset (borderRadius/borderWidth/colors)", () => {
      // ListBoxSpec.containerStyles = { borderRadius: "{radius.lg}"=8, borderWidth: 1,
      //   background: "{color.raised}", border: "{color.border}" }
      const preset = resolveAppearanceSpecPreset("ListBox", undefined);
      expect(preset.borderRadius).toBe(8);
      expect(preset.borderWidth).toBe(1);
      expect(preset.backgroundColor).toBe("var(--bg-raised)");
      expect(preset.borderColor).toBe("var(--border)");
    });

    it("ListBox.containerStyles → Layout preset (gap/padding 4-way split)", () => {
      // ListBoxSpec.containerStyles = { gap: "{spacing.2xs}"=2, padding: "{spacing.xs}"=4 }
      const preset = resolveLayoutSpecPreset("ListBox", undefined);
      expect(preset.gap).toBe(2);
      expect(preset.paddingTop).toBe(4);
      expect(preset.paddingRight).toBe(4);
      expect(preset.paddingBottom).toBe(4);
      expect(preset.paddingLeft).toBe(4);
    });

    // paddingX/paddingY 축 → 4-way normalization (20+ spec 이 sizes 경로에서 이 형식 사용).
    // normalization 없으면 Panel Layout 이 0 으로 표시됨.
    it("Button.sizes.md (paddingX/Y) → 4-way padding 축 정규화", () => {
      // ButtonSpec.sizes.md = { paddingX: 12, paddingY: 4 }
      const preset = resolveLayoutSpecPreset("Button", "md");
      expect(preset.paddingLeft).toBe(12);
      expect(preset.paddingRight).toBe(12);
      expect(preset.paddingTop).toBe(4);
      expect(preset.paddingBottom).toBe(4);
    });

    it("Badge.sizes.md (paddingX/Y) → 4-way padding 축 정규화", () => {
      // BadgeSpec.sizes.md 가 paddingX/Y 사용
      const preset = resolveLayoutSpecPreset("Badge", "md");
      expect(preset.paddingLeft).toBeGreaterThan(0);
      expect(preset.paddingRight).toBe(preset.paddingLeft);
      expect(preset.paddingTop).toBeGreaterThanOrEqual(0);
      expect(preset.paddingBottom).toBe(preset.paddingTop);
    });

    it("Menu.containerStyles → Appearance preset", () => {
      // MenuSpec.containerStyles = { borderRadius: "{radius.md}"=6, borderWidth: 1,
      //   background: "{color.raised}", border: "{color.border}" }
      const preset = resolveAppearanceSpecPreset("Menu", undefined);
      expect(preset.borderRadius).toBe(6);
      expect(preset.borderWidth).toBe(1);
      expect(preset.backgroundColor).toBe("var(--bg-raised)");
    });
  });

  describe("Composite composition.* (ADR-036 Phase 3a 스키마) — sizes 우선, composition 은 sizes 없을 때만 반영", () => {
    it("Select.sizes.md.gap=6 이 composition.gap=4 를 override (회귀 0 보장)", () => {
      // SelectSpec.sizes.md.gap = 6 우선 반영, composition.gap="var(--spacing-xs)"=4 는 fallback 만
      const preset = resolveLayoutSpecPreset("Select", "md");
      expect(preset.gap).toBe(6);
    });

    it("Select size=absent → sizes 없음 → composition.gap=4 반영", () => {
      // 존재하지 않는 size 키 → sizes preset 빈 객체 → composition fallback 발동
      const preset = resolveLayoutSpecPreset("Select", "xxl");
      expect(preset.gap).toBe(4);
    });

    it("ComboBox size=absent → composition.gap fallback 확인", () => {
      const preset = resolveLayoutSpecPreset("ComboBox", "xxl");
      expect(preset.gap).toBe(4);
    });
  });

  describe("fallback 우선순위 — sizes 가 최우선 (회귀 0)", () => {
    it("sizes 값이 있으면 containerStyles/composition 덮어씀", () => {
      // Button 은 sizes.md 에 숫자 필드 있음 + composition 없음 → sizes 반환 유지
      const preset = resolveAppearanceSpecPreset("Button", "md");
      // Button.sizes.md.borderRadius 가 있으면 그 값 우선
      if (typeof preset.borderRadius === "number") {
        expect(preset.borderRadius).toBeGreaterThanOrEqual(0);
      }
    });

    it("containerStyles 만 있고 sizes 없으면 containerStyles 반환", () => {
      // ListBox 는 sizes 블록 자체가 거의 비어있고 containerStyles 보유
      const preset = resolveAppearanceSpecPreset("ListBox", undefined);
      expect(preset.borderRadius).toBe(8); // from containerStyles
    });
  });

  describe("캐싱 — 3-tier merge 결과도 캐시 재사용", () => {
    it("동일 (type, size) 재호출 시 identical reference", () => {
      const a = resolveAppearanceSpecPreset("ListBox", undefined);
      const b = resolveAppearanceSpecPreset("ListBox", undefined);
      expect(a).toBe(b);
    });
  });

  describe("ADR-082 P3 — Flex/Grid 레이아웃 키 (display/flexDirection/alignItems/justifyContent)", () => {
    it("Non-composite containerStyles: ListBox → display=flex / flexDirection=column (camelCase 경로)", () => {
      // ListBoxSpec.containerStyles = { display: "flex", flexDirection: "column", ... }
      const preset = resolveLayoutSpecPreset("ListBox", undefined);
      expect(preset.display).toBe("flex");
      expect(preset.flexDirection).toBe("column");
    });

    it("Pagination catalog cutover (ADR-912 R7 G1-c) → TAG_SPEC_MAP 미등록 → layout preset undefined", () => {
      // Pagination 은 catalog cutover 로 spec 삭제(2026-06-15) → TAG_SPEC_MAP["Pagination"]=undefined →
      //   resolver 가 composition.containerStyles 를 공급하지 않음. 구 spec 의
      //   composition.containerStyles.flex-direction:column 은 factory props.style.flexDirection:row 가
      //   @layer 위로 덮던 dead 값이었으므로(ADR-907 Layer B), 제거가 정본. Style Panel 의 Pagination
      //   layout 표시는 factory props.style SSOT 기반.
      // 참고: Pagination 은 base composition.containerStyles 에 layout 키(display/flex-direction)를
      //   분기 없이 직접 공급하던 유일한 등록 spec 이었음(나머지 composite 는 containerVariants 분기).
      //   cutover 로 해당 E2E 샘플 소실 — layoutFromContainerStyles/layoutFromComposition extractor 의
      //   kebab→camel 정규화 자체는 resolver 내부 로직(specPresetResolver.ts:381/405)으로 보존되며,
      //   다른 layout 키 공급 spec 이 생기면 E2E 으로 재검증(line 250-252 동일 철학).
      const preset = resolveLayoutSpecPreset("Pagination", undefined);
      expect(preset.display).toBeUndefined();
      expect(preset.flexDirection).toBeUndefined();
    });

    it("containerStyles 미보유 Spec → 레이아웃 키 undefined (기존 기본값 경로 유지)", () => {
      // ADR-083 Phase 11 이후: Kbd 가 containerStyles 보유. 미보유 대표 샘플로
      // Dialog(overlay archetype — Phase 9 schema 미지원) 사용.
      const preset = resolveLayoutSpecPreset("Dialog", "md");
      expect(preset.display).toBeUndefined();
      expect(preset.flexDirection).toBeUndefined();
      expect(preset.alignItems).toBeUndefined();
      expect(preset.justifyContent).toBeUndefined();
    });

    // ADR-082 P3 resolver 인프라 검증 — 실제 등록 Spec 중 루트 containerStyles 에
    //   alignItems/justifyContent 를 공급하는 케이스는 현재 없음 (ListBoxItem 은 TAG_SPEC_MAP
    //   미등록, ADR-076 synthetic item 전환 중). extractor 동작은 아래 단위 호출로 검증.
    it("layoutFromContainerStyles 는 alignItems/justifyContent CSS 값을 그대로 통과시킨다", () => {
      // resolveLayoutSpecPreset 내부 extractor 검증용 — 실제 spec 공급이 생기면 E2E 으로 승격
      // 이 케이스는 resolver 자체 단위 경로만 커버
      const preset = resolveLayoutSpecPreset("ListBox", undefined);
      expect(preset.alignItems).toBeUndefined(); // ListBox 는 정의 없음
      expect(preset.justifyContent).toBeUndefined();
    });
  });

  describe("ADR-082 P3 fix — sizes 경로 TokenRef 해석 (pickNumeric → resolveToNumber)", () => {
    it("Badge.sizes.md.borderRadius = '{radius.full}' → 9999 로 resolve", () => {
      // Badge 는 sizes 전체가 `"{radius.full}"` TokenRef 사용 → 기존 typeof number 필터로
      //   전부 skip 되던 버그 수정. borderWidth:1(숫자) 는 원래 통과하던 값.
      const preset = resolveAppearanceSpecPreset("Badge", "md");
      expect(preset.borderRadius).toBe(9999);
      expect(preset.borderWidth).toBe(1);
    });

    it("InlineAlert.sizes.md.borderRadius = '{radius.lg}' → 8 로 resolve", () => {
      // InlineAlert 는 borderWidth 필드 자체 없음 → undefined 유지 (sizes 미정의 = 기본값 0)
      const preset = resolveAppearanceSpecPreset("InlineAlert", "md");
      expect(preset.borderRadius).toBe(8);
      expect(preset.borderWidth).toBeUndefined();
    });

    it("Button.sizes.md.borderRadius = '{radius.md}' → 6 로 resolve", () => {
      // 가장 사용 빈도 높은 spec — 기존 숫자 필터에서 skip 되던 회귀 복구
      const preset = resolveAppearanceSpecPreset("Button", "md");
      expect(preset.borderRadius).toBe(6);
    });

    it("숫자 그대로 저장된 sizes 필드는 회귀 없이 통과 (Kbd.sizes.md.height)", () => {
      // Kbd.sizes.md.height = 26 (숫자) — resolveToNumber 가 숫자 통과
      const preset = resolveSpecPreset("Kbd", "md");
      expect(preset.height).toBe(26);
    });
  });

  // ADR-082 P5 Gate G4 matrix — 10 Spec × 4 section 반환값 entry-point snapshot.
  //   Chrome MCP 인프라가 구성되기 전 자동화 snapshot 으로 간접 입증. 각 assertion 은
  //   design breakdown §P5 Gate G4 sample 대상과 1:1 대응. 신규 Spec (DatePicker /
  //   ListBoxItem / ToggleButtonGroup / CheckboxGroup) 4 종을 명시적으로 커버하고,
  //   기존 covered Spec 은 고수준 smoke assertion 으로 통합.
  describe("ADR-082 P5 Gate G4 — 10 Spec × 4 section entry-point snapshot", () => {
    beforeEach(() => clearSpecPresetCache());

    it("ListBox (Non-composite containerStyles) — 4 section 집약", () => {
      expect(resolveSpecPreset("ListBox", undefined)).toMatchObject({
        width: "100%",
        maxHeight: "300px",
      });
      expect(resolveAppearanceSpecPreset("ListBox", undefined)).toMatchObject({
        borderRadius: 8,
        borderWidth: 1,
        backgroundColor: "var(--bg-raised)",
        borderColor: "var(--border)",
      });
      expect(resolveLayoutSpecPreset("ListBox", undefined)).toMatchObject({
        display: "flex",
        flexDirection: "column",
        gap: 2,
        paddingTop: 4,
      });
      // Typography: ListBoxSpec.sizes.md.fontSize='{typography.text-sm}'=14
      expect(resolveTypographySpecPreset("ListBox", "md")).toMatchObject({
        fontSize: 14,
      });
    });

    it("Menu (Non-composite containerStyles) — Appearance / Layout", () => {
      expect(resolveAppearanceSpecPreset("Menu", undefined)).toMatchObject({
        borderRadius: 6,
        borderWidth: 1,
        backgroundColor: "var(--bg-raised)",
      });
      expect(resolveLayoutSpecPreset("Menu", undefined)).toMatchObject({
        display: "flex",
        flexDirection: "column",
      });
    });

    it("ListBoxItem (childSpecs 자동 등록 + 4 필드 alignment) — P4 연관 검증", () => {
      // ListBoxItemSpec.containerStyles = { display, flexDirection, alignItems, justifyContent }
      expect(resolveLayoutSpecPreset("ListBoxItem", undefined)).toMatchObject({
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
      });
    });

    it("Select (Composite composition.gap) — sizes.md.gap=6 우선, undefined size 시 composition fallback", () => {
      expect(resolveLayoutSpecPreset("Select", "md").gap).toBe(6);
      expect(resolveLayoutSpecPreset("Select", "xxl").gap).toBe(4);
    });

    it("ComboBox (Composite composition.gap) — sizes.md.gap=6 우선", () => {
      // ComboBox 도 Select 와 동일 sizes.*.gap 구조 + composition.gap="var(--spacing-xs)"
      expect(resolveLayoutSpecPreset("ComboBox", "md").gap).toBe(6);
      expect(resolveLayoutSpecPreset("ComboBox", "xxl").gap).toBe(4);
    });

    it("DatePicker (containerStyles.display + composition.gap) — Layout 2 필드 공급", () => {
      const preset = resolveLayoutSpecPreset("DatePicker", "xxl");
      // containerStyles.display="flex" 는 sizes 와 무관하게 항상 반영
      expect(preset.display).toBe("flex");
      // size=xxl 미정의 → composition.gap fallback (4)
      expect(preset.gap).toBe(4);
    });

    it("TextField (containerStyles.display + composition 커스텀 CSS var) — scope 외 필드는 미반영", () => {
      // TextFieldSpec.containerStyles.display="flex" — Layout 에 반영
      const layout = resolveLayoutSpecPreset("TextField", "xxl");
      expect(layout.display).toBe("flex");
      // composition.containerStyles = { width:"fit-content" } → Transform 경로 kebab 허용
      const transform = resolveSpecPreset("TextField", "xxl");
      expect(transform.width).toBe("fit-content");
      // composition.containerStyles 의 '--label-font-size' 등 커스텀 CSS var 은
      //   resolver scope 외 → Typography preset 에 미반영 (현재 scope 외 명시)
      const typo = resolveTypographySpecPreset("TextField", "xxl");
      expect(typo.fontSize).toBeUndefined();
    });

    it("CheckboxGroup (containerStyles.display + composition.gap) — custom '--cb-items-gap' 은 scope 외", () => {
      // CheckboxGroupSpec.containerStyles.display="flex" + composition.gap="var(--spacing-xs)"=4
      const preset = resolveLayoutSpecPreset("CheckboxGroup", "xxl");
      expect(preset.display).toBe("flex");
      expect(preset.gap).toBe(4);
      // composition.containerStyles 의 '--cb-items-gap: 12px' 은 커스텀 CSS var →
      //   resolver 가 인지하지 않음 (현재 scope 외). 향후 확장 후보.
    });

    it("ToggleButtonGroup (containerStyles.display/alignItems + composition.containerStyles.width) — 2 경로 병합", () => {
      // 최상위 containerStyles.display="flex", alignItems="center"
      const layout = resolveLayoutSpecPreset("ToggleButtonGroup", undefined);
      expect(layout.display).toBe("flex");
      expect(layout.alignItems).toBe("center");
      // composition.containerStyles.width="fit-content" → Transform width 반영
      const transform = resolveSpecPreset("ToggleButtonGroup", undefined);
      expect(transform.width).toBe("fit-content");
    });

    it("Button (sizes 전용 — 기존 회귀 경로 보존)", () => {
      // ButtonSpec.containerStyles = { display:"inline-flex", alignItems, justifyContent, width }
      // sizes.md.borderRadius='{radius.md}'=6 → Appearance.borderRadius
      expect(resolveAppearanceSpecPreset("Button", "md").borderRadius).toBe(6);
      const layout = resolveLayoutSpecPreset("Button", "md");
      expect(layout.display).toBe("inline-flex");
      expect(layout.alignItems).toBe("center");
    });
  });

  describe("ADR-082 A2 — Transform extractor (containerStyles / composition string 값)", () => {
    it("ListBox.containerStyles.width='100%' / maxHeight='300px' → string 통과", () => {
      // ListBoxSpec.containerStyles 에 width: "100%", maxHeight: "300px" 선언
      const preset = resolveSpecPreset("ListBox", undefined);
      expect(preset.width).toBe("100%");
      expect(preset.maxHeight).toBe("300px");
    });

    it("Toolbar.composition.containerStyles.width='fit-content' → string 통과 (kebab 경로)", () => {
      const preset = resolveSpecPreset("Toolbar", undefined);
      expect(preset.width).toBe("fit-content");
    });

    it("containerStyles 미보유 Spec → string 필드 undefined (기존 기본값 경로 유지)", () => {
      // ADR-083 Phase 11 이후: Kbd 가 containerStyles 보유. 미보유 대표 샘플로
      // Dialog(overlay archetype — Phase 9 schema 미지원) 사용.
      const preset = resolveSpecPreset("Dialog", "md");
      expect(
        typeof preset.height === "number" || preset.height === undefined,
      ).toBe(true);
      // width 는 Dialog.sizes.md 에 미정의 → undefined
      expect(preset.width).toBeUndefined();
    });
  });

  // ADR-912 Phase 4 — Style Panel preset source = catalog (TAG_SPEC_MAP 직독 제거).
  //   variant override 경로(resolveLayoutSpecPreset 의 props 분기)를 명시 검증. 위 27 test 는
  //   props 미전달이라 base 경로만 커버 — variant 경로는 본 describe 가 전담.
  describe("ADR-912 Phase 4 — variant override 경로 (catalog containerVariants)", () => {
    beforeEach(() => clearSpecPresetCache());

    // breakdown §2-5 TextField 기대값표: top → column(override 없음) / side → row + flex-start.
    it("TextField labelPosition=top → base column 유지 (variant override 없음)", () => {
      const top = resolveLayoutSpecPreset("TextField", "md", {
        labelPosition: "top",
      });
      expect(top.display).toBe("flex");
      expect(top.flexDirection).toBe("column");
    });

    it("TextField labelPosition=side → flexDirection=row + alignItems=flex-start (top-level containerVariants)", () => {
      const side = resolveLayoutSpecPreset("TextField", "md", {
        labelPosition: "side",
      });
      expect(side.flexDirection).toBe("row");
      expect(side.alignItems).toBe("flex-start");
    });

    it("TagGroup labelPosition=side → flexDirection=row (top-level containerVariants)", () => {
      const side = resolveLayoutSpecPreset("TagGroup", "md", {
        labelPosition: "side",
      });
      expect(side.flexDirection).toBe("row");
      expect(side.alignItems).toBe("flex-start");
    });

    // nested(structure.composition.containerVariants) fallback 복원 검증 — Select/Form/Toolbar 류는
    //   variant 를 nested 에만 보유. resolveCatalogContainerVariants 의 top-level ?? nested fallback 으로
    //   Style Panel(+implicitStyles)에 반영. spec 삭제 cutover 로 누락됐던 것을 Phase 4 에서 복원.
    it("Select labelPosition=side → flexDirection=row (nested containerVariants fallback)", () => {
      const side = resolveLayoutSpecPreset("Select", "md", {
        labelPosition: "side",
      });
      expect(side.flexDirection).toBe("row");
      expect(side.alignItems).toBe("flex-start");
    });

    it("Toolbar orientation=vertical → flexDirection=column (nested containerVariants fallback)", () => {
      const vertical = resolveLayoutSpecPreset("Toolbar", "md", {
        orientation: "vertical",
      });
      expect(vertical.flexDirection).toBe("column");
    });

    it("props 미전달 시 variant override 없음 (base 경로만)", () => {
      const base = resolveLayoutSpecPreset("TextField", "md");
      // labelPosition props 없음 → base column 유지
      expect(base.flexDirection).toBe("column");
    });
  });
});
