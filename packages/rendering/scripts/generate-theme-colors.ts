/**
 * ADR-302 — 기본 preset (Tone gray · tint blue) 의 역할 색 값을 alias 표 × Spectrum 사다리에서 만든다.
 *
 *   - 입력: `src/primitives/colorAliases.ts` (역할 → 축 · 단) · `src/primitives/generated/spectrumLadders.ts`
 *     (design-data primitive — `apps/builder/scripts/adr302-spectrum-color-extract.mjs` 산출)
 *   - 출력: `src/primitives/generated/spectrumThemeColors.ts` — `colors.ts` 의 `lightColors` · `darkColors` 가 읽는
 *     literal hex. 사다리 표 (≈ 600 hex) 는 initial 번들에 싣지 않는다 (사용자 결정 8 — 역할 값만 seed).
 *
 * Usage:
 *   pnpm -F @composition/rendering generate:theme-colors          # 갱신
 *   pnpm -F @composition/rendering generate:theme-colors --check  # 산출물 ≠ 입력이면 exit 1
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import {
  COLOR_ALIASES,
  type ColorAliasEntry,
} from "../src/primitives/colorAliases";
import {
  SPECTRUM_LADDERS,
  type SpectrumLadderFamily,
} from "../src/primitives/generated/spectrumLadders";

const here = dirname(fileURLToPath(import.meta.url));
export const THEME_COLORS_OUT = resolve(
  here,
  "../src/primitives/generated/spectrumThemeColors.ts",
);

type Mode = "light" | "dark";

/** 기본 preset 의 사다리 — tone = gray, accent = blue. */
const DEFAULT_FAMILY = { tone: "gray", accent: "blue" } as const;

export function aliasValue(entry: ColorAliasEntry, mode: Mode): string {
  const step = entry[mode];
  if (typeof step === "string") return step;
  const family = (
    entry.axis === "tone" || entry.axis === "accent"
      ? DEFAULT_FAMILY[entry.axis]
      : entry.family
  ) as SpectrumLadderFamily | undefined;
  const value = family ? SPECTRUM_LADDERS[family]?.[mode]?.[step] : undefined;
  if (!value) throw new Error(`사다리 ${family}-${step} (${mode}) 없음`);
  return value;
}

function ladders(): string {
  return (["accent", "tone"] as const)
    .map((axis) => {
      const family = SPECTRUM_LADDERS[DEFAULT_FAMILY[axis]];
      const mode = (m: Mode) =>
        `    ${m}: { ${Object.entries(family[m])
          .map(([step, hex]) => `${step}: "${hex}"`)
          .join(", ")} },`;
      return `  ${axis}: {\n${mode("light")}\n${mode("dark")}\n  },`;
    })
    .join("\n");
}

function render(): string {
  const block = (mode: Mode) =>
    Object.entries(COLOR_ALIASES)
      .map(
        ([key, entry]) =>
          `  ${JSON.stringify(key)}: "${aliasValue(entry, mode)}",`,
      )
      .join("\n");
  return `/**
 * ADR-302 — 기본 preset (Tone gray · tint blue) 의 역할 색 = alias 표 × Spectrum 사다리.
 * 생성: packages/rendering/scripts/generate-theme-colors.ts — 손 편집 금지.
 */
export const SPECTRUM_LIGHT_COLORS = {
${block("light")}
} as const;

export const SPECTRUM_DARK_COLORS = {
${block("dark")}
} as const;

/**
 * 기본 preset 의 두 축 사다리 (accent = blue · tone = gray) — DOM \`--tint-N\` · \`--tone-N\` 의 seed. 다른 축의
 * 사다리는 생성 chunk 가 만든다 (사용자 결정 8 — 전체 사다리 표는 initial 밖).
 */
export const SPECTRUM_DEFAULT_LADDERS = {
${ladders()}
} as const;
`;
}

async function main() {
  const next = await prettier.format(render(), {
    ...(await prettier.resolveConfig(THEME_COLORS_OUT)),
    filepath: THEME_COLORS_OUT,
  });
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(THEME_COLORS_OUT, "utf-8");
    } catch {
      current = "";
    }
    if (current !== next) {
      console.error(
        "spectrumThemeColors.ts 가 alias 표 · 사다리와 다르다 — pnpm generate:theme-colors",
      );
      process.exit(1);
    }
    console.log("spectrumThemeColors.ts = alias 표 × 사다리");
    return;
  }
  writeFileSync(THEME_COLORS_OUT, next, "utf-8");
  console.log(`wrote ${THEME_COLORS_OUT}`);
}

void main();
