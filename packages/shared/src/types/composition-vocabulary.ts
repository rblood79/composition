/**
 * @fileoverview Canonical Component Vocabulary — ADR-903 P0
 *
 * **scope 분리 (R5)**: 본 파일의 `ComponentTag`는 오직 `Element.type` /
 * `CanonicalNode.type`의 값 공간이다. `DataBinding.type` ("collection" | "value"
 * | "field") 및 `FieldDefinition.type` (FieldType 7-literal)과는 **객체 경로가
 * 다른 별개 필드**이며 값 공간 교집합 0건 — compile-time disjoint 보장.
 */

import type { CanonicalNode } from "./composition-document.types";

/**
 * Canonical Component Tag — composition 컴포넌트 vocabulary.
 *
 * 값 공간 정책 (ADR-903 §type vocabulary policy):
 * - **허용**: composition Component 116개 + pencil 공용 구조 타입 3개 (`ref` | `frame` | `group`) = 119 literal
 * - **제외**: pencil primitive 10종 (`rectangle` / `ellipse` / `line` / `polygon` / `path` /
 *   `text` / `note` / `prompt` / `context` / `icon_font`) — import/export adapter 경유만 등장
 *
 * 실측: 본 `ComponentTag` union 멤버 115 component + 구조 타입 3개 = 118 (Autocomplete 폐기 2026-06-09 / DateSegment+TimeSegment 폐기 2026-06-09 / Accordion 폐기 2026-06-10 — DisclosureGroup 중복, ADR-912 cutover phase). 주의: `*.spec.ts` 파일 수와는 별개 — properties-only / child sub-part spec 은 union 비멤버. TimeSegment 는 vocab union 비멤버였던 undeclared alias (tagToElement 동시 청산).
 */
export type ComponentTag =
  // ── composition Component Tags (115개, 알파벳 순) ──
  | "Avatar"
  | "AvatarGroup"
  | "Badge"
  | "Body"
  | "Breadcrumb"
  | "Breadcrumbs"
  | "Button"
  | "ButtonGroup"
  | "Calendar"
  | "CalendarGrid"
  | "CalendarHeader"
  | "Card"
  | "CardContent"
  | "CardFooter"
  | "CardHeader"
  | "CardView"
  | "Checkbox"
  | "CheckboxGroup"
  | "CheckboxItems"
  | "Code"
  | "ColorArea"
  | "ColorField"
  | "ColorPicker"
  | "ColorSlider"
  | "ColorSwatch"
  | "ColorSwatchPicker"
  | "ColorWheel"
  | "ComboBox"
  | "DateField"
  | "DateInput"
  | "DatePicker"
  | "DateRangePicker"
  | "Description"
  | "Dialog"
  | "Disclosure"
  | "DisclosureGroup"
  | "DisclosureHeader"
  | "DropZone"
  | "Field"
  | "FieldError"
  | "FileTrigger"
  | "Form"
  | "GridList"
  | "GridListItem"
  | "Group"
  | "Header"
  | "Heading"
  | "Icon"
  | "IllustratedMessage"
  | "Image"
  | "InlineAlert"
  | "Input"
  | "Kbd"
  | "Label"
  | "Link"
  | "List"
  | "ListBox"
  | "ListBoxItem"
  | "MaskedFrame"
  | "Menu"
  | "MenuItem"
  | "Meter"
  | "MeterTrack"
  | "MeterValue"
  | "Modal"
  | "Nav"
  | "NumberField"
  | "Pagination"
  | "Paragraph"
  | "Popover"
  | "ProgressBar"
  | "ProgressBarTrack"
  | "ProgressBarValue"
  | "ProgressCircle"
  | "Radio"
  | "RadioGroup"
  | "RadioItems"
  | "RangeCalendar"
  | "SearchField"
  | "Section"
  | "Select"
  | "SelectIcon"
  | "SelectTrigger"
  | "SelectValue"
  | "Separator"
  | "Skeleton"
  | "Slider"
  | "SliderOutput"
  | "SliderThumb"
  | "SliderTrack"
  | "Slot"
  | "StatusLight"
  | "Switch"
  | "Switcher"
  | "Tab"
  | "Table"
  | "TableView"
  | "TabList"
  | "TabPanel"
  | "TabPanels"
  | "Tabs"
  | "Tag"
  | "TagGroup"
  | "TagList"
  | "TailSwatch"
  | "Text"
  | "TextArea"
  | "TextField"
  | "TimeField"
  | "Toast"
  | "ToggleButton"
  | "ToggleButtonGroup"
  | "Toolbar"
  | "Tooltip"
  | "Tree"
  // ── pencil 공용 구조 타입 3개 ──
  | "ref"
  | "frame"
  | "group";

/**
 * `isCanonicalNode` — runtime type guard.
 *
 * 체크 항목:
 * - `typeof obj === "object" && obj !== null`
 * - `typeof obj.id === "string" && !obj.id.includes("/")`
 * - `typeof obj.type === "string"`
 * - optional 필드(`children` / `reusable` / `ref` / `descendants` / `slot`)는
 *   존재 시에만 타입 검증
 *
 * canonical tree walker에서 `if (!isCanonicalNode(child)) continue` 방어 강제.
 * `FieldDefinition` / `DataBinding`이 tree walker에 섞여 들어오더라도 오판 차단.
 */
export function isCanonicalNode(obj: unknown): obj is CanonicalNode {
  if (typeof obj !== "object" || obj === null) return false;
  const node = obj as Record<string, unknown>;

  // id: slash 금지 포함
  if (typeof node.id !== "string" || node.id.includes("/")) return false;

  // type: string 존재 확인 (ComponentTag 값 공간은 컴파일-타임 보장)
  if (typeof node.type !== "string") return false;

  // optional 필드 존재 시 타입 검증
  if ("children" in node && node.children !== undefined) {
    if (!Array.isArray(node.children)) return false;
  }
  if ("reusable" in node && node.reusable !== undefined) {
    if (typeof node.reusable !== "boolean") return false;
  }
  if ("ref" in node && node.ref !== undefined) {
    if (typeof node.ref !== "string") return false;
  }
  if ("descendants" in node && node.descendants !== undefined) {
    if (typeof node.descendants !== "object" || node.descendants === null)
      return false;
  }
  if ("slot" in node && node.slot !== undefined) {
    if (node.slot !== false && !Array.isArray(node.slot)) return false;
  }

  return true;
}
