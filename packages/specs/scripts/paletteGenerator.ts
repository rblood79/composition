/**
 * Tailwind v4 theme.css → 팔레트 산출물 생성기 (순수 함수 — IO 없음)
 *
 * ADR-191: 팔레트 정의 원천은 설치된 `tailwindcss/theme.css` 하나다.
 * 본 모듈은 그 파일의 `@theme default { … }` 블록에서 `--color-{family}-{step}`
 * 선언만 추출해 두 소비자 포맷으로 렌더한다.
 *
 *   1. plain CSS  — `@layer shared-tokens { :root { … } }` (oklch 원문 그대로;
 *      브라우저 네이티브라 Tailwind 파이프라인이 없는 Preview/Publish 도 로드 가능)
 *   2. TS hex map — Skia 경로용 sRGB hex (`packages/specs` 는 DOM 없는 환경에서도
 *      팔레트 값을 제공해야 하므로 빌드 시 변환)
 *
 * oklch → sRGB 수식은 ADR-191 Phase 0 에서 브라우저 canvas 실측과 대조 검증됨
 * (gray-500 106,114,130 / blue-500 43,127,255 / green-400 5,223,114 clamp).
 * CLI 는 `generate-palette.ts`, drift 검증은 `tailwindPalette.drift.test.ts`.
 */

import {
  SEMANTIC_PALETTE_MAP,
  type SemanticPaletteEntry,
} from "../src/primitives/semanticPaletteMap";

export interface PaletteEntry {
  family: string;
  step: number;
  /** theme.css 원문 값 (예: `oklch(55.1% 0.027 264.364)`) */
  raw: string;
  /** sRGB 6자리 소문자 hex (예: `#6a7282`) */
  hex: string;
}

export interface PaletteSource {
  /** `tailwindcss/package.json` version — 산출물 헤더에 기록 (업그레이드 시 drift 로 표면화) */
  tailwindVersion: string;
  entries: PaletteEntry[];
}

const PALETTE_DECL = /^\s*--color-([a-z]+)-(\d+)\s*:\s*([^;]+);/;

/**
 * theme.css 전문에서 첫 `@theme default { … }` 블록의 팔레트 선언을 파일 순서대로 추출한다.
 * 다중행 값(`--font-sans:` 처럼 값이 다음 줄로 이어지는 선언)은 정규식이 매치하지 않으므로
 * 자연히 건너뛴다 — 팔레트 선언은 전부 단일 행이다.
 */
export function parseThemeCss(
  themeCss: string,
): Omit<PaletteSource, "tailwindVersion"> {
  const start = themeCss.indexOf("@theme default {");
  if (start < 0) {
    throw new Error("theme.css: `@theme default {` 블록을 찾지 못했다");
  }
  const end = themeCss.indexOf("\n}", start);
  const block = themeCss.slice(start, end < 0 ? undefined : end);

  const entries: PaletteEntry[] = [];
  for (const line of block.split("\n")) {
    const m = PALETTE_DECL.exec(line);
    if (!m) continue;
    const raw = m[3].trim();
    entries.push({
      family: m[1],
      step: Number(m[2]),
      raw,
      hex: cssColorToSrgbHex(raw),
    });
  }
  if (entries.length === 0) {
    throw new Error("theme.css: 팔레트 선언 0건 — 파일 형식이 바뀌었는지 확인");
  }
  return { entries };
}

// ============================================================================
// oklch → sRGB
// ============================================================================

const OKLCH = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)(%?)\s+([\d.]+|none)\s*\)$/i;
const HEX6 = /^#([0-9a-f]{6})$/i;
const HEX3 = /^#([0-9a-f]{3})$/i;

/** theme.css 가 쓰는 색 표기(oklch / #hex)를 sRGB hex 로. 그 외 표기는 예외 — 원천 형식 변화를 조용히 넘기지 않는다. */
export function cssColorToSrgbHex(value: string): string {
  const v = value.trim();
  const h6 = HEX6.exec(v);
  if (h6) return `#${h6[1].toLowerCase()}`;
  const h3 = HEX3.exec(v);
  if (h3) {
    const [r, g, b] = h3[1].toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const m = OKLCH.exec(v);
  if (!m) {
    throw new Error(`지원하지 않는 색 표기: ${value}`);
  }
  const L = m[2] === "%" ? Number(m[1]) / 100 : Number(m[1]);
  // C 의 % 표기는 0.4 를 100% 로 본다 (CSS Color 4). theme.css 는 절대값만 쓴다.
  const C = m[4] === "%" ? (Number(m[3]) / 100) * 0.4 : Number(m[3]);
  const H = m[5].toLowerCase() === "none" ? 0 : Number(m[5]);
  return oklchToSrgbHex(L, C, H);
}

/** OKLab → linear sRGB → gamma. gamut 밖 값은 clamp (브라우저 sRGB 렌더와 동일). */
export function oklchToSrgbHex(L: number, C: number, H: number): string {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return `#${[r, g, bl].map(gammaByte).join("")}`;
}

function gammaByte(linear: number): string {
  const x = Math.min(1, Math.max(0, linear));
  const srgb = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.round(srgb * 255)
    .toString(16)
    .padStart(2, "0");
}

// ============================================================================
// 렌더 (결정적 — 입력 순서·포맷 고정)
// ============================================================================

function header(source: PaletteSource, comment: [string, string]): string {
  const [open, close] = comment;
  return [
    `${open} GENERATED — 편집 금지. 원천: tailwindcss@${source.tailwindVersion} theme.css`,
    ` * 재생성: pnpm generate:palette  (검증: pnpm validate:palette)`,
    ` * ADR-191: 팔레트 정의 원천 단일화 — 이 파일은 파생물이며 SSOT 가 아니다.`,
    ` ${close}`,
  ].join("\n");
}

/** `@layer shared-tokens { :root { … } }` — Builder/Preview/Publish 공용 plain CSS */
export function renderPaletteCss(source: PaletteSource): string {
  const lines = source.entries.map(
    (e) => `    --color-${e.family}-${e.step}: ${e.raw};`,
  );
  return [
    header(source, ["/*", "*/"]),
    "",
    "@layer shared-tokens {",
    "  :root {",
    ...lines,
    "  }",
    "}",
    "",
  ].join("\n");
}

/** Skia 경로용 hex 맵 — `TAILWIND_PALETTE.gray[500]` */
export function renderPaletteTs(source: PaletteSource): string {
  const families = new Map<string, PaletteEntry[]>();
  for (const e of source.entries) {
    const list = families.get(e.family) ?? [];
    list.push(e);
    families.set(e.family, list);
  }

  const body: string[] = [];
  for (const [family, list] of families) {
    body.push(`  ${family}: {`);
    for (const e of list) {
      body.push(`    ${e.step}: "${e.hex}", // ${e.raw}`);
    }
    body.push("  },");
  }

  return [
    header(source, ["/**", "*/"]),
    "",
    "/** Tailwind 팔레트 — family × step → sRGB hex (oklch 원문은 각 행 주석) */",
    "export const TAILWIND_PALETTE = {",
    ...body,
    "} as const;",
    "",
    "export type TailwindPaletteFamily = keyof typeof TAILWIND_PALETTE;",
    "",
    "export type TailwindPaletteStep =",
    "  keyof (typeof TAILWIND_PALETTE)[TailwindPaletteFamily];",
    "",
  ].join("\n");
}

// ============================================================================
// ADR-193 — semantic·named hue 단계 매핑 CSS (테마별 var 정의 층, 참조만)
// ============================================================================

function semanticRef(
  entry: SemanticPaletteEntry,
  theme: "light" | "dark",
): string {
  const [family, step] = entry[theme];
  const ref = `var(--color-${family}-${step})`;
  return entry.hook ? `var(${entry.hook}, ${ref})` : ref;
}

/**
 * `@layer shared-tokens { :root { --positive: var(--color-green-600); … } [data-theme="dark"] { … } }`
 *
 * - 원천은 `semanticPaletteMap.ts` 표 (Skia `colors.ts` 와 같은 표) — 여기서 hex 를 쓰지 않는다:
 *   팔레트 var 참조만 emit 해야 ThemeStudio runtime `<style>` 의 `--color-neutral-N` override 가 흘러간다 (R2).
 * - 테마 분기는 이 층 한 곳에서만 일어난다 — 컴포넌트 CSS 는 `var(--positive)` 만 쓴다.
 * - `shared-tokens` 층: preview-system 의 손 정의보다 위, unlayered runtime `<style>` 보다 아래.
 */
export function renderSemanticCss(
  map: Record<string, SemanticPaletteEntry> = SEMANTIC_PALETTE_MAP,
): string {
  const block = (theme: "light" | "dark") =>
    Object.values(map).map(
      (entry) => `    ${entry.cssVar}: ${semanticRef(entry, theme)};`,
    );
  return [
    "/* GENERATED — 편집 금지. 원천: packages/specs/src/primitives/semanticPaletteMap.ts",
    " * 재생성: pnpm generate:palette  (검증: pnpm validate:palette)",
    " * ADR-193: semantic·named hue → 팔레트 단계 매핑 (light / dark). Skia colors.ts 와 같은 표에서 파생 —",
    " * 이 파일은 파생물이며 SSOT 가 아니다. 팔레트 var 참조만 (hex 금지 — ThemeStudio override 훅 보존).",
    " */",
    "",
    "@layer shared-tokens {",
    "  :root {",
    ...block("light"),
    "  }",
    "",
    '  [data-theme="dark"] {',
    ...block("dark"),
    "  }",
    "}",
    "",
  ].join("\n");
}
