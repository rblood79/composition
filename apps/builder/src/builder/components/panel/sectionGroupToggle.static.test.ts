/**
 * 섹션 그룹 토글의 단일 원천 결선 — 헤더 버튼과 ⌥S 가 같은 helper 를 쓰고,
 * 종전의 접기 전용 버튼 / `size === 4` 판정이 재도입되지 않는지 정적으로 고정한다.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFile(resolve(__dirname, "../../..", rel), "utf-8");

describe("section group toggle wiring", () => {
  it("Components header uses the shared toggle instead of a collapse-only button", async () => {
    const source = await read("builder/panels/components/ComponentList.tsx");

    expect(source).toContain(
      "<SectionGroupToggleButton sectionIds={compSectionIds} />",
    );
    expect(source).not.toContain("handleCollapseAll");
    expect(source).not.toContain('tooltip="Collapse all sections"');
    expect(source).not.toContain("ChevronsDownUp");
  });

  it("Styles ⌥S toggle judges the style group by id set, not by collapsed count", async () => {
    const source = await read("builder/panels/styles/StylesPanel.tsx");

    expect(source).toContain("useSectionGroupToggle(");
    expect(source).toContain("STYLE_PANEL_SECTION_IDS");
    expect(source).not.toContain("collapsedSections.size");
    expect(source).not.toContain("expandAll()");
  });

  it("collapseAll() default list is the exported constant, not a second literal", async () => {
    const source = await read(
      "builder/panels/styles/hooks/useSectionCollapse.ts",
    );

    expect(source).toContain("...(sectionIds ?? STYLE_PANEL_SECTION_IDS)");
    expect(source.match(/"typography"/g)?.length).toBe(1);
  });
});
