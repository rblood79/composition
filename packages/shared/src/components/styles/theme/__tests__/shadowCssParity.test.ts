import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { darkShadows, lightShadows } from "@composition/specs";

/**
 * ADR-166 Phase 5 — CSS `--shadow-*` ↔ TS `lightShadows`/`darkShadows` 값 대칭 가드.
 *
 * D3 그림자는 **손으로 유지되는 두 벌**로 존재한다:
 *   - DOM(CSS) consumer → `preview-system.css` 의 `--shadow-{sm,md,lg}`
 *   - Skia consumer     → `packages/specs/src/primitives/shadows.ts`
 *
 * 둘은 같은 Spectrum 2 출처에서 왔지만 서로를 참조하지 않는다. 한쪽만 손대면 Preview 와
 * 캔버스가 조용히 벌어지는데, **양쪽 다 "그림자가 보인다"** 라서 시각 점검으로는 안 잡힌다
 * (α .08 ↔ .24 같은 차이). 그래서 값을 기계로 맞물린다.
 *
 * 색 표기는 정규화 후 비교한다 — CSS 는 `rgb(0 0 0 / 0.08)`(공백 구문), TS 는
 * `rgba(0, 0, 0, 0.08)`. 표기 차이는 무해하고 **수치 차이만** 실패로 만든다.
 */

const CSS_PATH = resolve(__dirname, "../preview-system.css");
const SCALE = ["sm", "md", "lg"] as const;

/** `rgb(0 0 0 / 0.08)` / `rgba(0, 0, 0, 0.08)` → `rgba(0,0,0,0.08)` + 공백 정규화. */
function normalize(value: string): string {
  return value
    .replace(
      /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*[/,]\s*([\d.]+)\s*\)/g,
      (_m, r, g, b, a) => `rgba(${r},${g},${b},${Number(a)})`,
    )
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

/**
 * `--shadow-md: var(--box-shadow-md, <값>);` 선언에서 **fallback 값**만 뽑는다.
 * AI 테마 오버라이드 훅(`--box-shadow-*`)이 첫 인자라 그 뒤가 실제 기본값이다.
 */
function extractFallback(css: string, name: string): string | null {
  const start = css.indexOf(`--shadow-${name}: var(`);
  if (start === -1) return null;

  // 선언 끝(`);`)까지 잘라 var() 안쪽만 남긴다.
  const open = css.indexOf("(", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "(") depth++;
    else if (css[i] === ")") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;

  const inner = css.slice(open + 1, end);
  const comma = inner.indexOf(",");
  return comma === -1 ? null : inner.slice(comma + 1);
}

/** light 블록 / dark 블록을 나눈다 — 같은 변수명이 두 번 정의되기 때문. */
async function readBlocks(): Promise<{ light: string; dark: string }> {
  const css = await readFile(CSS_PATH, "utf-8");
  const darkStart = css.indexOf("Shadow System — Dark mode");
  expect(darkStart, "dark 그림자 블록 주석 앵커").toBeGreaterThan(-1);
  return { light: css.slice(0, darkStart), dark: css.slice(darkStart) };
}

describe("--shadow-* CSS ↔ shadows.ts 값 대칭 (ADR-166)", () => {
  it("light 3단계가 lightShadows 와 수치 일치", async () => {
    const { light } = await readBlocks();
    for (const key of SCALE) {
      const css = extractFallback(light, key);
      expect(css, `--shadow-${key} 선언`).not.toBeNull();
      expect(normalize(css!), `--shadow-${key} (light)`).toBe(
        normalize(lightShadows[key]),
      );
    }
  });

  it("dark 3단계가 darkShadows 와 수치 일치", async () => {
    const { dark } = await readBlocks();
    for (const key of SCALE) {
      const css = extractFallback(dark, key);
      expect(css, `--shadow-${key} 선언 (dark)`).not.toBeNull();
      expect(normalize(css!), `--shadow-${key} (dark)`).toBe(
        normalize(darkShadows[key]),
      );
    }
  });

  it("--shadow-xl 은 양 블록 모두에서 제거됐다", async () => {
    const css = await readFile(CSS_PATH, "utf-8");
    // Spectrum 이 4번째 elevation 을 발행하지 않아 ADR-166 에서 축소. 부활 시 TS 쪽에는
    //   대응 키가 없어 CSS 축에만 존재하는 비대칭이 된다.
    expect(css).not.toContain("--shadow-xl:");
    expect("xl" in lightShadows).toBe(false);
    expect("xl" in darkShadows).toBe(false);
  });
});
