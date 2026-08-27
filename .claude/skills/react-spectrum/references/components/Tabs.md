<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Tabs.html -->
<!-- Last fetched: 2026-04-05 -->

# Tabs

Tabs organize content into multiple sections and allow users to navigate between them. The content under the set of tabs should be related and form a coherent unit.

**Added in:** 3.11.0

```tsx
import { Item, TabList, TabPanels, Tabs } from "@adobe/react-spectrum";
```

## Usage Examples

### Static Tabs

```jsx
<Tabs aria-label="History of Ancient Rome">
  <TabList>
    <Item key="FoR">Founding of Rome</Item>
    <Item key="MaR">Monarchy and Republic</Item>
    <Item key="Emp">Empire</Item>
  </TabList>
  <TabPanels>
    <Item key="FoR">Arma virumque cano, Troiae qui primus ab oris.</Item>
    <Item key="MaR">Senatus Populusque Romanus.</Item>
    <Item key="Emp">Alea jacta est.</Item>
  </TabPanels>
</Tabs>
```

### Dynamic Collections

```jsx
function Example() {
  let tabs = [
    { id: 1, name: 'Founding of Rome', children: 'Arma virumque cano, Troiae qui primus ab oris.' },
    { id: 2, name: 'Monarchy and Republic', children: 'Senatus Populusque Romanus.' },
    { id: 3, name: 'Empire', children: 'Alea jacta est.' }
  ];
  type Tab = typeof tabs[0];
  let [tabId, setTabId] = React.useState<Key>(1);

  return (
    <Tabs aria-label="History of Ancient Rome" items={tabs} onSelectionChange={setTabId}>
      <TabList>{(item: Tab) => <Item>{item.name}</Item>}</TabList>
      <TabPanels>{(item: Tab) => <Item>{item.children}</Item>}</TabPanels>
    </Tabs>
  );
}
```

### Tabs with Icons

```jsx
<Tabs aria-label="History of Ancient Rome">
  <TabList>
    <Item key="FoR" textValue="FoR">
      <Bookmark />
      <Text>Founding of Rome</Text>
    </Item>
    <Item key="MaR" textValue="MaR">
      <Calendar />
      <Text>Monarchy and Republic</Text>
    </Item>
    <Item key="Emp" textValue="Emp">
      <Dashboard />
      <Text>Empire</Text>
    </Item>
  </TabList>
  <TabPanels>
    <Item key="FoR">Arma virumque cano, Troiae qui primus ab oris.</Item>
    <Item key="MaR">Senatus Populusque Romanus.</Item>
    <Item key="Emp">Alea jacta est.</Item>
  </TabPanels>
</Tabs>
```

### Controlled Tabs

```jsx
function Example() {
  let [tab, setTab] = React.useState<Key>(2);
  let tabs = [
    { id: 1, name: 'Keyboard Settings', children: 'No keyboard detected.' },
    { id: 2, name: 'Mouse Settings', children: 'No mouse detected.' },
    { id: 3, name: 'Gamepad Settings', children: 'No gamepad detected' }
  ];
  type Tab = typeof tabs[0];

  return (
    <Tabs aria-labelledby="label-3" items={tabs} selectedKey={tab} onSelectionChange={setTab}>
      <TabList>{(item: Tab) => <Item>{item.name}</Item>}</TabList>
      <TabPanels>{(item: Tab) => <Item>{item.children}</Item>}</TabPanels>
    </Tabs>
  );
}
```

### Manual Keyboard Activation

```jsx
<Tabs aria-label="Mesozoic time periods" items={tabs} keyboardActivation="manual">
  <TabList>{(item: Tab) => <Item key={item.name}>{item.name}</Item>}</TabList>
  <TabPanels>{(item: Tab) => <Item key={item.name}>{item.children}</Item>}</TabPanels>
</Tabs>
```

### Tabs as Links with Routing

```jsx
import {
  BrowserRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { RouterProvider } from "@adobe/react-spectrum";

function AppTabs() {
  let { pathname } = useLocation();
  return (
    <Tabs selectedKey={pathname}>
      <TabList aria-label="Tabs">
        <Item key="/" href="/">
          Home
        </Item>
        <Item key="/shared" href="/shared">
          Shared
        </Item>
        <Item key="/deleted" href="/deleted">
          Deleted
        </Item>
      </TabList>
      <TabPanels>
        <Item key="/">
          <Outlet />
        </Item>
        <Item key="/shared">
          <Outlet />
        </Item>
        <Item key="/deleted">
          <Outlet />
        </Item>
      </TabPanels>
    </Tabs>
  );
}
```

### Visual Variants

```jsx
// Compact density
<Tabs aria-label="Chat log" density="compact">{/* ... */}</Tabs>

// Quiet style
<Tabs aria-label="Chat log" isQuiet>{/* ... */}</Tabs>

// Disabled keys
<Tabs aria-label="Chat log" disabledKeys={['item2']}>{/* ... */}</Tabs>

// Fully disabled
<Tabs aria-label="Chat log" isDisabled>{/* ... */}</Tabs>

// Vertical orientation
<Tabs aria-label="Chat log" orientation="vertical">{/* ... */}</Tabs>
```

## Props API

### Tabs Props

| Name                 | Type                         | Default        | Description                                                              |
| -------------------- | ---------------------------- | -------------- | ------------------------------------------------------------------------ |
| `children`           | `ReactNode`                  | --             | Children should include `<TabList>` and `<TabPanels>` elements           |
| `items`              | `Iterable<object>`           | --             | Item objects for each tab in dynamic collections                         |
| `disabledKeys`       | `Iterable<Key>`              | --             | Keys of tabs that cannot be selected, focused, or interacted with        |
| `isDisabled`         | `boolean`                    | --             | Disables all tabs                                                        |
| `isQuiet`            | `boolean`                    | --             | Displays tabs in quiet style                                             |
| `isEmphasized`       | `boolean`                    | --             | Displays tabs in emphasized style                                        |
| `density`            | `'compact' \| 'regular'`     | --             | Controls spacing between tabs                                            |
| `selectedKey`        | `Key`                        | --             | Currently selected key (controlled)                                      |
| `defaultSelectedKey` | `Key`                        | --             | Initial selected key (uncontrolled)                                      |
| `keyboardActivation` | `'automatic' \| 'manual'`    | `'automatic'`  | Whether selection changes automatically on focus or requires Enter/Space |
| `orientation`        | `'horizontal' \| 'vertical'` | `'horizontal'` | Tab layout direction                                                     |
| `onSelectionChange`  | `(key: Key) => void`         | --             | Called when selection changes                                            |

### Accessibility Props

| Name               | Type     | Description                                |
| ------------------ | -------- | ------------------------------------------ |
| `id`               | `string` | Unique element identifier                  |
| `aria-label`       | `string` | Labels the tab group                       |
| `aria-labelledby`  | `string` | References labeling element(s)             |
| `aria-describedby` | `string` | References describing element(s)           |
| `aria-details`     | `string` | References detailed description element(s) |

### Layout Props (abbreviated)

`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd` -- all `Responsive<>` typed.

### Spacing Props (abbreviated)

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY` -- all `Responsive<DimensionValue>`.

### Sizing Props (abbreviated)

`width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight` -- all `Responsive<DimensionValue>`.

### Positioning Props (abbreviated)

`position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden` -- all `Responsive<>` typed.

### Advanced Props

| Name               | Type            | Description                 |
| ------------------ | --------------- | --------------------------- |
| `UNSAFE_className` | `string`        | CSS className (last resort) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort) |

### TabList Props

| Name       | Type                    | Description                                           |
| ---------- | ----------------------- | ----------------------------------------------------- |
| `children` | `CollectionChildren<T>` | Tab items. Item keys should match `<TabPanels>` items |

Inherits Layout, Spacing, Positioning, Accessibility, and Advanced props.

### TabPanels Props

| Name       | Type                         | Description                                              |
| ---------- | ---------------------------- | -------------------------------------------------------- |
| `children` | `CollectionChildren<object>` | Panel contents. Item keys should match `<TabList>` items |

Inherits Layout, Spacing, Positioning, Accessibility, and Advanced props.

## Events

| Name                | Type                 | Description                       |
| ------------------- | -------------------- | --------------------------------- |
| `onSelectionChange` | `(key: Key) => void` | Called when tab selection changes |

## Accessibility

- Provide `aria-label` on `<Tabs>` for screen readers
- Arrow keys navigate between tabs
- `keyboardActivation="automatic"` switches selection on focus, `"manual"` requires Enter/Space
- RTL languages automatically flip layout
