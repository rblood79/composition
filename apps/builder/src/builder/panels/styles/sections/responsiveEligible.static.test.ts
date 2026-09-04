/**
 * ADR-154 개정 1 (R9) + ADR-168 — responsive-eligible allowlist 드리프트 정적 가드.
 *
 * ## 왜 두 단언인가 (ADR-168 전제 개정)
 *
 * ADR-154 는 eligible 집합을 "Style 패널 Layout·Transform 섹션이 편집하는 키 전수" 와
 * **정확히 일치** 시켰다. 이는 breakpoint override 의 write 주체가 Style 패널 하나뿐이던
 * 당시 조건의 부산물이다. 프리셋(ADR-168)이 두 번째 write 주체가 되면서 "편집 UI 가 있는가"
 * 와 "breakpoint 별로 달라져야 하는가" 가 분리됐다 — grid 트랙은 편집 UI 가 없지만 BP 별로
 * 반드시 달라져야 한다.
 *
 * 그래서 단일 단언을 둘로 나눈다. **논리곱은 원래 단언보다 약하지 않다**:
 *   1) 섹션 편집 키 ≡ SECTION_EDITABLE  — 섹션에 필드를 추가하고 allowlist 를 빠뜨리면 실패
 *   2) 차집합 ≡ PRESET_AUTHORED         — 명시 선언 없는 키는 어떤 경로로도 eligible 불가
 *
 * 드리프트 시나리오:
 *   - 섹션에 편집 필드 추가 → allowlist 미등재 → 토글 없이 조용히 전역 write (silent, R9)
 *   - allowlist 에만 있고 섹션에도 프리셋 선언에도 없음 → 유령 eligible 키
 *
 * 섹션 파일과 allowlist 는 서로 import 하지 않으므로(섹션은 UI 순서, allowlist 는 판정 SSOT)
 * 이 테스트가 유일한 동기화 지점이다 — 실패 시 양쪽을 맞춘다.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS,
  RESPONSIVE_ELIGIBLE_STYLE_PROPS,
  SECTION_EDITABLE_RESPONSIVE_PROPS,
} from "@composition/shared";

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

describe("ADR-154 R9 / ADR-168 — responsive eligible allowlist 드리프트 가드", () => {
  it("SECTION_EDITABLE_RESPONSIVE_PROPS === LAYOUT_PROPS ∪ TRANSFORM_PROPS", () => {
    const layout = extractPropsArray("styleSectionProps.ts", "LAYOUT_PROPS");
    const transform = extractPropsArray(
      "styleSectionProps.ts",
      "TRANSFORM_PROPS",
    );
    expect(layout.length).toBeGreaterThan(0);
    expect(transform.length).toBeGreaterThan(0);

    const sectionKeys = new Set([...layout, ...transform]);
    const editable = SECTION_EDITABLE_RESPONSIVE_PROPS;

    const missingFromAllowlist = [...sectionKeys].filter(
      (k) => !editable.has(k),
    );
    const extraInAllowlist = [...editable].filter((k) => !sectionKeys.has(k));

    expect(missingFromAllowlist).toEqual([]);
    expect(extraInAllowlist).toEqual([]);
  });

  it("ELIGIBLE ∖ SECTION_EDITABLE === PRESET_AUTHORED (명시 선언 없는 키는 eligible 불가)", () => {
    const surplus = [...RESPONSIVE_ELIGIBLE_STYLE_PROPS]
      .filter((k) => !SECTION_EDITABLE_RESPONSIVE_PROPS.has(k))
      .sort();
    expect(surplus).toEqual([...PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS].sort());
  });

  it("두 집합은 서로소 — 같은 키가 두 write 주체에 걸치지 않는다", () => {
    const overlap = [...PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS].filter((k) =>
      SECTION_EDITABLE_RESPONSIVE_PROPS.has(k),
    );
    expect(overlap).toEqual([]);
  });

  it("gridArea shorthand 는 eligible 이 아니다 (ADR-168 리뷰 M3)", () => {
    // 같은 BP 에서 shorthand 와 longhand 를 함께 override 하면 모두 !important 동일
    // 특정도라 emit source order 가 승자를 정한다 → 뒤에 온 shorthand 가 longhand 를 리셋.
    expect(RESPONSIVE_ELIGIBLE_STYLE_PROPS.has("gridArea")).toBe(false);
  });
});
