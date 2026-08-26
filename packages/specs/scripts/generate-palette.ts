/**
 * Palette Generation Script (ADR-191)
 *
 * 설치된 `tailwindcss/theme.css` 에서 팔레트를 추출해 두 산출물을 쓴다:
 *   - packages/shared/src/components/styles/theme/generated/tailwind-palette.css
 *   - packages/specs/src/primitives/generated/tailwindPalette.ts
 *
 * Usage:
 *   pnpm generate:palette          # 산출물 갱신
 *   pnpm generate:palette --check  # 산출물이 원천과 일치하는지만 확인 (drift 게이트, exit 1 on diff)
 *
 * 원천 해석은 apps/builder 의 의존 트리를 기준으로 한다 — Builder 가 실제로 로드하는
 * Tailwind 버전이 곧 팔레트 정본이다 (packages/specs 는 tailwindcss 를 직접 의존하지 않는다).
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseThemeCss,
  renderPaletteCss,
  renderPaletteTs,
  type PaletteSource,
} from "./paletteGenerator";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const builderDir = resolve(repoRoot, "apps/builder");

export const PALETTE_CSS_OUT = resolve(
  repoRoot,
  "packages/shared/src/components/styles/theme/generated/tailwind-palette.css",
);
export const PALETTE_TS_OUT = resolve(
  repoRoot,
  "packages/specs/src/primitives/generated/tailwindPalette.ts",
);

/** Builder 가 로드하는 tailwindcss 의 theme.css + version */
export function loadPaletteSource(): PaletteSource {
  const require = createRequire(resolve(builderDir, "package.json"));
  const themePath = require.resolve("tailwindcss/theme.css");
  const pkg = require("tailwindcss/package.json") as { version: string };
  const { entries } = parseThemeCss(readFileSync(themePath, "utf-8"));
  return { tailwindVersion: pkg.version, entries };
}

export function renderOutputs(source: PaletteSource): {
  css: string;
  ts: string;
} {
  return { css: renderPaletteCss(source), ts: renderPaletteTs(source) };
}

function readOrEmpty(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf-8") : "";
}

function main(): void {
  const check = process.argv.includes("--check");
  const source = loadPaletteSource();
  const { css, ts } = renderOutputs(source);

  const targets: Array<[string, string]> = [
    [PALETTE_CSS_OUT, css],
    [PALETTE_TS_OUT, ts],
  ];

  if (check) {
    const stale = targets.filter(([path, next]) => readOrEmpty(path) !== next);
    if (stale.length > 0) {
      console.error(
        `❌ palette drift — 원천 tailwindcss@${source.tailwindVersion} 와 산출물 불일치:\n` +
          stale.map(([p]) => `   ${p}`).join("\n") +
          `\n   → pnpm generate:palette 로 재생성`,
      );
      process.exit(1);
    }
    console.log(
      `✅ palette in sync (tailwindcss@${source.tailwindVersion}, ${source.entries.length} entries)`,
    );
    return;
  }

  for (const [path, next] of targets) {
    mkdirSync(dirname(path), { recursive: true });
    const changed = readOrEmpty(path) !== next;
    writeFileSync(path, next, "utf-8");
    console.log(`${changed ? "✏️ " : "＝ "} ${path}`);
  }
  console.log(
    `✅ ${source.entries.length} entries from tailwindcss@${source.tailwindVersion}`,
  );
}

// tsx 직접 실행 시에만 main — 테스트는 export 만 import
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
