/**
 * ADR-154 개정 1 (R9) — responsive-eligible allowlist ↔ 섹션 편집 키 드리프트 정적 가드.
 *
 * `RESPONSIVE_ELIGIBLE_STYLE_PROPS`(shared SSOT)는 Style 패널의 Layout·Transform 섹션이
 * 편집하는 style 키 전수(`LAYOUT_PROPS` ∪ `TRANSFORM_PROPS`)와 **정확히 일치**해야 한다.
 *
 * 드리프트 시나리오:
 *   - 섹션에 편집 필드 추가 → allowlist 미등재 → 토글 없이 조용히 전역 write (silent, R9)
 *   - allowlist 에만 있고 섹션에 없음 → 편집 UI 없는 유령 eligible 키
 *
 * 두 파일은 서로 import 하지 않으므로(섹션은 UI 순서, allowlist 는 판정 SSOT) 이 테스트가
 * 유일한 동기화 지점이다 — 실패 시 양쪽을 맞춘다.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RESPONSIVE_ELIGIBLE_STYLE_PROPS } from "@composition/shared";

const HERE = dirname(fileURLToPath(import.meta.url));

/** 섹션 파일에서 `const NAME_PROPS = [ ... ]` 배열의 문자열 리터럴을 추출한다. */
function extractPropsArray(fileName: string, constName: string): string[] {
  const src = readFileSync(resolve(HERE, fileName), "utf8");
  const start = src.indexOf(`const ${constName} = [`);
  if (start < 0) throw new Error(`${constName} not found in ${fileName}`);
  const open = src.indexOf("[", start);
  const close = src.indexOf("];", open);
  const body = src.slice(open + 1, close);
  return [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("ADR-154 R9 — responsive eligible allowlist 드리프트 가드", () => {
  it("RESPONSIVE_ELIGIBLE_STYLE_PROPS === LAYOUT_PROPS ∪ TRANSFORM_PROPS", () => {
    const layout = extractPropsArray("LayoutSection.tsx", "LAYOUT_PROPS");
    const transform = extractPropsArray(
      "TransformSection.tsx",
      "TRANSFORM_PROPS",
    );
    expect(layout.length).toBeGreaterThan(0);
    expect(transform.length).toBeGreaterThan(0);

    const sectionKeys = new Set([...layout, ...transform]);
    const eligible = RESPONSIVE_ELIGIBLE_STYLE_PROPS;

    const missingFromAllowlist = [...sectionKeys].filter(
      (k) => !eligible.has(k),
    );
    const extraInAllowlist = [...eligible].filter((k) => !sectionKeys.has(k));

    expect(missingFromAllowlist).toEqual([]);
    expect(extraInAllowlist).toEqual([]);
  });
});
