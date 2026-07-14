import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * Disclosure trigger 헤더가 **부모 size 의 font-size 를 상속**하는지 (2026-07-15, 사용자 적발:
 * "Disclosure size 변경 시 DisclosureHeader 변경 안 됨(css, skia)").
 *
 * **결함**: DOM 헤더는 `<Disclosure><Heading><Button slot="trigger">` 구조인데, 이 체인의
 * **두 노드가 각자 자기 font-size 를 선언**해 부모 `.react-aria-Disclosure[data-size]` 의
 * font-size 상속을 끊었다:
 *
 *   1. `<Heading>` → `<h3>` 로 렌더 → **브라우저 기본 h3 font-size(16px)**
 *   2. `.react-aria-Button` base → `font-size: var(--text-sm)`(14px) (Button.css:35)
 *
 * → 헤더가 전 size 14px 고정. Skia 는 `DisclosureHeader.sizes.fontSize`(sm 12 / md 14 / lg 16)를
 *   그리므로 **md 에서만 우연히 일치**하고 sm/lg 는 DOM↔Skia 비대칭.
 *   (실측 sm: Disclosure 12px → Heading 16px → Button 16px, 기대 12px.)
 *
 * **`inherit` 는 직계 부모를 따른다** — Button 에만 넣으면 Heading 의 16px 을 물려받는다.
 * 체인의 **두 노드 모두** inherit 해야 Disclosure 의 size 폰트가 헤더까지 내려온다.
 *
 * 같은 체인의 `justify-content` / `--icon-size` 도 "Button base 가 부모를 덮는다" 는 동일 함정을
 * 겪었다 (catalog 주석 참조) — 이 계약은 그 세 번째 사례를 고정한다.
 */

type StaticSelectors = Record<string, Record<string, string>>;

function disclosureStaticSelectors(): StaticSelectors {
  const rule = COMPONENT_RULES_TABLE.Disclosure as unknown as {
    structure?: { composition?: { staticSelectors?: StaticSelectors } };
  };
  const selectors = rule?.structure?.composition?.staticSelectors;
  expect(selectors, "Disclosure staticSelectors").toBeDefined();
  return selectors!;
}

describe("Disclosure trigger 헤더 font-size 상속 체인", () => {
  it.each([
    [".react-aria-Heading", "h3 기본 font-size(16px) 가 상속을 끊는다"],
    [
      ".react-aria-Button[slot='trigger']",
      "Button base font-size(--text-sm=14px) 가 상속을 끊는다",
    ],
  ])("%s 는 font-size: inherit — %s", (selector) => {
    const block = disclosureStaticSelectors()[selector];
    expect(block, `${selector} 규칙 존재`).toBeDefined();
    // 하나라도 빠지면 체인이 끊겨 헤더가 조상의 잘못된 폰트를 물려받는다.
    expect(block["font-size"], `${selector} font-size`).toBe("inherit");
  });

  /**
   * 상속이 **올바른 값**을 나르는지 — `Disclosure.sizes.fontSize`(상속 source)와
   * `DisclosureHeader.sizes.fontSize`(Skia 가 그리는 값)가 size 별로 같아야 대칭이 성립한다.
   * 둘이 갈리면 inherit 는 DOM 을 "변하게" 만들 뿐 Skia 와 맞추지는 못한다.
   */
  it("상속 source(Disclosure.sizes) = Skia source(DisclosureHeader.sizes) fontSize", () => {
    const disclosure = COMPONENT_RULES_TABLE.Disclosure as unknown as {
      sizes: Record<string, { fontSize?: string }>;
    };
    const header = COMPONENT_RULES_TABLE.DisclosureHeader as unknown as {
      sizes: Record<string, { fontSize?: string }>;
    };

    const sizes = ["sm", "md", "lg"] as const;
    for (const size of sizes) {
      expect(
        disclosure.sizes[size]?.fontSize,
        `Disclosure.sizes.${size}.fontSize`,
      ).toBe(header.sizes[size]?.fontSize);
    }

    // 세 size 가 실제로 **서로 다른** 값이어야 한다 (전부 같으면 이 계약이 무의미).
    const distinct = new Set(sizes.map((s) => header.sizes[s]?.fontSize));
    expect(distinct.size, "size 별 fontSize 가 실제로 갈린다").toBe(3);
  });

  /**
   * **DisclosureGroup.sizes.fontSize 는 시각에 도달하지 않는다 — 의도적 무증상** (2026-07-15).
   *
   * 실측하면 그룹만 스케일이 어긋난다:
   *   Disclosure/Header/Content : text-xs(12) / text-sm(14) / text-base(16)
   *   DisclosureGroup           : text-sm(14) / text-sm(14) / text-lg(18)   ← sm=md, lg 는 +2px
   *
   * **버그처럼 보이지만 소비처가 없다**:
   *  - **DOM**: 자식 `.react-aria-Disclosure[data-size]` 가 자기 font-size 를 선언해 그룹의 값을
   *    덮는다 (size 전파로 자식이 자기 size 를 갖게 된 뒤로는 항상 그렇다).
   *  - **Skia**: `DisclosureGroup` 은 `SHELL_ONLY_CONTAINER_TAGS`(buildSpecNodeData.ts:162) 라
   *    빈 shell 만 그린다 — 텍스트 shape 를 emit 하지 않는다. factory 자식도 Disclosure 뿐이라
   *    그룹이 직접 그리는 텍스트가 없다.
   *
   * → **고치지 않는다** (과잉 수정 회피). 본 테스트는 "그래서 안 고쳤다" 는 판단을 고정한다.
   * 나중에 그룹이 자기 텍스트를 갖게 되거나 shell-only 에서 빠지면 **이 테스트가 먼저 깨져야**
   * 하므로, 그때 스케일을 Disclosure 와 맞추면 된다.
   */
  it("DisclosureGroup.sizes.fontSize 는 소비처 없음 — Disclosure 와 갈려도 무증상 (의도)", () => {
    const group = COMPONENT_RULES_TABLE.DisclosureGroup as unknown as {
      sizes: Record<string, { fontSize?: string }>;
      structure?: {
        composition?: { containerStyles?: Record<string, string> };
      };
    };
    const disclosure = COMPONENT_RULES_TABLE.Disclosure as unknown as {
      sizes: Record<string, { fontSize?: string }>;
    };

    // 현 상태를 **사실로 고정** — 갈려 있고, 그래도 무증상이다.
    expect(group.sizes.sm?.fontSize).toBe(group.sizes.md?.fontSize);
    expect(group.sizes.lg?.fontSize).not.toBe(disclosure.sizes.lg?.fontSize);

    // 무증상의 근거: Skia 는 shell-only(텍스트 미emit), DOM 은 자식이 덮는다.
    //   그룹이 자기 텍스트를 갖게 되면 이 전제가 깨지므로 그때 스케일을 맞출 것.
    expect(
      group.structure?.composition?.containerStyles,
      "그룹 containerStyles (자식이 덮는 대상)",
    ).toBeDefined();
  });
});
