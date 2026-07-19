import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("StylesPanel canonical selected data contract", () => {
  it("uses selected element data instead of direct element-map reads for panel type/style", async () => {
    const source = await readFile(
      resolve(__dirname, "StylesPanel.tsx"),
      "utf-8",
    );

    expect(source).toContain(
      "const selectedElement = useDebouncedSelectedElementData();",
    );
    expect(source).toContain("selectedElement?.style");
    // 계약의 핵심은 "panel 이 element map 을 직접 읽지 않는다" 다. 과거엔
    // `const type = selectedElement?.type ?? null;` 도 함께 검사했으나, 현재 패널은
    // element type 을 아예 쓰지 않는다 (store 접근은 selectedElementId 존재 여부뿐) —
    // 사라진 구현 세부에 앵커하지 않고 element-map 직접 조회 금지만 가드한다.
    expect(source).not.toContain("s.elementsMap.get(id)");
    expect(source).not.toContain("s.elementsMap");
  });

  it("wires ADR-154 breakpoint 배지 + ResponsiveSection", async () => {
    const source = await readFile(
      resolve(__dirname, "StylesPanel.tsx"),
      "utf-8",
    );

    // 활성 breakpoint 를 항상 표시하는 헤더 배지
    expect(source).toContain("BreakpointHeaderBadge");
    expect(source).toContain("s.activeBreakpoint");
    // override 요약/편집 섹션이 AllSections 에 포함
    expect(source).toContain("<ResponsiveSection />");
  });

  it("ResponsiveSection wires override chips + visibility editor (locked desktop)", async () => {
    const source = await readFile(
      resolve(__dirname, "sections/ResponsiveSection.tsx"),
      "utf-8",
    );

    // 활성 breakpoint override prop 목록 (어느 필드가 override 인지)
    expect(source).toContain("useResponsiveOverrides");
    expect(source).toContain("activeOverriddenProps");
    // desktop=base lock 으로 visibility 편집기 배선
    expect(source).toContain("ResponsiveVisibilityEditor");
    expect(source).toContain('lockedBreakpoints={["desktop"]}');
    // override 제거는 활성 breakpoint clear 재사용
    expect(source).toContain('updateSelectedStyle(prop, "")');
  });
});
