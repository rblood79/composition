/**
 * ADR-912 catalog SSOT collapse — shared container/structure resolver 계약 테스트.
 *
 * Phase 0 red tests (breakdown §3 Phase 0). resolver 가 `componentRulesTable` 의 단일 entry
 * 에서 base container layout / variant / size-value 를 파생하는지 검증. spec / TAG_SPEC_MAP /
 * implicitStyles mirror 를 경유하지 않는 단일 진입점 계약.
 *
 * kill-gate (breakdown §1 사용자 지침): resolver 가 Δ2 merge precedence + specs-import-0 으로
 * 깨끗하게 나오는지가 Phase 2(85 entry byte-diff-0) 진입 자격.
 */

import { describe, expect, it } from "vitest";
import {
  resolveCatalogContainerBase,
  resolveCatalogContainerVariants,
  resolveCatalogStructure,
  resolveCatalogSizeField,
  CATALOG_LAYOUT_STYLES,
} from "../resolvers/resolveCatalogContainer";

describe("resolveCatalogStructure", () => {
  it("TextField → structure.composition.layout = flex-column (STRUCTURE_META 동형 이관분)", () => {
    const structure = resolveCatalogStructure("TextField");
    // STRUCTURE_META 동형 (Phase 2): layout 은 composition 안에 있음 (top-level 아님).
    expect(structure?.composition?.layout).toBe("flex-column");
  });

  it("unknown type → undefined", () => {
    expect(resolveCatalogStructure("NotARealComponent")).toBeUndefined();
  });
});

describe("resolveCatalogContainerBase (Δ2 merge precedence)", () => {
  it("TextField base → flex column (CATALOG_LAYOUT_STYLES['flex-column'] 파생)", () => {
    const base = resolveCatalogContainerBase("TextField");
    expect(base.display).toBe("flex");
    expect(base["flex-direction"]).toBe("column");
    expect(base["align-items"]).toBe("flex-start");
  });

  it("TextField → structure.composition.containerStyles 가 layout 위에 merge (width fit-content)", () => {
    const base = resolveCatalogContainerBase("TextField");
    expect(base.width).toBe("fit-content");
  });

  it("top-level rule.containerStyles 가 last-wins (composition override)", () => {
    // TagGroup 은 componentRulesTable 에 top-level containerStyles 보유 — last-wins 검증.
    const base = resolveCatalogContainerBase("TagGroup");
    expect(base.display).toBe("flex");
  });

  it("unknown type → 빈 객체", () => {
    expect(resolveCatalogContainerBase("NotARealComponent")).toEqual({});
  });
});

describe("resolveCatalogContainerVariants (Δ3 plain-data 재작성)", () => {
  it("TextField labelPosition=side → flex-row + align-items flex-start", () => {
    const { styles } = resolveCatalogContainerVariants("TextField", {
      labelPosition: "side",
    });
    expect(styles["flex-direction"]).toBe("row");
    expect(styles["align-items"]).toBe("flex-start");
  });

  it("TextField labelPosition=top (또는 미지정) → side override 없음", () => {
    const { styles } = resolveCatalogContainerVariants("TextField", {
      labelPosition: "top",
    });
    expect(styles["flex-direction"]).toBeUndefined();
  });

  it("unknown type → 빈 styles/nested", () => {
    expect(resolveCatalogContainerVariants("NotARealComponent", {})).toEqual({
      styles: {},
      nested: [],
    });
  });
});

describe("resolveCatalogSizeField (Δ4 size-value 단일 진입)", () => {
  it("ProgressBarTrack height (md) → catalog sizes.md.height", () => {
    const h = resolveCatalogSizeField("ProgressBarTrack", "md", "height");
    expect(typeof h).toBe("number");
    expect(h).toBe(8); // VALUE_FILL_TRACK_HEIGHT.md mirror 와 byte 일치
  });

  it("Checkbox gap (md) → catalog sizes.md.gap", () => {
    const g = resolveCatalogSizeField("Checkbox", "md", "gap");
    expect(typeof g).toBe("number");
    expect(g).toBe(8); // INDICATOR_SIZES.md.gap mirror 와 byte 일치
  });

  it("unknown type/field → undefined", () => {
    expect(
      resolveCatalogSizeField("NotARealComponent", "md", "height"),
    ).toBeUndefined();
  });
});

describe("CATALOG_LAYOUT_STYLES (shared 단일 layout token table)", () => {
  it("flex-column / flex-row / inline-flex / grid 4종 정의", () => {
    expect(CATALOG_LAYOUT_STYLES["flex-column"]).toBeDefined();
    expect(CATALOG_LAYOUT_STYLES["flex-row"]).toBeDefined();
    expect(CATALOG_LAYOUT_STYLES["inline-flex"]).toBeDefined();
    expect(CATALOG_LAYOUT_STYLES["grid"]).toBeDefined();
  });

  it("flex-column = display flex + direction column + align flex-start", () => {
    const s = CATALOG_LAYOUT_STYLES["flex-column"];
    expect(s.display).toBe("flex");
    expect(s["flex-direction"]).toBe("column");
    expect(s["align-items"]).toBe("flex-start");
  });
});
