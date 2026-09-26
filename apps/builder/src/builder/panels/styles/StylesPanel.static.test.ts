import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("StylesPanel canonical selected data contract", () => {
  it("scopes ToggleButtonGroup overrides to the Styles panel subtree", async () => {
    const styles = await readFile(
      resolve(__dirname, "StylesPanel.css"),
      "utf-8",
    );

    expect(styles).toContain(
      ".styles-panel-groups .react-aria-ToggleButtonGroup",
    );
    expect(styles).not.toMatch(/^\.react-aria-ToggleButtonGroup\s*\{/m);
  });

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

  it("wires ADR-154 ResponsiveSection", async () => {
    const source = await readFile(
      resolve(__dirname, "StylesPanel.tsx"),
      "utf-8",
    );

    // override 요약/편집 섹션이 AllSections 에 포함
    expect(source).toContain("<ResponsiveSection />");
  });

  it("ResponsiveSection wires override opt-in menu + lrow list + visibility seg (locked desktop)", async () => {
    const source = await readFile(
      resolve(__dirname, "sections/ResponsiveSection.tsx"),
      "utf-8",
    );

    // 활성 breakpoint override prop 목록 + 값 (어느 필드가 override 인지 · 「width · 100%」)
    expect(source).toContain("useResponsiveOverrides");
    expect(source).toContain("activeOverriddenProps");
    expect(source).toContain("activeOverrideValues");
    // panel-ui 04: visibility 는 다중 선택 seg — desktop=base 는 잠긴 칸 (표시만)
    expect(source).toContain('selectionMode="multiple"');
    expect(source).toContain('const locked = bp === "desktop"');
    expect(source).toContain("isDisabled={locked}");
    expect(source).not.toContain("<ResponsiveVisibilityEditor");
    // ADR-154 개정 1: override 추가/제거는 명시적 opt-in 토글 액션 경유
    expect(source).toContain("useSetResponsiveStyleOverrideEnabled");
    // 켤 때 catalog 기본값 seed 를 함께 넘긴다 (ADR-236 후속 — 켜는 순간 시각 변화 0)
    expect(source).toMatch(
      /setOverrideEnabled\(\s*key,\s*true,\s*resolveTierSeedDefaults\(/,
    );
    expect(source).toContain("setOverrideEnabled(key, false)");
    // 추가는 Overrides 절 헤더 「+」 메뉴 (PropertyRowMenu icon=add) — select/chip 아님
    expect(source).toContain("PropertyRowMenu");
    expect(source).toContain("icon={AddIcon}");
    expect(source).not.toContain("responsive-chip");
    expect(source).not.toContain("<select");
  });
});
