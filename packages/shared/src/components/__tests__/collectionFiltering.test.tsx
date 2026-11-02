import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TagGroup } from "../TagGroup";
import { ListBox } from "../ListBox";
import { GridList } from "../GridList";

describe("공용 collection DOM 데이터 범위·필터", () => {
  it("TagGroup items 150개를 표시하고 100번째 이후 항목도 검색한다", () => {
    const items = Array.from({ length: 150 }, (_, i) => ({
      id: String(i),
      label: `row-${i}`,
    }));
    const html = renderToStaticMarkup(
      <TagGroup aria-label="Tags" items={items} />,
    );
    expect(html.match(/role="row"/g)).toHaveLength(150);
    const filtered = renderToStaticMarkup(
      <TagGroup aria-label="Tags" items={items} filterText="row-149" />,
    );
    expect(filtered).toContain("row-149");
    expect(filtered.match(/role="row"/g)).toHaveLength(1);
  });

  for (const Component of [TagGroup, ListBox, GridList]) {
    it(`${Component.name}: 0·false를 검색하고 사용자 필터와 결합한다`, () => {
      const items = [
        { id: "zero", label: "Zero", count: 0, enabled: false },
        { id: "ten", label: "Ten", count: 10, enabled: true },
        { id: "missing", label: "Missing", count: null, enabled: null },
      ];
      const numeric = renderToStaticMarkup(
        <Component
          aria-label="Filter"
          items={items}
          filterFields={["count"]}
          filterText=" 0 "
          filter={(item) => item.count !== 10}
        />,
      );
      expect(numeric).toContain("Zero");
      expect(numeric).not.toContain("Ten");
      expect(numeric).not.toContain("Missing");
      const boolean = renderToStaticMarkup(
        <Component
          aria-label="Filter"
          items={items}
          filterFields={["enabled"]}
          filterText="false"
        />,
      );
      expect(boolean).toContain("Zero");
      expect(boolean).not.toContain("Ten");
    });
  }
});
