#!/usr/bin/env node
// ADR-256 G0 — 설치된 react-aria-components 를 jsdom 에 실제로 마운트해 세 표를 뽑는다.
//   ⑧ 이름 붙은 자리: 부품 안의 자식 자리에서 보이는 context 와 그 slot 키 (root 와 다른 것만)
//   ④ render props: 부품의 className 함수가 받는 값의 키
//   ⑨ 필수 짝 (context 관계): 부품을 부모 없이 그리면 throw 하는가
// 손 표가 아니라 RAC 실행 결과다. 사용: node apps/builder/scripts/adr256-g0-rac-inventory.mjs [out.json]
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(path.join(here, "../package.json"));
const { JSDOM } = req("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});
dom.window.CSS ??= { supports: () => false, escape: (s) => String(s) };
for (const key of ["window", ...Object.getOwnPropertyNames(dom.window)]) {
  const isEventClass = /(Event|EventTarget)$/.test(key);
  if (
    key === "window"
      ? !globalThis.window
      : dom.window[key] !== undefined && (isEventClass || !(key in globalThis))
  ) {
    Object.defineProperty(globalThis, key, {
      value: key === "window" ? dom.window : dom.window[key],
      configurable: true,
      writable: true,
    });
  }
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  dom.window.ResizeObserver = globalThis.ResizeObserver;
}

const R = req("react");
const { createRoot } = req("react-dom/client");
const C = req("react-aria-components");
const racVersion = req("react-aria-components/package.json").version;
const e = R.createElement;

const CONTEXTS = Object.keys(C).filter(
  (k) => /Context$/.test(k) && k !== "useSlottedContext" && C[k]?.$$typeof,
);

// ---- probe ------------------------------------------------------------
let currentFixture = "";
const seen = {}; // fixture -> position -> {ctx: desc}
const renderProps = {}; // part -> Set(keys)
let baseline = null;

function describe(value) {
  if (value == null) return null;
  if (
    typeof value === "object" &&
    value.slots &&
    typeof value.slots === "object"
  ) {
    return {
      slots: Reflect.ownKeys(value.slots).map((k) =>
        typeof k === "symbol" ? "DEFAULT" : k,
      ),
    };
  }
  return "plain";
}

function Probe({ at }) {
  const values = {};
  for (const name of CONTEXTS) values[name] = R.useContext(C[name]);
  if (at === "__root__") {
    baseline = values;
    return null;
  }
  const out = {};
  for (const name of CONTEXTS) {
    if (values[name] === baseline[name]) continue;
    out[name] = describe(values[name]);
  }
  (seen[currentFixture] ??= {})[at] = out;
  return null;
}
const P = (at) => e(Probe, { at, key: `probe:${at}` });
const rp = (part) => (values) => {
  const set = (renderProps[part] ??= new Set());
  for (const k of Object.keys(values ?? {}))
    if (k !== "defaultClassName") set.add(k);
  return "";
};

class Boundary extends R.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch() {}
  render() {
    return this.state.error ? null : this.props.children;
  }
}

const logs = [];
const origError = console.error;
const origWarn = console.warn;
console.error = (...args) => logs.push(["error", args.map(String).join(" ")]);
console.warn = (...args) => logs.push(["warn", args.map(String).join(" ")]);

async function mount(name, build) {
  currentFixture = name;
  logs.length = 0;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container, {
    onUncaughtError: (error) =>
      logs.push(["throw", error?.message ?? String(error)]),
    onCaughtError: (error) =>
      logs.push(["throw", error?.message ?? String(error)]),
  });
  let threw = null;
  try {
    await R.act(async () => {
      root.render(e(Boundary, null, build()));
    });
  } catch (error) {
    threw = error?.message ?? String(error);
  }
  const html = document.body.innerHTML;
  const thrown = threw ?? logs.find(([kind]) => kind === "throw")?.[1] ?? null;
  const warnings = logs
    .filter(([kind]) => kind !== "throw")
    .map(([, msg]) => msg.split("\n")[0].slice(0, 200));
  await R.act(async () => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  return { thrown, warnings: [...new Set(warnings)], html };
}

// ---- fixtures: 부품의 「사용자 자식 자리」 에 Probe 를 둔다 --------------------
const {
  Autocomplete,
  Breadcrumbs,
  Breadcrumb,
  Button,
  Calendar,
  CalendarGrid,
  CalendarGridHeader,
  CalendarGridBody,
  CalendarHeaderCell,
  CalendarCell,
  RangeCalendar,
  Checkbox,
  CheckboxGroup,
  CheckboxField,
  CheckboxButton,
  ColorField,
  ColorPicker,
  ColorSwatch,
  ColorSwatchPicker,
  ColorSwatchPickerItem,
  ComboBox,
  DateField,
  DateInput,
  DateSegment,
  TimeField,
  DatePicker,
  DateRangePicker,
  DialogTrigger,
  Dialog,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DropZone,
  FieldError,
  Form,
  GridList,
  GridListItem,
  Group,
  Header,
  Heading,
  Input,
  Keyboard,
  Label,
  Link,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Menu,
  MenuItem,
  MenuTrigger,
  SubmenuTrigger,
  Meter,
  Modal,
  ModalOverlay,
  NumberField,
  OverlayArrow,
  Popover,
  ProgressBar,
  RadioGroup,
  Radio,
  RadioField,
  RadioButton,
  SearchField,
  Select,
  SelectValue,
  SelectionIndicator,
  Separator,
  Slider,
  SliderOutput,
  SliderTrack,
  SliderThumb,
  SliderFill,
  Switch,
  SwitchField,
  SwitchButton,
  Table,
  Row,
  Cell,
  Column,
  TableHeader,
  TableBody,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  Tab,
  TagGroup,
  TagList,
  Tag,
  Text,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  TooltipTrigger,
  Tooltip,
  Tree,
  TreeItem,
  TreeItemContent,
  FileTrigger,
} = C;

const L = (t = "L") => e(Label, null, t);
const dateInput = (part, extra = {}) =>
  e(DateInput, { className: rp(`DateInput@${part}`), ...extra }, (segment) =>
    e(DateSegment, { segment, className: rp("DateSegment") }),
  );
const calendarBody = (part) => [
  e(
    CalendarGrid,
    { key: "g", className: rp(`CalendarGrid@${part}`) },
    e(CalendarGridHeader, null, (day) =>
      e(CalendarHeaderCell, { className: rp("CalendarHeaderCell") }, day),
    ),
    e(CalendarGridBody, null, (date) =>
      e(CalendarCell, { date, className: rp("CalendarCell") }),
    ),
  ),
];
const calendarHeader = (at) =>
  e(
    "header",
    { key: "h" },
    e(Button, { slot: "previous" }, "<"),
    e(Heading, null),
    e(Button, { slot: "next" }, ">"),
    P(at),
  );

const FIXTURES = {
  TextField: () =>
    e(
      TextField,
      { "aria-label": "f", className: rp("TextField") },
      L(),
      e(Input, { className: rp("Input") }),
      P("TextField"),
    ),
  TextArea: () =>
    e(
      TextField,
      { "aria-label": "f" },
      L(),
      e(TextArea, { className: rp("TextArea") }),
      P("TextField(TextArea)"),
    ),
  NumberField: () =>
    e(
      NumberField,
      { "aria-label": "f", className: rp("NumberField") },
      L(),
      e(
        Group,
        { className: rp("Group@NumberField") },
        e(Button, { slot: "decrement" }, "-"),
        e(Input),
        e(Button, { slot: "increment" }, "+"),
        P("NumberField>Group"),
      ),
      P("NumberField"),
    ),
  SearchField: () =>
    e(
      SearchField,
      { "aria-label": "f", className: rp("SearchField") },
      L(),
      e(Input),
      e(Button, null, "x"),
      P("SearchField"),
    ),
  DateField: () =>
    e(
      DateField,
      { "aria-label": "f", className: rp("DateField") },
      L(),
      dateInput("DateField"),
      P("DateField"),
    ),
  TimeField: () =>
    e(
      TimeField,
      { "aria-label": "f", className: rp("TimeField") },
      L(),
      dateInput("TimeField"),
      P("TimeField"),
    ),
  ColorField: () =>
    e(
      ColorField,
      { "aria-label": "f", className: rp("ColorField") },
      L(),
      e(Input),
      P("ColorField"),
    ),
  DatePicker: () =>
    e(
      DatePicker,
      { "aria-label": "f", defaultOpen: true, className: rp("DatePicker") },
      L(),
      e(
        Group,
        { className: rp("Group@DatePicker") },
        dateInput("DatePicker"),
        e(Button, null, "v"),
        P("DatePicker>Group"),
      ),
      P("DatePicker"),
      e(
        Popover,
        { className: rp("Popover@DatePicker") },
        e(
          Dialog,
          null,
          e(
            Calendar,
            null,
            calendarHeader("DatePicker>Popover>Dialog>Calendar>header"),
            ...calendarBody("DatePicker"),
          ),
          P("DatePicker>Popover>Dialog"),
        ),
      ),
    ),
  DateRangePicker: () =>
    e(
      DateRangePicker,
      {
        "aria-label": "f",
        defaultOpen: true,
        className: rp("DateRangePicker"),
      },
      L(),
      e(
        Group,
        null,
        dateInput("DateRangePicker", { slot: "start" }),
        e("span", null, "–"),
        dateInput("DateRangePicker", { slot: "end" }),
        e(Button, null, "v"),
        P("DateRangePicker>Group"),
      ),
      P("DateRangePicker"),
      e(
        Popover,
        null,
        e(
          Dialog,
          null,
          e(
            RangeCalendar,
            null,
            calendarHeader("DateRangePicker>…>RangeCalendar>header"),
            ...calendarBody("DateRangePicker"),
          ),
          P("DateRangePicker>Popover>Dialog"),
        ),
      ),
    ),
  Select: () =>
    e(
      Select,
      { "aria-label": "f", defaultOpen: true, className: rp("Select") },
      L(),
      e(
        Button,
        { className: rp("Button@Select") },
        e(SelectValue, { className: rp("SelectValue") }),
        P("Select>Button"),
      ),
      P("Select"),
      e(
        Popover,
        { className: rp("Popover@Select") },
        e(ListBox, null, e(ListBoxItem, { id: "a", textValue: "A" }, "A")),
        P("Select>Popover"),
      ),
    ),
  ComboBox: () =>
    e(
      ComboBox,
      { "aria-label": "f", className: rp("ComboBox") },
      L(),
      e(Group, null, e(Input), e(Button, null, "v"), P("ComboBox>Group")),
      P("ComboBox"),
      e(
        Popover,
        null,
        e(ListBox, null, e(ListBoxItem, { id: "a", textValue: "A" }, "A")),
      ),
    ),
  Autocomplete: () =>
    e(
      Autocomplete,
      null,
      e(SearchField, { "aria-label": "s" }, e(Input)),
      e(
        Menu,
        { "aria-label": "m" },
        e(MenuItem, { id: "a", textValue: "A" }, "A"),
      ),
      P("Autocomplete"),
    ),
  Checkbox: () => e(Checkbox, { className: rp("Checkbox") }, P("Checkbox")),
  CheckboxField: () =>
    e(
      CheckboxField,
      { className: rp("CheckboxField") },
      e(
        CheckboxButton,
        { className: rp("CheckboxButton") },
        P("CheckboxField>CheckboxButton"),
      ),
      P("CheckboxField"),
    ),
  CheckboxGroup: () =>
    e(
      CheckboxGroup,
      { "aria-label": "g", className: rp("CheckboxGroup") },
      L(),
      e(Checkbox, { value: "a" }, "A"),
      P("CheckboxGroup"),
    ),
  Switch: () => e(Switch, { className: rp("Switch") }, P("Switch")),
  SwitchField: () =>
    e(
      SwitchField,
      { className: rp("SwitchField") },
      e(
        SwitchButton,
        { className: rp("SwitchButton") },
        P("SwitchField>SwitchButton"),
      ),
      P("SwitchField"),
    ),
  RadioGroup: () =>
    e(
      RadioGroup,
      { "aria-label": "g", className: rp("RadioGroup") },
      L(),
      e(Radio, { value: "a", className: rp("Radio") }, P("RadioGroup>Radio")),
      P("RadioGroup"),
    ),
  RadioField: () =>
    e(
      RadioGroup,
      { "aria-label": "g" },
      e(
        RadioField,
        { value: "a", className: rp("RadioField") },
        e(
          RadioButton,
          { className: rp("RadioButton") },
          P("RadioGroup>RadioField>RadioButton"),
        ),
        P("RadioGroup>RadioField"),
      ),
    ),
  ToggleButton: () =>
    e(ToggleButton, { className: rp("ToggleButton") }, P("ToggleButton")),
  ToggleButtonGroup: () =>
    e(
      ToggleButtonGroup,
      { className: rp("ToggleButtonGroup") },
      e(ToggleButton, { id: "a" }, "A"),
      P("ToggleButtonGroup"),
    ),
  Slider: () =>
    e(
      Slider,
      { "aria-label": "s", className: rp("Slider") },
      L(),
      e(SliderOutput, { className: rp("SliderOutput") }),
      e(
        SliderTrack,
        { className: rp("SliderTrack") },
        e(SliderFill, { className: rp("SliderFill") }),
        e(SliderThumb, { className: rp("SliderThumb") }),
        P("Slider>SliderTrack"),
      ),
      P("Slider"),
    ),
  ProgressBar: () =>
    e(
      ProgressBar,
      { "aria-label": "p", value: 30, className: rp("ProgressBar") },
      L(),
      P("ProgressBar"),
    ),
  Meter: () =>
    e(
      Meter,
      { "aria-label": "m", value: 30, className: rp("Meter") },
      L(),
      P("Meter"),
    ),
  Calendar: () =>
    e(
      Calendar,
      { "aria-label": "c", className: rp("Calendar") },
      calendarHeader("Calendar>header"),
      ...calendarBody("Calendar"),
      P("Calendar"),
    ),
  RangeCalendar: () =>
    e(
      RangeCalendar,
      { "aria-label": "c", className: rp("RangeCalendar") },
      calendarHeader("RangeCalendar>header"),
      ...calendarBody("RangeCalendar"),
      P("RangeCalendar"),
    ),
  ListBox: () =>
    e(
      ListBox,
      { "aria-label": "l", className: rp("ListBox") },
      e(
        ListBoxItem,
        { id: "a", textValue: "A", className: rp("ListBoxItem") },
        P("ListBox>ListBoxItem"),
      ),
      e(
        ListBoxSection,
        { id: "s", className: rp("ListBoxSection") },
        e(Header, null, "H", P("ListBox>ListBoxSection>Header")),
        e(ListBoxItem, { id: "b", textValue: "B" }, "B"),
      ),
    ),
  Menu: () =>
    e(
      Menu,
      { "aria-label": "m", className: rp("Menu") },
      e(
        MenuItem,
        { id: "a", textValue: "A", className: rp("MenuItem") },
        P("Menu>MenuItem"),
      ),
      e(
        SubmenuTrigger,
        null,
        e(
          MenuItem,
          { id: "s", textValue: "S" },
          "S",
          P("Menu>SubmenuTrigger>MenuItem"),
        ),
        e(
          Popover,
          null,
          e(
            Menu,
            { "aria-label": "sub" },
            e(MenuItem, { id: "x", textValue: "X" }, "X"),
          ),
        ),
      ),
    ),
  MenuTrigger: () =>
    e(
      MenuTrigger,
      { defaultOpen: true },
      e(Button, null, "Open", P("MenuTrigger>Button")),
      e(
        Popover,
        null,
        e(
          Menu,
          { "aria-label": "m" },
          e(MenuItem, { id: "a", textValue: "A" }, "A"),
        ),
        P("MenuTrigger>Popover"),
      ),
    ),
  GridList: () =>
    e(
      GridList,
      { "aria-label": "g", className: rp("GridList") },
      e(
        GridListItem,
        { id: "a", textValue: "A", className: rp("GridListItem") },
        P("GridList>GridListItem"),
      ),
    ),
  Tree: () =>
    e(
      Tree,
      { "aria-label": "t", className: rp("Tree") },
      e(
        TreeItem,
        { id: "a", textValue: "A", className: rp("TreeItem") },
        e(TreeItemContent, null, (values) => {
          rp("TreeItemContent(children fn)")(values);
          return e(R.Fragment, null, "A", P("Tree>TreeItem"));
        }),
        e(TreeItem, { id: "b", textValue: "B" }, e(TreeItemContent, null, "B")),
      ),
    ),
  TagGroup: () =>
    e(
      TagGroup,
      { "aria-label": "t", className: rp("TagGroup") },
      L(),
      e(
        TagList,
        { className: rp("TagList") },
        e(
          Tag,
          { id: "a", textValue: "A", className: rp("Tag") },
          "A",
          P("TagGroup>TagList>Tag"),
        ),
      ),
      P("TagGroup"),
    ),
  Breadcrumbs: () =>
    e(
      Breadcrumbs,
      { className: rp("Breadcrumbs") },
      e(
        Breadcrumb,
        { id: "a", className: rp("Breadcrumb") },
        e(Link, { href: "#" }, "A"),
        P("Breadcrumbs>Breadcrumb"),
      ),
    ),
  Tabs: () =>
    e(
      Tabs,
      { className: rp("Tabs") },
      e(
        TabList,
        { "aria-label": "t", className: rp("TabList") },
        e(Tab, { id: "a", className: rp("Tab") }, "A", P("Tabs>TabList>Tab")),
      ),
      e(
        TabPanels,
        null,
        e(
          TabPanel,
          { id: "a", className: rp("TabPanel") },
          P("Tabs>TabPanels>TabPanel"),
        ),
      ),
      P("Tabs"),
    ),
  Table: () =>
    e(
      Table,
      { "aria-label": "t", className: rp("Table") },
      e(
        TableHeader,
        { className: rp("TableHeader") },
        e(
          Column,
          { id: "c", isRowHeader: true, className: rp("Column") },
          "C",
          P("Table>TableHeader>Column"),
        ),
      ),
      e(
        TableBody,
        { className: rp("TableBody") },
        e(
          Row,
          { id: "r", className: rp("Row") },
          e(Cell, { className: rp("Cell") }, "A", P("Table>TableBody>Row")),
        ),
      ),
    ),
  Dialog: () => e(Dialog, { "aria-label": "d" }, P("Dialog")),
  ModalDialog: () =>
    e(
      DialogTrigger,
      { defaultOpen: true },
      e(Button, null, "Open", P("DialogTrigger>Button")),
      e(
        ModalOverlay,
        { className: rp("ModalOverlay") },
        e(
          Modal,
          { className: rp("Modal") },
          e(
            Dialog,
            null,
            e(Heading, { slot: "title" }, "T"),
            P("DialogTrigger>Modal>Dialog"),
          ),
        ),
      ),
    ),
  PopoverDialog: () =>
    e(
      DialogTrigger,
      { defaultOpen: true },
      e(Button, null, "Open"),
      e(
        Popover,
        { className: rp("Popover") },
        e(
          OverlayArrow,
          { className: rp("OverlayArrow@Popover") },
          P("Popover>OverlayArrow"),
        ),
        e(Dialog, null, P("DialogTrigger>Popover>Dialog")),
      ),
    ),
  Tooltip: () =>
    e(
      TooltipTrigger,
      { defaultOpen: true },
      e(Button, null, "B"),
      e(
        Tooltip,
        { className: rp("Tooltip") },
        e(OverlayArrow, { className: rp("OverlayArrow@Tooltip") }),
        "tip",
        P("TooltipTrigger>Tooltip"),
      ),
    ),
  Disclosure: () =>
    e(
      Disclosure,
      { defaultExpanded: true, className: rp("Disclosure") },
      e(
        Heading,
        null,
        e(
          Button,
          { slot: "trigger", className: rp("Button@Disclosure") },
          "T",
          P("Disclosure>Heading>Button"),
        ),
      ),
      e(
        DisclosurePanel,
        { className: rp("DisclosurePanel") },
        P("Disclosure>DisclosurePanel"),
      ),
      P("Disclosure"),
    ),
  DisclosureGroup: () =>
    e(
      DisclosureGroup,
      { className: rp("DisclosureGroup") },
      e(
        Disclosure,
        { id: "a" },
        e(Heading, null, e(Button, { slot: "trigger" }, "A")),
        e(DisclosurePanel, null, "a"),
      ),
      P("DisclosureGroup"),
    ),
  ColorSwatchPicker: () =>
    e(
      ColorSwatchPicker,
      { className: rp("ColorSwatchPicker") },
      e(
        ColorSwatchPickerItem,
        { color: "#f00", className: rp("ColorSwatchPickerItem") },
        e(ColorSwatch, { className: rp("ColorSwatch") }),
        P("ColorSwatchPicker>Item"),
      ),
    ),
  ColorPicker: () => e(ColorPicker, { defaultValue: "#f00" }, P("ColorPicker")),
  Toolbar: () =>
    e(
      Toolbar,
      { "aria-label": "t", className: rp("Toolbar") },
      e(Button, null, "A"),
      P("Toolbar"),
    ),
  Group: () => e(Group, { className: rp("Group") }, P("Group")),
  Form: () => e(Form, null, P("Form")),
  Button: () => e(Button, { className: rp("Button") }, P("Button")),
  Link: () => e(Link, { href: "#", className: rp("Link") }, P("Link")),
  DropZone: () => e(DropZone, { className: rp("DropZone") }, P("DropZone")),
  FileTrigger: () =>
    e(FileTrigger, null, e(Button, null, "Pick", P("FileTrigger>Button"))),
  FieldErrorInField: () =>
    e(
      TextField,
      { "aria-label": "f", isInvalid: true },
      e(Input),
      e(
        FieldError,
        { className: rp("FieldError") },
        "err",
        P("TextField>FieldError"),
      ),
      P("TextField"),
    ),
  Separator: () => e(Separator, { className: rp("Separator") }),
  SelectionIndicatorInTab: () =>
    e(
      Tabs,
      null,
      e(
        TabList,
        { "aria-label": "t" },
        e(
          Tab,
          { id: "a" },
          "A",
          e(SelectionIndicator, { className: rp("SelectionIndicator") }),
        ),
      ),
      e(TabPanel, { id: "a" }, "a"),
    ),
  KeyboardInMenu: () =>
    e(
      Menu,
      { "aria-label": "m" },
      e(
        MenuItem,
        { id: "a", textValue: "A" },
        e(Text, { slot: "label" }, "A"),
        e(Keyboard, null, "⌘A"),
      ),
    ),
  Toast: () => {
    const queue = new C.UNSTABLE_ToastQueue();
    queue.add({ title: "T" });
    return e(
      C.UNSTABLE_ToastRegion,
      { queue, className: rp("ToastRegion") },
      ({ toast }) =>
        e(
          C.UNSTABLE_Toast,
          { toast, className: rp("Toast") },
          e(
            C.UNSTABLE_ToastContent,
            null,
            e(Text, { slot: "title" }, "T"),
            P("ToastRegion>Toast>ToastContent"),
          ),
          e(Button, { slot: "close" }, "x"),
          P("ToastRegion>Toast"),
        ),
    );
  },
};

// ⑨ 부모 없이 그린 부품 — RAC 가 context 관계를 요구하는가
const ORPHANS = {
  ListBoxItem: () => e(ListBoxItem, { id: "a" }, "A"),
  ListBoxSection: () =>
    e(ListBoxSection, null, e(ListBoxItem, { id: "a" }, "A")),
  MenuItem: () => e(MenuItem, { id: "a" }, "A"),
  SubmenuTrigger: () =>
    e(
      SubmenuTrigger,
      null,
      e(MenuItem, { id: "a" }, "A"),
      e(Popover, null, e(Menu, { "aria-label": "m" })),
    ),
  GridListItem: () => e(GridListItem, { id: "a" }, "A"),
  TreeItem: () =>
    e(TreeItem, { id: "a", textValue: "A" }, e(TreeItemContent, null, "A")),
  TreeItemContent: () => e(TreeItemContent, null, "A"),
  Tag: () => e(Tag, { id: "a" }, "A"),
  TagList: () => e(TagList, null, e(Tag, { id: "a" }, "A")),
  Tab: () => e(Tab, { id: "a" }, "A"),
  TabList: () => e(TabList, { "aria-label": "t" }, e(Tab, { id: "a" }, "A")),
  TabPanel: () => e(TabPanel, { id: "a" }, "a"),
  TabPanels: () => e(TabPanels, null, e(TabPanel, { id: "a" }, "a")),
  Column: () => e(Column, { id: "c" }, "C"),
  Row: () => e(Row, { id: "r" }, e(Cell, null, "A")),
  Cell: () => e(Cell, null, "A"),
  TableHeader: () => e(TableHeader, null, e(Column, { id: "c" }, "C")),
  TableBody: () => e(TableBody, null, e(Row, { id: "r" }, e(Cell, null, "A"))),
  Breadcrumb: () => e(Breadcrumb, null, "A"),
  SelectValue: () => e(SelectValue),
  DateInput: () => dateInput("orphan"),
  CalendarGrid: () =>
    e(CalendarGrid, null, (date) => e(CalendarCell, { date })),
  CalendarCell: () => e(CalendarCell, { date: null }),
  SliderTrack: () => e(SliderTrack),
  SliderThumb: () => e(SliderThumb),
  SliderOutput: () => e(SliderOutput),
  SliderFill: () => e(SliderFill),
  CheckboxButton: () => e(CheckboxButton, null, "A"),
  SwitchButton: () => e(SwitchButton, null, "A"),
  RadioButton: () => e(RadioButton, null, "A"),
  Radio: () => e(Radio, { value: "a" }, "A"),
  RadioField: () => e(RadioField, { value: "a" }, e(RadioButton, null, "A")),
  DisclosurePanel: () => e(DisclosurePanel, null, "a"),
  ColorSwatchPickerItem: () =>
    e(ColorSwatchPickerItem, { color: "#f00" }, e(ColorSwatch)),
  ColorSwatch: () => e(ColorSwatch),
  SelectionIndicator: () => e(SelectionIndicator),
  OverlayArrow: () => e(OverlayArrow),
  PopoverAlone: () =>
    e(Popover, { isOpen: true }, e(Dialog, { "aria-label": "d" }, "x")),
  ModalAlone: () =>
    e(Modal, { isOpen: true }, e(Dialog, { "aria-label": "d" }, "x")),
  TooltipAlone: () => e(Tooltip, { isOpen: true }, "x"),
  Header: () => e(Header, null, "H"),
  Keyboard: () => e(Keyboard, null, "⌘"),
  FieldError: () => e(FieldError, null, "err"),
  Input: () => e(Input),
  Label: () => e(Label, null, "L"),
  Text: () => e(Text, null, "T"),
  TextSlotted: () => e(Text, { slot: "description" }, "T"),
  Heading: () => e(Heading, null, "H"),
  Group: () => e(Group),
  Button: () => e(Button, null, "B"),
};

// ② children 종류 — 부품의 직계 자식으로 항목이 아닌 자유 내용 (`<span>FREE</span>`) 을 넣으면
// RAC 가 그리는가 (free) · 버리는가 (items: dropped) · throw 하는가 (items: throws)
const FREE = () => e("span", { key: "free", "data-free": "" }, "FREE");
const CHILD_KIND = {
  ListBox: () =>
    e(ListBox, { "aria-label": "l" }, e(ListBoxItem, { id: "a" }, "A"), FREE()),
  ListBoxSection: () =>
    e(
      ListBox,
      { "aria-label": "l" },
      e(ListBoxSection, null, e(ListBoxItem, { id: "a" }, "A"), FREE()),
    ),
  Menu: () =>
    e(Menu, { "aria-label": "m" }, e(MenuItem, { id: "a" }, "A"), FREE()),
  GridList: () =>
    e(
      GridList,
      { "aria-label": "g" },
      e(GridListItem, { id: "a" }, "A"),
      FREE(),
    ),
  Tree: () =>
    e(
      Tree,
      { "aria-label": "t" },
      e(TreeItem, { id: "a", textValue: "A" }, e(TreeItemContent, null, "A")),
      FREE(),
    ),
  TreeItem: () =>
    e(
      Tree,
      { "aria-label": "t" },
      e(
        TreeItem,
        { id: "a", textValue: "A" },
        e(TreeItemContent, null, "A"),
        FREE(),
      ),
    ),
  TagList: () =>
    e(
      TagGroup,
      { "aria-label": "t" },
      e(TagList, null, e(Tag, { id: "a" }, "A"), FREE()),
    ),
  TabList: () =>
    e(
      Tabs,
      null,
      e(TabList, { "aria-label": "t" }, e(Tab, { id: "a" }, "A"), FREE()),
      e(TabPanel, { id: "a" }, "a"),
    ),
  TabPanels: () =>
    e(
      Tabs,
      null,
      e(TabList, { "aria-label": "t" }, e(Tab, { id: "a" }, "A")),
      e(TabPanels, null, e(TabPanel, { id: "a" }, "a"), FREE()),
    ),
  Table: () =>
    e(
      Table,
      { "aria-label": "t" },
      e(TableHeader, null, e(Column, { id: "c", isRowHeader: true }, "C")),
      e(TableBody, null, e(Row, { id: "r" }, e(Cell, null, "A"))),
      FREE(),
    ),
  TableHeader: () =>
    e(
      Table,
      { "aria-label": "t" },
      e(
        TableHeader,
        null,
        e(Column, { id: "c", isRowHeader: true }, "C"),
        FREE(),
      ),
      e(TableBody, null, e(Row, { id: "r" }, e(Cell, null, "A"))),
    ),
  TableBody: () =>
    e(
      Table,
      { "aria-label": "t" },
      e(TableHeader, null, e(Column, { id: "c", isRowHeader: true }, "C")),
      e(TableBody, null, e(Row, { id: "r" }, e(Cell, null, "A")), FREE()),
    ),
  Row: () =>
    e(
      Table,
      { "aria-label": "t" },
      e(TableHeader, null, e(Column, { id: "c", isRowHeader: true }, "C")),
      e(TableBody, null, e(Row, { id: "r" }, e(Cell, null, "A"), FREE())),
    ),
  Breadcrumbs: () =>
    e(Breadcrumbs, null, e(Breadcrumb, { id: "a" }, "A"), FREE()),
  ColorSwatchPicker: () =>
    e(
      ColorSwatchPicker,
      null,
      e(ColorSwatchPickerItem, { color: "#f00" }, e(ColorSwatch)),
      FREE(),
    ),
  ToggleButtonGroup: () =>
    e(ToggleButtonGroup, null, e(ToggleButton, { id: "a" }, "A"), FREE()),
  CheckboxGroup: () =>
    e(
      CheckboxGroup,
      { "aria-label": "g" },
      e(Checkbox, { value: "a" }, "A"),
      FREE(),
    ),
  RadioGroup: () =>
    e(RadioGroup, { "aria-label": "g" }, e(Radio, { value: "a" }, "A"), FREE()),
  DisclosureGroup: () => e(DisclosureGroup, null, FREE()),
  Tabs: () =>
    e(
      Tabs,
      null,
      e(TabList, { "aria-label": "t" }, e(Tab, { id: "a" }, "A")),
      e(TabPanel, { id: "a" }, "a"),
      FREE(),
    ),
  TextField: () => e(TextField, { "aria-label": "f" }, e(Input), FREE()),
  Slider: () =>
    e(
      Slider,
      { "aria-label": "s" },
      e(SliderTrack, null, e(SliderThumb), FREE()),
      FREE(),
    ),
  Calendar: () =>
    e(
      Calendar,
      { "aria-label": "c" },
      FREE(),
      e(CalendarGrid, null, (date) => e(CalendarCell, { date })),
    ),
  CalendarGrid: () =>
    e(
      Calendar,
      { "aria-label": "c" },
      e(
        CalendarGrid,
        null,
        FREE(),
        e(CalendarGridBody, null, (date) => e(CalendarCell, { date })),
      ),
    ),
  Select: () =>
    e(
      Select,
      { "aria-label": "f" },
      e(Button, null, e(SelectValue), FREE()),
      FREE(),
    ),
  Checkbox: () => e(Checkbox, null, FREE()),
  Switch: () => e(Switch, null, FREE()),
  ProgressBar: () => e(ProgressBar, { "aria-label": "p", value: 3 }, FREE()),
  Meter: () => e(Meter, { "aria-label": "p", value: 3 }, FREE()),
  Dialog: () => e(Dialog, { "aria-label": "d" }, FREE()),
  Toolbar: () => e(Toolbar, { "aria-label": "t" }, FREE()),
  ListBoxItem: () =>
    e(
      ListBox,
      { "aria-label": "l" },
      e(ListBoxItem, { id: "a", textValue: "A" }, FREE()),
    ),
  Tab: () =>
    e(
      Tabs,
      null,
      e(TabList, { "aria-label": "t" }, e(Tab, { id: "a" }, FREE())),
      e(TabPanel, { id: "a" }, "a"),
    ),
  Cell: () =>
    e(
      Table,
      { "aria-label": "t" },
      e(TableHeader, null, e(Column, { id: "c", isRowHeader: true }, "C")),
      e(TableBody, null, e(Row, { id: "r" }, e(Cell, null, FREE()))),
    ),
};

// 필수 부품이 빠진 부모 — 존재 요구는 throw 가 아니라 role/연결 소실로 드러난다
const MISSING = {
  "Select - Popover": () =>
    e(Select, { "aria-label": "f" }, e(Button, null, e(SelectValue))),
  "Select - Button": () =>
    e(
      Select,
      { "aria-label": "f", defaultOpen: true },
      e(Popover, null, e(ListBox, null, e(ListBoxItem, { id: "a" }, "A"))),
    ),
  "Select - ListBox": () =>
    e(
      Select,
      { "aria-label": "f", defaultOpen: true },
      e(Button, null, e(SelectValue)),
      e(Popover, null, "x"),
    ),
  "ComboBox - Input": () =>
    e(
      ComboBox,
      { "aria-label": "f" },
      e(Button, null, "v"),
      e(Popover, null, e(ListBox, null, e(ListBoxItem, { id: "a" }, "A"))),
    ),
  "Slider - Thumb": () => e(Slider, { "aria-label": "s" }, e(SliderTrack)),
  "Calendar - Grid": () => e(Calendar, { "aria-label": "c" }, e(Heading)),
  "NumberField - Input": () =>
    e(
      NumberField,
      { "aria-label": "f" },
      e(Button, { slot: "increment" }, "+"),
    ),
  "DatePicker - DateInput": () =>
    e(DatePicker, { "aria-label": "f" }, e(Group, null, e(Button, null, "v"))),
  "Tabs - TabPanel": () =>
    e(Tabs, null, e(TabList, { "aria-label": "t" }, e(Tab, { id: "a" }, "A"))),
  "Disclosure - trigger": () =>
    e(Disclosure, null, e(DisclosurePanel, null, "a")),
  "CheckboxField - CheckboxButton": () =>
    e(CheckboxField, null, e(Text, { slot: "description" }, "d")),
  "TextField - Input": () =>
    e(TextField, { "aria-label": "f" }, e(Label, null, "L")),
  "ListBox - items": () => e(ListBox, { "aria-label": "l" }),
  "Menu - items": () => e(Menu, { "aria-label": "m" }),
  "Tree - items": () => e(Tree, { "aria-label": "t" }),
  "TagGroup - TagList": () =>
    e(TagGroup, { "aria-label": "t" }, e(Label, null, "L")),
  "TagList - items": () => e(TagGroup, { "aria-label": "t" }, e(TagList)),
  "Tabs - TabList": () => e(Tabs, null, e(TabPanel, { id: "a" }, "a")),
  "Table - TableBody": () =>
    e(
      Table,
      { "aria-label": "t" },
      e(TableHeader, null, e(Column, { id: "c", isRowHeader: true }, "C")),
    ),
  "Table - TableHeader": () =>
    e(
      Table,
      { "aria-label": "t" },
      e(TableBody, null, e(Row, { id: "r" }, e(Cell, null, "A"))),
    ),
  "Slider - Track": () => e(Slider, { "aria-label": "s" }, e(SliderOutput)),
  "SwitchField - SwitchButton": () =>
    e(SwitchField, null, e(Text, { slot: "description" }, "d")),
  "DialogTrigger - overlay": () =>
    e(DialogTrigger, { defaultOpen: true }, e(Button, null, "Open")),
  "MenuTrigger - Menu": () =>
    e(
      MenuTrigger,
      { defaultOpen: true },
      e(Button, null, "Open"),
      e(Popover, null, "x"),
    ),
};

const roles = (html) =>
  [...new Set([...html.matchAll(/role="([a-z]+)"/g)].map((m) => m[1]))].sort();
const tags = (html) =>
  [
    ...new Set([...html.matchAll(/<(input|button|svg)\b/g)].map((m) => m[1])),
  ].sort();

const result = {
  racVersion,
  generatedAt: new Date().toISOString().slice(0, 10),
  contexts: CONTEXTS.length,
  fixtures: {},
  renderProps: {},
  orphans: {},
  missing: {},
};

await mount("__root__", () => P("__root__"));
for (const [name, build] of Object.entries(FIXTURES)) {
  const { thrown, warnings } = await mount(name, build);
  result.fixtures[name] = { thrown, warnings, positions: seen[name] ?? {} };
}
for (const [name, build] of Object.entries(ORPHANS)) {
  const { thrown, html } = await mount(`orphan:${name}`, build);
  result.orphans[name] = thrown
    ? { throws: thrown.split("\n")[0].slice(0, 200) }
    : { throws: null, rendered: html.length > 0 };
}
result.childKind = {};
for (const [name, build] of Object.entries(CHILD_KIND)) {
  const { thrown, html } = await mount(`child:${name}`, build);
  const free = (html.match(/data-free=""/g) ?? []).length;
  result.childKind[name] = thrown
    ? {
        kind: "items",
        evidence: `throws: ${thrown.split("\n")[0].slice(0, 160)}`,
      }
    : free > 0
      ? { kind: "free", evidence: `rendered ${free}` }
      : { kind: "items", evidence: "dropped" };
}
for (const [name, build] of Object.entries(MISSING)) {
  const { thrown, warnings, html } = await mount(`missing:${name}`, build);
  result.missing[name] = {
    thrown,
    warnings: warnings.slice(0, 3),
    roles: roles(html),
    tags: tags(html),
  };
}
for (const [part, keys] of Object.entries(renderProps))
  result.renderProps[part] = [...keys].sort();

console.error = origError;
console.warn = origWarn;
const out = process.argv[2];
const json = `${JSON.stringify(result, null, 2)}\n`;
if (out) writeFileSync(out, json);
else process.stdout.write(json);
const failedFixtures = Object.entries(result.fixtures)
  .filter(([, v]) => v.thrown)
  .map(([k, v]) => `${k}: ${v.thrown}`);
console.log(
  `RAC ${racVersion} · fixtures ${Object.keys(result.fixtures).length} (throw ${failedFixtures.length}) · orphans ${Object.keys(result.orphans).length} · missing ${Object.keys(result.missing).length} · render-props parts ${Object.keys(result.renderProps).length} · child-kind ${Object.keys(result.childKind).length}`,
);
for (const line of failedFixtures) console.log(`  fixture throw — ${line}`);
process.exit(0);
