import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { componentCatalog } from "../componentCatalog";

/**
 * ADR-912 paddingX 데이터 갭 회귀 방지 (2026-06-05).
 *
 * **배경**: ADR-912 정본 승격(1A-a) 시 spec→COMPONENT_RULES_TABLE 로 sizes 를 이전하며 **Button 만
 * paddingX 를 옮기고 나머지 발효 type 의 paddingX 를 누락**했다. 결과: buildCatalogShapes 의
 * `parsePxValue(style, size.paddingX)` 가 undefined 를 반환 → text shape x:undefined → 하류
 * specShapeConverter `paddingLeft = shape.x` → nodeRendererText `paddingLeft + textIndent` 가 NaN
 * 전파 → drawX=NaN → **Skia 텍스트 미표시**(ToggleButton/Badge/Code/Kbd/InlineAlert 자식 등).
 * G-slice(Button 단독)는 Button 에 우연히 paddingX 가 있어 이 갭을 못 잡았다.
 *
 * **본 test 의 불변식**: catalog 발효(cutover==="catalog") text-bearing type 의 rule sizes 는 정의된
 * paddingX 가 **유한수(finite number)** 여야 한다. paddingX 미정의(undefined)는 buildCatalogShapes 의
 * `size.paddingX ?? 0` guard 가 0(left 정렬 inline text 의 올바른 값)으로 흡수하므로 허용되나,
 * **NaN/Infinity/문자열 등 비유한값은 금지**(NaN 전파 재현).
 *
 * + 회귀가 났던 대표군(Button parity + ToggleButton/Badge/Code/Kbd/InlineAlert)을 명시 고정.
 */

/** catalog 에 cutover==="catalog" 로 등록된 primitive type 집합. */
const cutoverTypes = new Set(
  componentCatalog
    .filter((e) => e.kind === "primitive" && e.cutover === "catalog")
    .map((e) => e.type),
);

/** rule sizes 항목에서 정의된 paddingX 값만 모은다(미정의는 skip — `?? 0` guard 가 흡수). */
function definedPaddingXValues(
  type: string,
): Array<{ size: string; value: unknown }> {
  const rule = COMPONENT_RULES_TABLE[type];
  if (!rule?.sizes) return [];
  const out: Array<{ size: string; value: unknown }> = [];
  for (const [size, spec] of Object.entries(rule.sizes)) {
    const px = (spec as { paddingX?: unknown }).paddingX;
    if (px !== undefined) out.push({ size, value: px });
  }
  return out;
}

describe("ADR-912 — componentRulesTable paddingX 데이터 갭 회귀 방지", () => {
  it("catalog 발효 type 의 정의된 paddingX 는 전부 유한수 (NaN/undefined 전파 차단)", () => {
    const violations: string[] = [];
    for (const type of cutoverTypes) {
      for (const { size, value } of definedPaddingXValues(type)) {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          violations.push(
            `${type}.sizes.${size}.paddingX = ${JSON.stringify(value)}`,
          );
        }
      }
    }
    expect(violations, `비유한 paddingX:\n${violations.join("\n")}`).toEqual(
      [],
    );
  });

  it("회귀 대표군 — text-bearing box type 은 모든 size 에 유한 paddingX 보유", () => {
    // ADR-912 paddingX 갭으로 Skia 텍스트가 사라졌던 box 형 발효 type.
    // 모든 size 항목에 finite paddingX 가 있어야 텍스트 x 가 NaN 으로 깨지지 않는다.
    const boxTextTypes = [
      "Button", // parity 기준 — 갭 이전부터 보유, 유지 확인
      "ToggleButton",
      "Badge",
      "Code",
      "Kbd",
      "InlineAlert",
    ];
    for (const type of boxTextTypes) {
      expect(cutoverTypes.has(type), `${type} 미발효`).toBe(true);
      const rule = COMPONENT_RULES_TABLE[type];
      const sizes = Object.entries(rule?.sizes ?? {});
      expect(sizes.length, `${type} sizes 없음`).toBeGreaterThan(0);
      for (const [size, spec] of sizes) {
        const px = (spec as { paddingX?: unknown }).paddingX;
        expect(
          typeof px === "number" && Number.isFinite(px),
          `${type}.sizes.${size}.paddingX = ${JSON.stringify(px)} (유한수 아님 → NaN 전파)`,
        ).toBe(true);
      }
    }
  });

  it("Button parity — paddingX xs:4 / sm:8 / md:12 / lg:16 / xl:24 보존", () => {
    const button = COMPONENT_RULES_TABLE.Button;
    const expected: Record<string, number> = {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
    };
    for (const [size, val] of Object.entries(expected)) {
      const px = (button?.sizes?.[size] as { paddingX?: unknown } | undefined)
        ?.paddingX;
      expect(px, `Button.sizes.${size}.paddingX`).toBe(val);
    }
  });
});
