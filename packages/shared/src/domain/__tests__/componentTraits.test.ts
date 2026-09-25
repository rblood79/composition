import { describe, expect, it } from "vitest";
import {
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

  it("dateField (buildSpecNodeData DATE_INPUT_PARENT_TAGS)", () => {
    expect(sorted(componentTypeSet("dateField"))).toEqual(
      literal(["DateField", "TimeField", "DatePicker", "DateRangePicker"]),
    );
  });

  it("selectionItem (canonicalRefResolution SELECTION_FLAG_ITEM_TYPES)", () => {
    expect(sorted(componentTypeSet("selectionItem"))).toEqual(
      literal(["ListBoxItem", "GridListItem"]),
    );
  });

  it("staticCollectionItem (CanonicalNodeRenderer STATIC_ITEM_TYPES)", () => {
    expect(sorted(componentTypeSet("staticCollectionItem"))).toEqual(
      literal(["Tab", "Tag", "ListBoxItem", "GridListItem", "Breadcrumb"]),
    );
  });

  it("itemSlotCollection (CanonicalNodeRenderer ITEM_SLOT_COLLECTIONS, 소문자)", () => {
    expect(
      sorted(componentTypeSet("itemSlotCollection", { lowercase: true })),
    ).toEqual(literal(["listbox", "gridlist", "menu", "taggroup"]));
  });

  it("disablingGroup (canonicalRefResolution DISABLING_GROUP_TYPES)", () => {
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
