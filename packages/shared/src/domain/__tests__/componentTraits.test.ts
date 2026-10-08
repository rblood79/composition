import { describe, expect, it } from "vitest";
import {
  componentContractMap,
  componentOwnerTypes,
  componentTypeSet,
  containerTypeSet,
  getComponentTraits,
  hasComponentFamily,
} from "../componentTraits";

/**
 * ADR-236 Phase 2 동등성 게이트 — 파생 전 소비처 리터럴을 기대값으로 둔다. 파생 집합이 한 타입이라도
 * 다르면 canvas · preview 동작이 조용히 바뀌므로, 차이는 이 테스트를 고치는 별도 커밋 + live 로 다룬다.
 */
const sorted = (set: ReadonlySet<string>) => [...set].sort();
const literal = (values: readonly string[]) => [...new Set(values)].sort();

describe("componentTraits — 파생 집합 == 옛 리터럴", () => {
  it("structural (dropTargetResolver STRUCTURAL_CONTAINER_TYPES, 소문자)", () => {
    expect(sorted(containerTypeSet("structural", { lowercase: true }))).toEqual(
      literal([
        "body",
        "box",
        "card",
        "cardcontent",
        "cardfooter",
        "cardheader",
        "cardpreview",
        "container",
        "frame",
        "group",
        "section",
      ]),
    );
  });

  it("structural − body (editorPresentationSpacingCapability PADDING_CONTAINER_TYPES)", () => {
    const padding = [
      ...containerTypeSet("structural", { lowercase: true }),
    ].filter((type) => type !== "body");
    expect([...padding].sort()).toEqual(
      literal([
        "box",
        "card",
        "cardcontent",
        "cardfooter",
        "cardheader",
        "cardpreview",
        "container",
        "frame",
        "group",
        "section",
      ]),
    );
  });

  it("textHost ∪ inputValue (useTextEdit TEXT_ELEMENT_TAGS)", () => {
    const union = new Set([
      ...componentTypeSet("textHost"),
      ...componentTypeSet("inputValue"),
    ]);
    expect(sorted(union)).toEqual(
      literal([
        "Text",
        "Heading",
        "Label",
        "Paragraph",
        "Link",
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "span",
        "a",
        "label",
        "button",
        "Description",
        "Strong",
        "Em",
        "Code",
        "Tag",
        "Badge",
        "Button",
        "ToggleButton",
        "Input",
        "TextField",
        "TextInput",
        "SearchField",
        "TextArea",
      ]),
    );
  });

  it("freeContentHost (slotHostPolicy FRAME_SLOT_HOST_TYPES, 소문자)", () => {
    expect(
      sorted(componentTypeSet("freeContentHost", { lowercase: true })),
    ).toEqual(
      literal([
        "box",
        "cardcontent",
        "cardfooter",
        "cardheader",
        "cardpreview",
        "frame",
        "group",
        "popover",
        "section",
        "tooltip",
      ]),
    );
  });

  it("textHost (useCanvasElementSelectionHandlers TEXT_EDITABLE_TAGS)", () => {
    expect(sorted(componentTypeSet("textHost"))).toEqual(
      literal([
        "Text",
        "Heading",
        "Label",
        "Paragraph",
        "Link",
        "Description",
        "Strong",
        "Em",
        "Code",
        "Button",
        "ToggleButton",
        "Tag",
        "Badge",
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "span",
        "a",
        "label",
        "button",
      ]),
    );
  });

  it("inputValue (useTextEdit INPUT_VALUE_EDIT_TAGS)", () => {
    expect(sorted(componentTypeSet("inputValue"))).toEqual(
      literal(["Input", "TextField", "TextInput", "SearchField", "TextArea"]),
    );
  });

  it("buttonChildHost (BUTTON_CHILD_HOST_TAGS · LABEL_EDIT_HOST_TAGS)", () => {
    expect(sorted(componentTypeSet("buttonChildHost"))).toEqual(
      literal(["Button", "ToggleButton"]),
    );
  });

  it("action (useElementCreator ACTION_TAGS)", () => {
    expect(sorted(componentTypeSet("action"))).toEqual(
      literal([
        "Button",
        "ToggleButton",
        "Link",
        "ActionButtonGroup",
        "ButtonGroup",
      ]),
    );
  });

  it("image (tagSpecMap IMAGE_TAGS · layout IMAGE_INTRINSIC_TAGS 소문자)", () => {
    expect(sorted(componentTypeSet("image"))).toEqual(
      literal(["Image", "Avatar", "Logo", "Thumbnail"]),
    );
    expect(sorted(componentTypeSet("image", { lowercase: true }))).toEqual(
      literal(["image", "avatar", "logo", "thumbnail"]),
    );
  });

  it("textInputField (buildSpecNodeData FORM_INHERITING_FIELD_TAGS)", () => {
    expect(sorted(componentTypeSet("textInputField"))).toEqual(
      literal(["TextField", "TextArea", "NumberField", "SearchField"]),
    );
  });

  it("DateInput 소유자 (buildSpecNodeData DATE_INPUT_PARENT_TAGS)", () => {
    expect([...componentOwnerTypes("DateInput")].sort()).toEqual(
      literal(["DateField", "TimeField", "DatePicker", "DateRangePicker"]),
    );
  });

  it("selectionItem (구 canonicalRefResolution SELECTION_FLAG_ITEM_TYPES)", () => {
    expect(sorted(componentTypeSet("selectionItem"))).toEqual(
      literal(["ListBoxItem", "GridListItem"]),
    );
  });

  it("staticCollectionItem (구 CanonicalNodeRenderer STATIC_ITEM_TYPES)", () => {
    expect(sorted(componentTypeSet("staticCollectionItem"))).toEqual(
      literal(["Tab", "Tag", "ListBoxItem", "GridListItem", "Breadcrumb"]),
    );
  });

  it("itemSlotCollection (구 CanonicalNodeRenderer ITEM_SLOT_COLLECTIONS, 소문자)", () => {
    expect(
      sorted(componentTypeSet("itemSlotCollection", { lowercase: true })),
    ).toEqual(literal(["listbox", "gridlist", "menu", "taggroup"]));
  });

  it("disablingGroup (구 canonicalRefResolution DISABLING_GROUP_TYPES)", () => {
    expect(sorted(componentTypeSet("disablingGroup"))).toEqual(
      literal([
        "RadioGroup",
        "CheckboxGroup",
        "ToggleButtonGroup",
        "TagGroup",
        "Tabs",
        "ListBox",
        "GridList",
      ]),
    );
  });
});

describe("componentTraits — nestingRules 층 2 파생", () => {
  // ADR-256 G0 ② — 설치 RAC 1.21.0 을 마운트해 직계에 항목이 아닌 자식을 넣으면 버리는 부품
  // (`apps/builder/scripts/adr256-g0-rac-inventory.mjs` 의 childKind). MenuSection · GridListSection 은
  // ListBoxSection 과 같은 section 부품이다.
  it("항목 목록 부품 (STRICT_COLLECTION_PARENT_TYPES) = RAC 가 자유 내용을 버리는 부품", () => {
    expect(sorted(containerTypeSet("collection"))).toEqual(
      literal([
        "ListBox",
        "ListBoxSection",
        "Menu",
        "MenuSection",
        // ADR-256 Phase 5g: RAC SubmenuTrigger reads its item and Popover (`children[0]` · `[1]`).
        "SubmenuTrigger",
        "GridList",
        "GridListSection",
        "Tree",
        "TreeItem",
        "TagList",
        "TabList",
        "Table",
        "TableHeader",
        "TableBody",
        "Row",
        "Breadcrumbs",
        "ColorSwatchPicker",
      ]),
    );
  });

  // 값 배열 순서까지 같아야 한다 — 위반 메시지 (`allowed.join`) 가 이 순서로 나간다.
  it("받는 항목 (RAC_COLLECTION_CHILD_TYPES) — 항목 목록 부품만", () => {
    expect(componentContractMap("children")).toStrictEqual({
      ListBox: ["ListBoxItem", "ListBoxSection", "Section", "Header"],
      ListBoxSection: ["Header", "ListBoxItem"],
      Menu: [
        "MenuItem",
        "SubmenuTrigger",
        "MenuSection",
        "Section",
        "Separator",
        "Header",
      ],
      MenuSection: ["Header", "MenuItem", "SubmenuTrigger"],
      SubmenuTrigger: ["MenuItem", "Popover"],
      GridList: ["GridListItem", "GridListSection"],
      GridListSection: ["Header", "GridListItem"],
      TagList: ["Tag"],
      Breadcrumbs: ["Breadcrumb"],
      TabList: ["Tab"],
      Table: ["TableHeader", "TableBody"],
      TableHeader: ["Column"],
      TableBody: ["Row"],
      Row: ["Cell"],
      Tree: ["TreeItem"],
      TreeItem: ["TreeItem", "TreeItemContent"],
      ColorSwatchPicker: ["ColorSwatchPickerItem"],
    });
    for (const type of Object.keys(componentContractMap("children")))
      expect(containerTypeSet("collection").has(type), type).toBe(true);
  });

  it("소유자 (RAC_SUBPART_OWNER_TYPES)", () => {
    expect(componentContractMap("owners")).toStrictEqual({
      Tab: ["TabList"],
      TabList: ["Tabs"],
      TabPanels: ["Tabs"],
      TabPanel: ["Tabs"],
      ListBoxItem: ["ListBox", "ComboBox"],
      MenuItem: ["Menu"],
      GridListItem: ["GridList"],
      ListBoxSection: ["ListBox", "ComboBox"],
      MenuSection: ["Menu"],
      SubmenuTrigger: ["Menu"],
      GridListSection: ["GridList"],
      Tag: ["TagList"],
      TagList: ["TagGroup"],
      Breadcrumb: ["Breadcrumbs"],
      ColorSwatchPickerItem: ["ColorSwatchPicker"],
      SelectionIndicator: ["Tab"],
      Radio: ["RadioGroup"],
      RadioItems: ["RadioGroup"],
      CheckboxItems: ["CheckboxGroup"],
      CheckboxButton: ["Checkbox"],
      CheckboxIndicator: ["CheckboxButton"],
      RadioButton: ["Radio"],
      RadioIndicator: ["RadioButton"],
      SwitchButton: ["Switch"],
      SwitchIndicator: ["SwitchButton"],
      TreeItemContent: ["TreeItem"],
      SliderOutput: ["Slider"],
      SliderTrack: ["Slider"],
      SliderThumb: ["SliderTrack"],
      MeterTrack: ["Meter"],
      MeterValue: ["Meter"],
      ProgressBarTrack: ["ProgressBar"],
      ProgressBarValue: ["ProgressBar"],
      CalendarGrid: ["Calendar", "RangeCalendar"],
      CalendarHeader: ["Calendar", "RangeCalendar"],
      CardHeader: ["Card"],
      CardContent: ["Card"],
      CardFooter: ["Card"],
      CardPreview: ["Card"],
      DisclosureHeader: ["Disclosure"],
      DisclosureChevron: ["DisclosureHeader"],
      SelectTrigger: [
        "Select",
        "ComboBox",
        "SearchField",
        "NumberField",
        "DatePicker",
        "DateRangePicker",
      ],
      SelectValue: [
        "Select",
        "ComboBox",
        "SearchField",
        "NumberField",
        "DatePicker",
        "DateRangePicker",
      ],
      SelectIcon: [
        "Select",
        "ComboBox",
        "SearchField",
        "NumberField",
        "DatePicker",
        "DateRangePicker",
      ],
      DateInput: ["DateField", "TimeField", "DatePicker", "DateRangePicker"],
      FieldError: [
        "TextField",
        "TextArea",
        "NumberField",
        "SearchField",
        "DateField",
        "TimeField",
        "DatePicker",
        "DateRangePicker",
        "ColorField",
        "ComboBox",
        "Select",
        "RadioGroup",
        "CheckboxGroup",
        "TagGroup",
        "Slider",
        "Field",
      ],
      Input: [
        "TextField",
        "TextArea",
        "NumberField",
        "SearchField",
        "ColorField",
        "ComboBox",
        "Field",
      ],
    });
  });
});

describe("componentTraits 조회", () => {
  it("표에 없는 타입 · prototype 키는 특성이 없다", () => {
    expect(getComponentTraits("NoSuchType")).toBeUndefined();
    expect(getComponentTraits("constructor")).toBeUndefined();
    expect(getComponentTraits(null)).toBeUndefined();
  });

  it("대소문자를 구분한다 (소문자 비교는 집합 옵션으로)", () => {
    expect(hasComponentFamily("Button", "action")).toBe(true);
    expect(hasComponentFamily("button", "action")).toBe(false);
  });
});
