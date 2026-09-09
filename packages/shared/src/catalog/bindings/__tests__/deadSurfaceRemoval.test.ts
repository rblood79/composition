import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../index";

/**
 * Properties 패널 D2 대조 (2026-09-10) — 패널에는 보이지만 DOM·Skia 어느 쪽도 읽지 않던
 * accepts 8건을 제거했다. 되살리려면 두 leg 의 소비처를 먼저 두고 이 표에서 빼야 한다.
 *
 * - Link.isExternal/showExternalIcon: RSP 미규정 custom. canonical Preview 는 raw RAC.Link 라
 *   wrapper(Link.tsx)의 아이콘 합성이 안 탔다. 외부 링크는 RAC `target`/`rel` 로 표현.
 * - Form.autoFocus/restoreFocus: RAC FormProps 에 없음. raw RAC.Form 이 무시.
 * - Breadcrumbs.showRoot/isMultiline: RSP v3 개념이나 미구현 (소비처 0).
 * - TableView.allowsResizingColumns: 소비처 0.
 * - CardView.columns: renderCardView 는 gap 만 읽는다. S2 CardView 에도 columns 축 없음.
 * - ListBox/GridList/Tree/TagGroup.isDisabled (컬렉션 전체): RAC/RSP 컬렉션은 `disabledKeys`·항목별
 *   isDisabled 만 둔다. wrapper 가 안 읽고 Skia 항목 투영에도 부모 상태가 없어 두 leg 모두 dead 였다.
 */
const REMOVED: Record<string, readonly string[]> = {
  Link: ["isExternal", "showExternalIcon"],
  Form: ["autoFocus", "restoreFocus"],
  Breadcrumbs: ["showRoot", "isMultiline"],
  TableView: ["allowsResizingColumns"],
  CardView: ["columns"],
  ListBox: ["isDisabled"],
  GridList: ["isDisabled"],
  Tree: ["isDisabled"],
  TagGroup: ["isDisabled"],
};

describe("binding.accepts — dead 편집 surface 제거 (2026-09-10)", () => {
  for (const [type, keys] of Object.entries(REMOVED)) {
    for (const key of keys) {
      it(`${type}.accepts 에 ${key} 가 없다`, () => {
        const binding = getPrimitiveBinding(type);
        expect(binding).toBeDefined();
        expect(binding!.props.accepts).not.toHaveProperty(key);
      });
    }
  }

  it("같은 binding 의 살아있는 형제 surface 는 보존된다", () => {
    expect(getPrimitiveBinding("Link")!.props.accepts).toHaveProperty("target");
    expect(getPrimitiveBinding("Link")!.props.accepts).toHaveProperty("rel");
    expect(getPrimitiveBinding("CardView")!.props.accepts).toHaveProperty(
      "gap",
    );
    expect(getPrimitiveBinding("TableView")!.props.accepts).toHaveProperty(
      "allowsSorting",
    );
  });

  it("항목별 Disabled 는 items-manager itemSchema 에 남아 있다", () => {
    for (const type of ["ListBox", "GridList", "TagGroup"]) {
      const items = getPrimitiveBinding(type)!.props.accepts.items;
      const keys = items?.itemsManager?.itemSchema.map((f) => f.key) ?? [];
      expect(keys, type).toContain("isDisabled");
    }
  });
});
