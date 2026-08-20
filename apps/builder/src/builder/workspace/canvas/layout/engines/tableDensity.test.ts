import { describe, expect, it } from "vitest";

import { applyImplicitStyles } from "./implicitStyles";
import { calculateContentHeight } from "./utils";
import type { CanvasLayoutNode } from "../layoutNode";

/**
 * TableView density → 자손 Column/Cell 세로 padding 위임 주입 (2026-08-21).
 *
 * Spectrum `table.item.padding × density` 모델 — 행 높이는 size 축이 정하고 density 는
 * item 내부 여백만 바꾼다. density **값**은 TableView 에 있고 **소비 주체**는 Column/Cell
 * (catalog `densities`) 이라, 행을 소유한 컨테이너(TableHeader→Column, Row→Cell)가 위임
 * 주입한다. `calculateContentHeight` §1.56 이 `style.paddingTop ?? style.padding` 을 우선
 * 읽으므로, 주입된 longhand 가 행 높이(= 텍스트 24 + 상하 padding)를 그대로 만든다.
 */

const node = (
  id: string,
  type: string,
  parentId: string | null,
  props: Record<string, unknown> = {},
): CanvasLayoutNode =>
  ({
    id,
    type,
    page_id: "page-1",
    parent_id: parentId,
    props,
  }) as unknown as CanvasLayoutNode;

/** TableView > TableBody > Row > Cell 트리를 세우고 Row 에 대해 주입을 돌린다. */
function runRow(density: string | undefined, cellProps = {}) {
  const tableView = node("tv-1", "TableView", "body", { density });
  const tableBody = node("tb-1", "TableBody", "tv-1");
  const row = node("row-1", "Row", "tb-1");
  const cell = node("cell-1", "Cell", "row-1", cellProps);
  const elementById = new Map<string, CanvasLayoutNode>([
    ["tv-1", tableView],
    ["tb-1", tableBody],
    ["row-1", row],
    ["cell-1", cell],
  ]);
  const result = applyImplicitStyles(row, [cell], () => [], elementById);
  return (result.filteredChildren[0].props?.style ?? {}) as Record<
    string,
    unknown
  >;
}

describe("TableView density → Column/Cell padding 위임", () => {
  it("compact/spacious 가 서로 다른 세로 padding 을 자손 Cell 에 준다", () => {
    expect(runRow("compact")).toMatchObject({
      paddingTop: 4,
      paddingBottom: 4,
    });
    expect(runRow("spacious")).toMatchObject({
      paddingTop: 12,
      paddingBottom: 12,
    });
  });

  it("density 미지정이면 defaultDensity(regular=8) — 기존 프로젝트 회귀 0", () => {
    expect(runRow(undefined)).toMatchObject({
      paddingTop: 8,
      paddingBottom: 8,
    });
  });

  it("사용자 style 이 우선 — Inspector 편집을 덮지 않는다", () => {
    const style = runRow("spacious", { style: { paddingTop: 2 } });
    expect(style.paddingTop).toBe(2);
    expect(style.paddingBottom).toBe(12);
  });

  it("가로 여백은 건드리지 않는다 — Spectrum 규칙(세로 간격만)", () => {
    expect(runRow("compact")).not.toHaveProperty("paddingLeft");
    expect(runRow("compact")).not.toHaveProperty("paddingRight");
  });

  it("TableHeader → Column 경로도 같은 값을 준다", () => {
    const tableView = node("tv-1", "TableView", "body", {
      density: "compact",
    });
    const header = node("th-1", "TableHeader", "tv-1");
    const column = node("col-1", "Column", "th-1");
    const elementById = new Map<string, CanvasLayoutNode>([
      ["tv-1", tableView],
      ["th-1", header],
      ["col-1", column],
    ]);
    const result = applyImplicitStyles(header, [column], () => [], elementById);
    expect(result.filteredChildren[0].props?.style).toMatchObject({
      paddingTop: 4,
      paddingBottom: 4,
    });
  });

  it("주입값이 그대로 행 높이가 된다 — 이중 계산 없이 텍스트 24 + paddingY×2", () => {
    // applyImplicitStyles 주입 → calculateContentHeight → (엔진이 style padding 을 더함)
    //   경로를 그대로 이어 붙여, 라이브 실측(compact 32 / regular 40 / spacious 48)과
    //   같은 값이 나오는지 확인한다.
    const rowHeight = (density: string) => {
      const style = runRow(density);
      const cell = node("cell-1", "Cell", "row-1", {
        children: "Alice",
        style,
      });
      const contentH = calculateContentHeight(cell);
      const enginePad =
        (style.paddingTop as number) + (style.paddingBottom as number);
      return contentH + enginePad;
    };
    expect(rowHeight("compact")).toBe(32);
    expect(rowHeight("regular")).toBe(40);
    expect(rowHeight("spacious")).toBe(48);
  });

  it("style 에 세로 padding 이 없으면 catalog paddingY 를 실어 준다 — 주입 밖 경로 보존", () => {
    // 엔진이 더해 줄 style padding 이 없으므로 여기서 border-box 를 내야 40 이 유지된다
    //   (catalog containerStyles.padding 은 leaf Column/Cell 에 도달하지 않는다).
    const bare = node("cell-x", "Cell", "row-x", { children: "Alice" });
    expect(calculateContentHeight(bare)).toBe(40);
  });

  it("조상에 TableView 가 없는 Row 는 주입 대상 아님 — data-driven Table 은 density 축 밖", () => {
    const table = node("t-1", "Table", "body", { density: "spacious" });
    const row = node("row-1", "Row", "t-1");
    const cell = node("cell-1", "Cell", "row-1");
    const elementById = new Map<string, CanvasLayoutNode>([
      ["t-1", table],
      ["row-1", row],
      ["cell-1", cell],
    ]);
    const result = applyImplicitStyles(row, [cell], () => [], elementById);
    const style = (result.filteredChildren[0].props?.style ?? {}) as Record<
      string,
      unknown
    >;
    expect(style.paddingTop).toBeUndefined();
    expect(style.paddingBottom).toBeUndefined();
  });
});
