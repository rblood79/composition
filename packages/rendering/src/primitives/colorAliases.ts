/**
 * ADR-302 — 테마 색 역할 → (축, 사다리 단) alias 표 (Decision 2 · 4).
 *
 * 역할 토큰 (`{color.<key>}`) 하나마다 어느 축의 어느 사다리 단에서 오는지 적는다. 값은 이 표가 아니라
 * 사다리 (기본 preset = 설치된 `@adobe/spectrum-design-data` 의 primitive, 다른 preset = 생성) 가 준다.
 *
 * - `tone`    — Tone 의 gray 13단 (25 · 50 · 75 · 100 ~ 1000)
 * - `accent`  — tint (또는 사용자 hex) 의 16단 (100 ~ 1600)
 * - `status`  — status 4 의 고정 hue 사다리 (negative = red · informative = blue · positive = green · notice = orange)
 * - `hue`     — named hue 의 고정 사다리
 * - `constant` — 축 없음 (white · black · transparent · chart-categorical · overlay)
 *
 * `oracle` 은 design-data alias 이름 (G1 이 그 alias 가 가리키는 단 · 값과 대조한다). 없으면 S2 설치본의
 * 명시 단 (`source`) 이고 G1 은 사다리 primitive 값과 대조한다. 단 값이 문자열이면 그 모드의 상수.
 *
 * 위치: rendering primitives — seed (`colors.ts` ← `generated/spectrumThemeColors.ts`) 와 shared resolver 가 같이
 * 읽는다 (shared 는 rendering 을 import 하고 반대는 못 한다). 생성기: `scripts/generate-theme-colors.ts`.
 */

export type ColorAxis = "tone" | "accent" | "status" | "hue" | "constant";

/** 사다리 단 (number) 또는 그 모드의 상수 값 (string). */
export type ColorAliasStep = number | string;

export interface ColorAliasEntry {
  axis: ColorAxis;
  /** status · hue 축의 고정 사다리 이름 (design-data family). tone = gray · accent = tint 는 preset 이 정한다. */
  family?: string;
  light: ColorAliasStep;
  dark: ColorAliasStep;
  /** design-data alias 이름 — 있으면 G1 이 단 · 값을 그 alias 와 대조한다. */
  oracle?: string;
  /** oracle 이 없을 때의 출처 (S2 설치본 파일:라인 · 사용자 결정 · G0 역산). */
  source?: string;
}

const tone = (
  light: ColorAliasStep,
  dark: ColorAliasStep,
  ref: { oracle?: string; source?: string },
): ColorAliasEntry => ({ axis: "tone", light, dark, ...ref });

const accent = (
  light: number,
  dark: number,
  ref: { oracle?: string; source?: string },
): ColorAliasEntry => ({ axis: "accent", light, dark, ...ref });

const constant = (value: string, source: string): ColorAliasEntry => ({
  axis: "constant",
  light: value,
  dark: value,
  source,
});

/** status 4 의 고정 사다리 — Decision 1. */
export const STATUS_FAMILIES = {
  negative: "red",
  informative: "blue",
  positive: "green",
  notice: "orange",
} as const;

/**
 * named hue → design-data family. `gray` 는 tone 축 (Tone 사다리 — 아래 표에서 따로), `green-named` 는
 * green, 나머지는 같은 이름.
 */
export const NAMED_HUE_FAMILIES = {
  purple: "purple",
  yellow: "yellow",
  red: "red",
  orange: "orange",
  blue: "blue",
  indigo: "indigo",
  cyan: "cyan",
  pink: "pink",
  fuchsia: "fuchsia",
  magenta: "magenta",
  celery: "celery",
  chartreuse: "chartreuse",
  turquoise: "turquoise",
  seafoam: "seafoam",
  cinnamon: "cinnamon",
  brown: "brown",
  silver: "silver",
  "green-named": "green",
} as const;

/**
 * named hue 면의 단 — design-data `<hue>-background-color-default` 와 같은 값 (G1 대조). hover · pressed 는
 * 그 다음 단 (S2 `nextColorStop` — design-data 에 상태 alias 가 없다).
 */
const NAMED_HUE_STEPS: Record<
  keyof typeof NAMED_HUE_FAMILIES,
  readonly [number, number]
> = {
  purple: [900, 800],
  yellow: [400, 1100],
  red: [900, 800],
  orange: [600, 900],
  blue: [900, 800],
  indigo: [900, 800],
  cyan: [900, 800],
  pink: [900, 800],
  fuchsia: [900, 800],
  magenta: [900, 800],
  celery: [600, 900],
  chartreuse: [500, 1000],
  turquoise: [900, 800],
  seafoam: [900, 800],
  cinnamon: [900, 800],
  brown: [900, 800],
  silver: [900, 800],
  "green-named": [900, 800],
};

const next = (step: number, by = 100) => step + by;

function statusEntries(): Record<string, ColorAliasEntry> {
  const out: Record<string, ColorAliasEntry> = {};
  for (const [status, family] of Object.entries(STATUS_FAMILIES)) {
    const s = (
      light: number,
      dark: number,
      ref: { oracle?: string; source?: string },
    ): ColorAliasEntry => ({ axis: "status", family, light, dark, ...ref });
    const dd = (name: string) =>
      status === "negative" ? { oracle: `negative-${name}` } : undefined;
    // content — 글자 · 선 · fillBar (S2 `color.negative` = negative-content-color-default, 리뷰 h3)
    out[status] = s(
      900,
      900,
      dd("content-color-default") ?? {
        source: "negative-content-color-default 와 같은 단 (Decision 2)",
      },
    );
    out[`${status}-hover`] = s(
      1000,
      1000,
      dd("content-color-hover") ?? {
        source: "content 한 단 (hover = pressed)",
      },
    );
    out[`${status}-pressed`] = s(
      1000,
      1000,
      dd("content-color-down") ?? { source: "content 한 단 (hover = pressed)" },
    );
    // background — 정적 면 (S2 Badge · InlineAlert bold · Toast 의 `backgroundColor: <status>` =
    //   design-data `<status>-background-color-default` — notice 는 orange 600 · 900 + 검정 글자)
    out[`${status}-background`] = s(
      status === "notice" ? 600 : 900,
      status === "notice" ? 900 : 800,
      { oracle: `${status}-background-color-default` },
    );
    // visual — 점 · 막대 (S2 StatusLight `fill` · Meter.tsx:95 = `<status>-visual-color`)
    out[`${status}-visual`] = s(800, 900, {
      oracle: `${status}-visual-color`,
    });
    // fill — 상호작용 면. S2 에서 status 를 Button fill 로 쓰는 것은 negative 뿐 (Button.tsx:160)
    if (status === "negative") {
      out["negative-fill"] = s(900, 700, {
        source: "S2 Button.tsx:161 negative fill (light 900 · dark 700)",
      });
      out["negative-fill-hover"] = s(1000, 600, {
        source:
          "S2 Button.tsx:162 negative fill hover = pressed (light 1000 · dark 600)",
      });
    }
    out[`${status}-subtle`] = s(200, 300, {
      oracle: `${status}-subtle-background-color-default`,
    });
    // strong — subtle 면 위 글자 (rule 참조 0, G0 역산: Tailwind 900 / 200 ≈ Spectrum 1200)
    out[`${status}-strong`] = s(1200, 1200, {
      source: "G0 역산 — 지금 값 (Tailwind 900 · 200) 에 가장 가까운 단",
    });
    out[`${status}-strong-hover`] = s(1300, 1300, {
      source: "strong 한 단 (hover = pressed)",
    });
    out[`${status}-strong-pressed`] = s(1300, 1300, {
      source: "strong 한 단 (hover = pressed)",
    });
  }
  return out;
}

function namedHueEntries(): Record<string, ColorAliasEntry> {
  const out: Record<string, ColorAliasEntry> = {};
  for (const [hue, family] of Object.entries(NAMED_HUE_FAMILIES)) {
    const [l, d] = NAMED_HUE_STEPS[hue as keyof typeof NAMED_HUE_FAMILIES];
    const ddName = hue === "green-named" ? "green" : hue;
    const h = (
      light: number,
      dark: number,
      ref: { oracle?: string; source?: string },
    ): ColorAliasEntry => ({ axis: "hue", family, light, dark, ...ref });
    out[hue] = h(l, d, { oracle: `${ddName}-background-color-default` });
    out[`${hue}-hover`] = h(next(l), next(d), {
      source: "S2 nextColorStop (spectrum-theme.ts:164) — 한 단",
    });
    out[`${hue}-pressed`] = h(next(l), next(d), {
      source: "S2 nextColorStop (spectrum-theme.ts:164) — 한 단",
    });
    out[`${hue}-subtle`] = h(200, 300, {
      oracle: `${ddName}-subtle-background-color-default`,
    });
  }
  return out;
}

export const COLOR_ALIASES: Readonly<Record<string, ColorAliasEntry>> = {
  // ── 배경 층 (tone) — S2 createTheme backgroundColor (spectrum-theme.ts:808 ~ :812) ──
  base: tone(25, 25, { oracle: "background-base-color" }),
  "layer-1": tone(50, 50, { oracle: "background-layer-1-color" }),
  "layer-2": tone(25, 75, { oracle: "background-layer-2-color" }),
  pasteboard: tone(100, 25, { oracle: "background-pasteboard-color" }),
  elevated: tone(25, 75, { oracle: "background-elevated-color" }),

  // ── 글자 (tone) ──
  neutral: tone(800, 800, { oracle: "neutral-content-color-default" }),
  "neutral-content": tone(800, 800, {
    oracle: "neutral-content-color-default",
  }),
  "neutral-content-hover": tone(900, 900, {
    oracle: "neutral-content-color-hover",
  }),
  "neutral-subdued": tone(700, 700, {
    oracle: "neutral-subdued-content-color-default",
  }),
  "field-placeholder": tone(600, 600, {
    source: "S2 Field.tsx:347 placeholder gray-600",
  }),
  "disabled-content": tone(400, 400, { oracle: "disabled-content-color" }),

  // ── 진한 면 (tone) ──
  "neutral-fill": tone(800, 800, {
    oracle: "neutral-background-color-default",
  }),
  "neutral-fill-hover": tone(900, 900, {
    oracle: "neutral-background-color-hover",
  }),
  "neutral-fill-pressed": tone(900, 900, {
    oracle: "neutral-background-color-down",
  }),
  "on-neutral": tone(25, 25, {
    source: "S2 Button.tsx:233 primary fill 글자 gray-25 (리뷰 h2)",
  }),

  // ── 옅은 면 · 테두리 (tone) ──
  "neutral-subtle": tone(100, 300, {
    oracle: "neutral-subtle-background-color-default",
  }),
  "neutral-hover": tone(200, 400, {
    source: "neutral-subtle 의 S2 nextColorStop — 한 단",
  }),
  "neutral-pressed": tone(200, 400, {
    source: "neutral-subtle 의 S2 nextColorStop — 한 단",
  }),
  "neutral-surface": tone(100, 100, {
    source: "S2 Button.tsx:153 secondary fill baseColor('gray-100')",
  }),
  "neutral-surface-hover": tone(200, 200, {
    source: "gray-100 의 S2 nextColorStop — 한 단",
  }),
  "neutral-outline": tone(300, 300, { source: "S2 field 테두리 gray-300" }),
  "neutral-outline-hover": tone(400, 400, {
    source: "S2 field 테두리 hover gray-400",
  }),
  border: tone(300, 300, { source: "S2 TextField gray-300 (Decision 2)" }),
  "border-hover": tone(400, 400, {
    source: "S2 TextField hover gray-400 (Decision 2)",
  }),
  "border-disabled": tone(300, 300, { oracle: "disabled-border-color" }),
  disabled: tone(100, 100, { oracle: "disabled-background-color" }),

  // ── picker · popover · 목록 (tone) — S2 Picker · Popover · Menu 설치본 단 ──
  "picker-background": tone(100, 100, {
    source: "S2 Picker.tsx:205 baseColor('gray-100')",
  }),
  "picker-background-hover": tone(200, 200, {
    source: "gray-100 의 S2 nextColorStop — 한 단",
  }),
  "picker-content": tone(800, 800, {
    oracle: "neutral-content-color-default",
  }),
  "picker-content-hover": tone(900, 900, {
    oracle: "neutral-content-color-hover",
  }),
  "picker-content-disabled": tone(400, 400, {
    oracle: "disabled-content-color",
  }),
  "picker-checkbox-base": tone(25, 25, {
    source: "S2 Picker 선택 checkbox 바탕 gray-25",
  }),
  "popover-background": tone(25, 75, { oracle: "background-elevated-color" }),
  "popover-outline": tone("#ffffff00", 200, {
    source:
      "S2 Popover.tsx:104 테두리 light transparent-white-25 · dark gray-200",
  }),
  "collection-item-focus": tone(200, 200, {
    source: "S2 Menu.tsx:265 baseColor('gray-100').isFocusVisible = gray-200",
  }),
  /** named hue `gray` — Tone 의 gray 사다리 (design-data gray 와 같은 family). */
  gray: tone(700, 500, { oracle: "gray-background-color-default" }),
  "gray-hover": tone(800, 600, {
    source: "S2 nextColorStop (spectrum-theme.ts:164) — 한 단",
  }),
  "gray-pressed": tone(800, 600, {
    source: "S2 nextColorStop (spectrum-theme.ts:164) — 한 단",
  }),
  "gray-subtle": tone(100, 300, {
    oracle: "gray-subtle-background-color-default",
  }),

  // ── accent (tint 사다리) ──
  /** 정적 면 (Badge · Tag · Row 선택) — accent-background */
  accent: accent(900, 800, { oracle: "accent-background-color-default" }),
  "accent-hover": accent(1000, 700, {
    oracle: "accent-background-color-hover",
  }),
  "accent-pressed": accent(1000, 700, {
    oracle: "accent-background-color-down",
  }),
  /** 선택 표시 (Checkbox · Radio · Switch emphasized) — S2 는 `accent-900` 명시 (dark 도 900). 체크 표시는
   * 그래픽이라 흰색 3:1 (dark 3.51) 기준 — 글자 4.5 가 아니다. */
  "selection-accent": accent(900, 900, {
    source: "S2 Checkbox · Radio · Switch emphasized backgroundColor accent-900",
  }),
  "selection-accent-hover": accent(1000, 1000, {
    source: "S2 accent-900:hovered (nextColorStop — 한 단)",
  }),
  /** 상호작용 면 (Button fill) — S2 명시 단 */
  "accent-fill": accent(900, 700, {
    source: "S2 Button.tsx:155 fill (light 900 · dark 700)",
  }),
  "accent-fill-hover": accent(1000, 600, {
    source: "S2 Button.tsx:156 fill hover = pressed (light 1000 · dark 600)",
  }),
  "accent-content": accent(900, 900, {
    oracle: "accent-content-color-default",
  }),
  "accent-content-hover": accent(1000, 1000, {
    oracle: "accent-content-color-hover",
  }),
  "accent-subtle": accent(200, 300, {
    oracle: "accent-subtle-background-color-default",
  }),
  "focus-ring": accent(800, 800, { oracle: "focus-indicator-color" }),
  // chart mono 사다리 — G0 역산 (지금 oklch 값에 가장 가까운 단, 사용자 결정 6)
  "chart-accent-1": accent(1200, 1200, { source: "G0 역산 (사용자 결정 6)" }),
  "chart-accent-2": accent(900, 900, { source: "G0 역산 (사용자 결정 6)" }),
  "chart-accent-3": accent(700, 700, { source: "G0 역산 (사용자 결정 6)" }),
  "chart-accent-4": accent(400, 400, { source: "G0 역산 (사용자 결정 6)" }),

  // ── selection-negative (테두리 · 선택 표시) — negative-border ──
  "selection-negative": {
    axis: "status",
    family: "red",
    light: 900,
    dark: 900,
    oracle: "negative-border-color-default",
  },
  "selection-negative-hover": {
    axis: "status",
    family: "red",
    light: 1000,
    dark: 1000,
    oracle: "negative-border-color-hover",
  },

  ...statusEntries(),
  ...namedHueEntries(),

  // ── 상수 ──
  "on-accent": constant(
    "#ffffff",
    "Hub 흰 글자 규칙 (사용자 결정 4) — yellow 등 밝은 tint 는 Phase 2 hue 판정",
  ),
  "on-negative": constant("#ffffff", "Hub 흰 글자 규칙 (사용자 결정 4)"),
  "overlay-backdrop": constant(
    "#00000070",
    "S2 Modal.tsx:41 transparent-black-500 (설치본 Modal.css 값)",
  ),
  "chart-categorical-1": constant("#0fb5ae", "Spectrum categorical 1"),
  "chart-categorical-2": constant("#4046ca", "Spectrum categorical 2"),
  "chart-categorical-3": constant("#f68511", "Spectrum categorical 3"),
  "chart-categorical-4": constant("#de3d82", "Spectrum categorical 4"),
  "chart-categorical-5": constant("#7e84fa", "Spectrum categorical 5"),
  "chart-categorical-6": constant("#72e06a", "Spectrum categorical 6"),
  "chart-categorical-7": constant("#147af3", "Spectrum categorical 7"),
  "chart-categorical-8": constant("#7326d3", "Spectrum categorical 8"),
  transparent: constant("transparent", "CSS keyword"),
  white: constant("#ffffff", "팔레트 상수"),
  black: constant("#000000", "팔레트 상수"),
};

/**
 * DOM 변수 이름이 「semantic」 인 역할 — status (`--<status>` · `-subtle` · `-strong`) 와 named hue
 * (`--hue-<hue>` · `-subtle`, `gray` 포함). 두 곳이 읽는다: 테마 없는 문서의 DOM 폴백 `semantic-palette.css`
 * (`paletteGenerator.renderSemanticCss` — 값은 seed) 와 `tokenResolver` 의 `-hover` · `-pressed` 변수 표.
 * (ADR-302 — 옛 `semanticPaletteMap.ts` 의 Tailwind 좌표 표를 대체. 이름만 남고 값은 alias 표 × 사다리.)
 */
export const SEMANTIC_CSS_VARS: Readonly<
  Record<string, { cssVar: `--${string}`; hook?: `--${string}` }>
> = (() => {
  const out: Record<string, { cssVar: `--${string}`; hook?: `--${string}` }> =
    {};
  for (const status of Object.keys(STATUS_FAMILIES))
    for (const suffix of ["", "-subtle", "-strong"])
      out[`${status}${suffix}`] = {
        cssVar: `--${status}${suffix}`,
        ...(status === "negative" && suffix === ""
          ? { hook: "--color-invalid" as const }
          : {}),
      };
  for (const hue of [...Object.keys(NAMED_HUE_FAMILIES), "gray"]) {
    const name = hue === "green-named" ? "green" : hue;
    out[hue] = { cssVar: `--hue-${name}` };
    out[`${hue}-subtle`] = { cssVar: `--hue-${name}-subtle` };
  }
  return out;
})();
