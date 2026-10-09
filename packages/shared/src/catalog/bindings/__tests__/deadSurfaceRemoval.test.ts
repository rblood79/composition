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
 * - TagGroup/ListBox/GridList/Menu/Select/ComboBox.items (items-manager, 2026-10-09 사용자 「slot 방식과
 *   data binding 방식만 사용하는것이 레퍼런스에 맞는 방법이지 않나」): RAC collection 은 정적 = JSX
 *   자식 (composition 의 slot 노드), 동적 = `items` + 그리는 함수 (dataBinding 의 collection 행 +
 *   항목 노드 template) 둘뿐이다. 옛 `props.items` 인라인 배열은 ADR-256 노드 트리 전환 뒤 어느
 *   renderer 도 읽지 않았다. 항목별 Disabled 는 항목 노드 자신의 `isDisabled`.
 */
const REMOVED: Record<string, readonly string[]> = {
  Link: ["isExternal", "showExternalIcon"],
  Form: ["autoFocus", "restoreFocus"],
  TableView: ["allowsResizingColumns"],
  ListBox: ["isDisabled", "items"],
  GridList: ["isDisabled", "items"],
  Tree: ["isDisabled"],
  TagGroup: ["isDisabled", "items"],
  Menu: ["items", "isDisabled"],
  Select: ["items"],
  ComboBox: ["items"],
  // 2026-10-09 속성 감사 (사용자 「2번 삭제」): 노드가 대신하거나 아무도 읽지 않던 prop.
  Breadcrumbs: ["showRoot", "isMultiline", "items"],
  Tabs: ["showIndicator"],
  Tab: ["title"],
  Pagination: ["totalPages", "currentPage"],
  Tag: ["allowsRemoving"],
  CardView: ["columns", "gap"],
  SelectValue: ["placeholder"],
  DatePicker: ["placeholder", "showCalendarIcon"],
  DateRangePicker: ["placeholder", "showCalendarIcon"],
  DateInput: ["variant"],
  ColorPicker: ["label", "isDisabled"],
  ColorSwatchPicker: ["colorSpace", "columns"],
  ColorSlider: ["label"],
  FileUpload: ["acceptedFileTypes", "allowsMultiple", "acceptDirectory"],
  Input: ["value", "variant", "isDisabled", "isReadOnly", "isInvalid"],
  InlineAlert: ["heading", "children"],
  Card: ["footer", "orientation", "isSelectable"],
  Toast: ["defaultTitle", "defaultDescription", "timeout"],
  IllustratedMessage: ["variant"],
  Icon: ["variant"],
  Modal: ["size"],
  CalendarHeader: ["children", "locale", "calendarSystem"],
  CalendarGrid: ["locale", "calendarSystem"],
  SliderTrack: ["variant"],
  ProgressBarValue: ["variant"],
};
/** Values the owner gives the part (size propagation · derived props): kept, not edited. */
const HIDDEN: Record<string, readonly string[]> = {
  ProgressBarFill: ["variant", "size"],
  ProgressBarTrack: ["variant", "size"],
  MeterFill: ["variant", "size"],
  MeterTrack: ["variant", "size"],
  CalendarHeader: ["size"],
  CalendarGrid: ["size", "dayOffset", "totalDays", "todayDate", "defaultToday"],
  TagList: ["size"],
  SliderTrack: ["size"],
  DateInput: ["size"],
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

  for (const [type, keys] of Object.entries(HIDDEN))
    for (const key of keys)
      it(`${type}.${key} 는 owner 가 주는 값 — 패널에서 숨김`, () => {
        expect(
          getPrimitiveBinding(type)!.props.accepts[key]?.editorHidden,
        ).toBe(true);
      });

  it("같은 binding 의 살아있는 형제 surface 는 보존된다", () => {
    expect(getPrimitiveBinding("Link")!.props.accepts).toHaveProperty("target");
    expect(getPrimitiveBinding("Link")!.props.accepts).toHaveProperty("rel");
    expect(getPrimitiveBinding("CardView")!.props.accepts).toHaveProperty(
      "layout",
    );
    expect(getPrimitiveBinding("TableView")!.props.accepts).toHaveProperty(
      "allowsSorting",
    );
  });

  it("항목별 Disabled 는 항목 노드 자신의 isDisabled 다", () => {
    for (const type of ["ListBoxItem", "GridListItem", "Tag"])
      expect(getPrimitiveBinding(type)!.props.accepts, type).toHaveProperty(
        "isDisabled",
      );
  });

  it("컬렉션은 slot (자식 노드) 과 dataBinding 만 — items-manager 는 Chart 데이터에만", () => {
    for (const type of [
      "TagGroup",
      "ListBox",
      "GridList",
      "Menu",
      "Select",
      "ComboBox",
    ]) {
      const accepts = getPrimitiveBinding(type)!.props.accepts;
      expect(
        Object.values(accepts).some((field) => field.kind === "items-manager"),
        type,
      ).toBe(false);
    }
    expect(
      Object.values(getPrimitiveBinding("Chart")!.props.accepts).some(
        (field) => field.kind === "items-manager",
      ),
    ).toBe(true);
  });
});
