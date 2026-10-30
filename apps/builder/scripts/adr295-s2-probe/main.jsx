// ADR-295 Phase 0 — S2 1.8.1 설치본 컴포넌트를 size 마다 그려 computed 치수를 읽는 probe 페이지.
// adr295-s2-token-extract.mjs 가 vite 로 빌드해 Playwright 로 desktop · touch 두 조건에서 잰다.
import { createRoot } from "react-dom/client";
import { Provider } from "@react-spectrum/s2/Provider";
import { TextField } from "@react-spectrum/s2/TextField";
import { TextArea } from "@react-spectrum/s2/TextArea";
import { Button } from "@react-spectrum/s2/Button";
import { ActionButton } from "@react-spectrum/s2/ActionButton";
import { ToggleButton } from "@react-spectrum/s2/ToggleButton";
import { Picker, PickerItem } from "@react-spectrum/s2/Picker";
import { ComboBox, ComboBoxItem } from "@react-spectrum/s2/ComboBox";
import { NumberField } from "@react-spectrum/s2/NumberField";
import { SearchField } from "@react-spectrum/s2/SearchField";
import { DateField } from "@react-spectrum/s2/DateField";
import { Checkbox } from "@react-spectrum/s2/Checkbox";
import { Switch } from "@react-spectrum/s2/Switch";
import { RadioGroup, Radio } from "@react-spectrum/s2/RadioGroup";
import { TagGroup, Tag } from "@react-spectrum/s2/TagGroup";
import { Badge } from "@react-spectrum/s2/Badge";
import { Slider } from "@react-spectrum/s2/Slider";
import { Meter } from "@react-spectrum/s2/Meter";
import { ProgressBar } from "@react-spectrum/s2/ProgressBar";
import { SegmentedControl, SegmentedControlItem } from "@react-spectrum/s2/SegmentedControl";
import { Tabs, TabList, Tab, TabPanel } from "@react-spectrum/s2/Tabs";
import { Text, Heading, Content } from "@react-spectrum/s2";
import { Disclosure, DisclosureTitle, DisclosurePanel } from "@react-spectrum/s2/Disclosure";
import { Breadcrumbs, Breadcrumb } from "@react-spectrum/s2/Breadcrumbs";
import { DatePicker } from "@react-spectrum/s2/DatePicker";
import { IllustratedMessage } from "@react-spectrum/s2/IllustratedMessage";
import Edit from "@react-spectrum/s2/icons/Edit";
import NoSearchResults from "@react-spectrum/s2/illustrations/linear/NoSearchResults";

const SIZES = ["XS", "S", "M", "L", "XL"];
const FIELD = ["S", "M", "L", "XL"];

const families = [
  ["TextField", FIELD, (s) => <TextField size={s} label="Label" />],
  ["TextArea", FIELD, (s) => <TextArea size={s} label="Label" />],
  ["Picker", FIELD, (s) => (<Picker size={s} label="Label"><PickerItem id="a">A</PickerItem></Picker>)],
  ["ComboBox", FIELD, (s) => (<ComboBox size={s} label="Label"><ComboBoxItem id="a">A</ComboBoxItem></ComboBox>)],
  ["NumberField", FIELD, (s) => <NumberField size={s} label="Label" />],
  ["SearchField", FIELD, (s) => <SearchField size={s} label="Label" />],
  ["DateField", FIELD, (s) => <DateField size={s} label="Label" />],
  ["Button", FIELD, (s) => <Button size={s}>Label</Button>],
  ["ButtonIcon", FIELD, (s) => (<Button size={s}><Edit /><Text>Label</Text></Button>)],
  ["ActionButton", SIZES, (s) => <ActionButton size={s}>Label</ActionButton>],
  ["ActionButtonIcon", SIZES, (s) => (<ActionButton size={s}><Edit /><Text>Label</Text></ActionButton>)],
  ["ToggleButton", SIZES, (s) => <ToggleButton size={s}>Label</ToggleButton>],
  ["Checkbox", FIELD, (s) => <Checkbox size={s}>Label</Checkbox>],
  ["Switch", FIELD, (s) => <Switch size={s}>Label</Switch>],
  ["RadioGroup", FIELD, (s) => (<RadioGroup size={s} label="Label"><Radio value="a">A</Radio></RadioGroup>)],
  ["TagGroup", ["S", "M", "L"], (s) => (<TagGroup size={s} label="Label"><Tag id="a">Tag</Tag></TagGroup>)],
  ["Badge", ["S", "M", "L", "XL"], (s) => <Badge size={s}>Badge</Badge>],
  ["Slider", ["S", "M", "L", "XL"], (s) => <Slider size={s} label="Label" defaultValue={30} />],
  ["Meter", ["S", "M", "L", "XL"], (s) => <Meter size={s} label="Label" value={30} />],
  ["ProgressBar", ["S", "M", "L", "XL"], (s) => <ProgressBar size={s} label="Label" value={30} />],
  ["SegmentedControl", ["S", "M", "L", "XL"], (s) => (<SegmentedControl size={s} aria-label="seg"><SegmentedControlItem id="a">A</SegmentedControlItem><SegmentedControlItem id="b">B</SegmentedControlItem></SegmentedControl>)],
  ["Tabs", ["S", "M", "L", "XL"], (s) => (<Tabs density="regular" aria-label="tabs" size={s}><TabList><Tab id="a">Tab</Tab></TabList><TabPanel id="a">x</TabPanel></Tabs>)],
  // (Phase 3b — 아이콘 가족: 대표 상자는 안 쓰고 svg 치수만 읽는다)
  ["ToggleButtonIcon", SIZES, (s) => (<ToggleButton size={s}><Edit /><Text>Label</Text></ToggleButton>)],
  ["Disclosure", FIELD, (s) => (<Disclosure size={s}><DisclosureTitle>Title</DisclosureTitle><DisclosurePanel>x</DisclosurePanel></Disclosure>)],
  ["Breadcrumbs", ["M", "L"], (s) => (<Breadcrumbs size={s}><Breadcrumb>A</Breadcrumb><Breadcrumb>B</Breadcrumb></Breadcrumbs>)],
  ["DatePicker", FIELD, (s) => <DatePicker size={s} label="Label" />],
  ["TagGroupRemovable", ["S", "M", "L"], (s) => (<TagGroup size={s} label="Label" onRemove={() => {}}><Tag id="a">Tag</Tag></TagGroup>)],
  ["IllustratedMessage", ["S", "M", "L"], (s) => (<IllustratedMessage size={s}><NoSearchResults /><Heading>H</Heading><Content>C</Content></IllustratedMessage>)],
];

function App() {
  return (
    <Provider background="base">
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {families.map(([name, sizes, render]) =>
          sizes.map((s) => (
            <div key={name + s} data-probe={name} data-size={s} style={{ display: "flex", alignItems: "flex-start" }}>
              {render(s)}
            </div>
          )),
        )}
      </div>
    </Provider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
