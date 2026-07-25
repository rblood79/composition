import { describe, expect, it } from "vitest";

import { darkShadows, lightShadows } from "@composition/specs";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * ADR-166 Phase 5 — catalog 전수 그림자 값 언어 가드.
 *
 * D3 그림자 SSOT 는 catalog(`COMPONENT_RULES_TABLE`) + `{shadow.*}` 토큰이고, **DOM(CSS)와
 * Skia 가 같은 값을 읽는다**. Skia 쪽 파서(`styleConverter.parseOneShadow`)의 색 정규식은
 * rgb/rgba/hex 만 매칭하므로 `var(...)` / `color-mix(...)` 가 섞이면 색 인식에 실패해
 * **불투명 검정**으로 낙하한다 — Preview 는 멀쩡한데 캔버스만 새까매지는 비대칭이 된다.
 * ADR-166 은 파서를 고치는 대신 **값 언어를 TokenRef 로 수렴**시키는 쪽을 택했으므로, 그 수렴
 * 상태를 기계로 잠근다.
 *
 * 특정 컴포넌트를 열거하지 않고 **키 이름으로 깊이 탐색**한다 — `containerStyles` / `states.*` /
 * 향후 신설될 중첩 위치 어디에 boxShadow 가 생기든 자동 포섭된다.
 */

interface FoundShadow {
  path: string;
  value: string;
}

function collectBoxShadows(node: unknown, path: string): FoundShadow[] {
  if (node == null || typeof node !== "object") return [];
  if (Array.isArray(node)) {
    return node.flatMap((v, i) => collectBoxShadows(v, `${path}[${i}]`));
  }
  const out: FoundShadow[] = [];
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const child = `${path}.${key}`;
    if (key === "boxShadow" && typeof value === "string") {
      out.push({ path: child, value });
      continue;
    }
    out.push(...collectBoxShadows(value, child));
  }
  return out;
}

const ALL = collectBoxShadows(COMPONENT_RULES_TABLE, "COMPONENT_RULES_TABLE");
const TOKEN_RE = /^\{shadow\.([^}]+)\}$/;

describe("catalog boxShadow 값 언어 계약 (ADR-166)", () => {
  it("탐색이 실제로 값을 찾는다 (traversal 자체 회귀 가드)", () => {
    // 셀렉터가 조용히 0건이 되면 아래 단언들이 전부 vacuous 하게 통과한다.
    expect(ALL.length).toBeGreaterThan(0);
  });

  it("어떤 boxShadow 도 var( / color-mix( 를 포함하지 않는다", () => {
    const offenders = ALL.filter(
      (s) => s.value.includes("var(") || s.value.includes("color-mix("),
    );
    expect(
      offenders,
      `Skia 파서가 불투명 검정으로 낙하시킨다 — {shadow.*} 토큰으로 바꿀 것:\n${offenders
        .map((o) => `  ${o.path} = ${o.value}`)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("`{shadow.X}` 참조는 light / dark **양쪽**에 존재한다", () => {
    // 한쪽만 있으면 그 theme 에서 undefined 가 전개돼 그림자가 통째로 사라진다.
    const missing: string[] = [];
    for (const { path, value } of ALL) {
      const name = TOKEN_RE.exec(value)?.[1];
      if (!name) continue;
      if (!(name in lightShadows))
        missing.push(`${path}: light 에 '${name}' 없음`);
      if (!(name in darkShadows))
        missing.push(`${path}: dark 에 '${name}' 없음`);
    }
    expect(missing).toEqual([]);
  });

  it("overlay 3종의 elevation 서열이 sm < md < lg 로 고정", () => {
    // Tooltip(가장 낮음) < Popover < Modal. 값 자체가 아니라 **서열**을 잠근다 —
    //   스케일 재조정 시에도 순서가 뒤집히면 실패한다.
    // containerStyles 는 rule 최상위 / `structure` 아래 / `structure.composition` 아래 3곳에
    //   나타난다 (`resolveEffectiveBoxShadow` 와 동일한 조회 순서).
    const shadowOf = (type: keyof typeof COMPONENT_RULES_TABLE) => {
      const rule = COMPONENT_RULES_TABLE[type] as {
        containerStyles?: { boxShadow?: string };
        structure?: {
          containerStyles?: { boxShadow?: string };
          composition?: { containerStyles?: { boxShadow?: string } };
        };
      };
      return (
        rule.containerStyles?.boxShadow ??
        rule.structure?.containerStyles?.boxShadow ??
        rule.structure?.composition?.containerStyles?.boxShadow
      );
    };

    expect([
      shadowOf("Tooltip"),
      shadowOf("Popover"),
      shadowOf("Modal"),
    ]).toEqual(["{shadow.sm}", "{shadow.md}", "{shadow.lg}"]);
  });

  it("Dialog 는 elevation 을 갖지 않는다 (소유자 = Modal)", () => {
    // RAC starter `Dialog.css` box-shadow 0건 + composition `Dialog.tsx` 주석
    //   ("should be used within a Modal overlay") 정합. ADR-166 Phase 4 에서 Skia 쪽
    //   `dialog_shadow` primitive 도 은퇴시켜 양 consumer 가 함께 '그림자 없음'이 됐다.
    const dialog = COMPONENT_RULES_TABLE.Dialog as {
      containerStyles?: { boxShadow?: string };
      structure?: {
        containerStyles?: { boxShadow?: string };
        composition?: { containerStyles?: { boxShadow?: string } };
      };
    };
    expect(
      dialog.containerStyles?.boxShadow ??
        dialog.structure?.containerStyles?.boxShadow ??
        dialog.structure?.composition?.containerStyles?.boxShadow,
    ).toBeUndefined();
  });
});
