/**
 * S2 가 같은 이름의 스타일 컴포넌트를 내지 않는 타입은 가장 가까운 S2 패턴의 값을 쓴다
 * (2026-11-14, 사용자 「S2 대응 없음 컴포넌트를 S2 패턴으로」 — `docs/explanation/research/S2_MIGRATION_CHECKLIST_2026-11.md` §4).
 *
 * - Toolbar · Pagination = S2 `ActionButtonGroup` (`ActionButtonGroup.tsx:64-89` — RAC Toolbar 에 간격만:
 *   XS · S 4, M ~ XL 8. 상자 칠 · padding · 모서리 · 상태 칠 없음).
 * - Nav = 칠하지 않는 컨테이너 + Link (S2 에 칠하는 탐색 막대가 없다).
 * - Icon 은 대상이 아니다 (사용자 결정 2026-11-14 — 아이콘 자체가 S2 와 다르다).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { CATALOG_SIZE_PROPAGATION } from "../../../../../../packages/shared/src/catalog/document/sizePropagation";
import { REUSABLE_ORIGIN_TEMPLATES } from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";

const SHARED = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/shared/src",
);
const read = (path: string) => readFileSync(join(SHARED, path), "utf8");

type AnyRule = {
  sizes: Record<string, Record<string, unknown>>;
  variants: Record<
    string,
    { paint?: { backgroundColor?: Record<string, unknown> } }
  >;
  structure?: {
    stateStyles?: unknown;
    containerStyles?: Record<string, unknown>;
    composition?: {
      containerStyles?: Record<string, unknown>;
      staticSelectors?: Record<string, unknown>;
    };
  };
};
const rule = (type: string) =>
  (COMPONENT_RULES_TABLE as unknown as Record<string, AnyRule>)[type];

const ACTION_GROUP_GAP = { XS: 4, S: 4, M: 8, L: 8, XL: 8 };

describe.each(["Toolbar", "Pagination"])(
  "%s = S2 ActionButtonGroup 묶음 값",
  (type) => {
    it("크기 5 단 · 간격 XS · S 4, M ~ XL 8 · 상자 padding 없음", () => {
      const sizes = rule(type).sizes;
      expect(Object.keys(sizes)).toEqual(["XS", "S", "M", "L", "XL"]);
      expect(
        Object.fromEntries(
          Object.entries(sizes).map(([size, block]) => [size, block.gap]),
        ),
      ).toEqual(ACTION_GROUP_GAP);
      for (const block of Object.values(sizes)) {
        expect(block.paddingX).toBeUndefined();
        expect(block.paddingY).toBeUndefined();
      }
    });

    it("묶음 자신은 상태 칠이 없다 (focus ring · disabled 는 버튼의 것)", () => {
      expect(rule(type).structure?.stateStyles).toBeUndefined();
    });

    it("묶음의 size 가 안의 ActionButton 에 닿는다 (S2 group context)", () => {
      expect(CATALOG_SIZE_PROPAGATION[type]).toContain("ActionButton");
    });
  },
);

describe("Toolbar", () => {
  it("안의 ToggleButton 폭을 고정하지 않는다 (S2 ActionButton 폭 = 내용)", () => {
    expect(
      rule("Toolbar").structure?.composition?.staticSelectors,
    ).not.toHaveProperty(".react-aria-ToggleButton");
  });
});

describe("Pagination", () => {
  it("옛 렌더러의 class · 버튼 변수 잔재가 없다", () => {
    const composition = rule("Pagination").structure?.composition;
    expect(
      Object.keys(composition?.containerStyles ?? {}).filter((key) =>
        key.startsWith("--btn-"),
      ),
    ).toEqual([]);
    expect(
      Object.keys(composition?.staticSelectors ?? {}).filter((key) =>
        key.startsWith(".pagination-"),
      ),
    ).toEqual([]);
  });

  it("간격은 size 블록 하나가 정한다 (컨테이너에 따로 없음)", () => {
    const container = rule("Pagination").structure?.containerStyles ?? {};
    expect(container.gap).toBeUndefined();
    expect(container.justifyContent).toBeUndefined();
  });
});

describe("Nav = 칠하지 않는 컨테이너", () => {
  it("바탕 투명 · 고정 높이 · padding · 상태 칠 없음", () => {
    const nav = rule("Nav");
    expect(nav.variants.default.paint?.backgroundColor).toEqual({
      default: "{color.transparent}",
    });
    for (const block of Object.values(nav.sizes)) {
      expect(block.height).toBe(0);
      expect(block.paddingX).toBeUndefined();
      expect(block.paddingY).toBeUndefined();
    }
    expect(nav.structure?.stateStyles).toBeUndefined();
  });

  it("가로 줄 배치는 rule 이 갖는다 (DOM inline 아님)", () => {
    expect(rule("Nav").structure?.containerStyles).toMatchObject({
      display: "flex",
      alignItems: "center",
    });
    const dom = read("catalog/runtime/delegatedDom.runtime.ts");
    const nav = dom.slice(
      dom.indexOf("  nav: {"),
      dom.indexOf("  nav: {") + 700,
    );
    expect(nav).not.toContain('display: "flex"');
  });
});

describe("FileUpload", () => {
  it("진행 막대에 S2 가 지운 `variant` 를 넘기지 않는다", () => {
    expect(read("components/FileUploadActive.components.tsx")).not.toMatch(
      /variant="default"/,
    );
  });
});

describe("PreviewTrigger = S2 Popover 본체", () => {
  it("본체 폭을 따로 적지 않는다 (Popover rule 의 S2 크기별 폭 336 · 416 · 576)", () => {
    const overlay = REUSABLE_ORIGIN_TEMPLATES.find(
      (template) =>
        template.id === "lib:template:component-previewtrigger__overlay",
    )!;
    expect(overlay.visual).toEqual({});
    expect(
      Object.values(rule("Popover").sizes).map((block) => block.width),
    ).toEqual([336, 416, 576]);
  });
});
