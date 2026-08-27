<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Menu.html -->
<!-- Last fetched: 2026-04-05 -->

# Menu

Menus display a list of actions or options that a user can choose. Supports static/dynamic collections, selection modes, sections, complex items, and submenus.

## Import

```javascript
import {
  Menu,
  MenuTrigger,
  ContextualHelpTrigger,
} from "@adobe/react-spectrum";
```

## Basic Example

```jsx
<MenuTrigger>
  <ActionButton>Edit</ActionButton>
  <Menu onAction={(key) => alert(key)}>
    <Item key="cut">Cut</Item>
    <Item key="copy">Copy</Item>
    <Item key="paste">Paste</Item>
    <Item key="replace">Replace</Item>
  </Menu>
</MenuTrigger>
```

## Content Types

### Static Collections

```jsx
<MenuTrigger>
  <ActionButton>Edit</ActionButton>
  <Menu onAction={(key) => alert(key)}>
    <Item key="cut">Cut</Item>
    <Item key="copy">Copy</Item>
  </Menu>
</MenuTrigger>
```

### Dynamic Collections

```jsx
function Example() {
  let menuItems = [
    { name: "Cut" },
    { name: "Copy" },
    { name: "Paste" },
    { name: "Replace" },
  ];

  return (
    <MenuTrigger>
      <ActionButton>Edit</ActionButton>
      <Menu items={menuItems}>
        {(item) => <Item key={item.name}>{item.name}</Item>}
      </Menu>
    </MenuTrigger>
  );
}
```

### Sections

```jsx
<MenuTrigger>
  <ActionButton>Edit</ActionButton>
  <Menu selectionMode="multiple">
    <Section title="Styles">
      <Item key="bold">Bold</Item>
      <Item key="underline">Underline</Item>
    </Section>
    <Section title="Align">
      <Item key="left">Left</Item>
      <Item key="middle">Middle</Item>
      <Item key="right">Right</Item>
    </Section>
  </Menu>
</MenuTrigger>
```

### Dynamic Sections

```jsx
function Example() {
  let openWindows = [
    {
      name: "Left Panel",
      id: "left",
      children: [{ id: 1, name: "Final Copy (1)" }],
    },
    {
      name: "Right Panel",
      id: "right",
      children: [
        { id: 2, name: "index.ts" },
        { id: 3, name: "package.json" },
      ],
    },
  ];

  return (
    <MenuTrigger>
      <ActionButton>Window</ActionButton>
      <Menu items={openWindows} selectionMode="multiple">
        {(item) => (
          <Section items={item.children} title={item.name}>
            {(item) => <Item>{item.name}</Item>}
          </Section>
        )}
      </Menu>
    </MenuTrigger>
  );
}
```

## Selection Modes

### Single Selection

```jsx
function Example() {
  let [selected, setSelected] = React.useState(new Set(["middle"]));

  return (
    <MenuTrigger>
      <ActionButton>Align</ActionButton>
      <Menu
        selectionMode="single"
        selectedKeys={selected}
        onSelectionChange={setSelected}
      >
        <Item key="left">Left</Item>
        <Item key="middle">Middle</Item>
        <Item key="right">Right</Item>
      </Menu>
    </MenuTrigger>
  );
}
```

### Multiple Selection

```jsx
<MenuTrigger closeOnSelect={false}>
  <ActionButton>Show</ActionButton>
  <Menu
    selectionMode="multiple"
    selectedKeys={selected}
    onSelectionChange={setSelected}
  >
    <Item key="Sidebar">Sidebar</Item>
    <Item key="Searchbar">Searchbar</Item>
    <Item key="Tools">Tools</Item>
    <Item key="Console">Console</Item>
  </Menu>
</MenuTrigger>
```

## Links

```jsx
<MenuTrigger>
  <ActionButton>Links</ActionButton>
  <Menu>
    <Item href="https://adobe.com/" target="_blank">
      Adobe
    </Item>
    <Item href="https://apple.com/" target="_blank">
      Apple
    </Item>
  </Menu>
</MenuTrigger>
```

## Complex Menu Items

```jsx
import { Keyboard, Text } from "@adobe/react-spectrum";

<MenuTrigger>
  <ActionButton>Edit</ActionButton>
  <Menu>
    <Item key="cut" textValue="cut">
      <Cut />
      <Text>Cut</Text>
      <Keyboard>&#x2318;X</Keyboard>
    </Item>
    <Item key="copy" textValue="copy">
      <Copy />
      <Text>Copy</Text>
      <Keyboard>&#x2318;C</Keyboard>
    </Item>
  </Menu>
</MenuTrigger>;
```

## Unavailable Items

```jsx
import { Content, Dialog, Heading } from "@adobe/react-spectrum";
import { ContextualHelpTrigger } from "@react-spectrum/menu";

<MenuTrigger>
  <ActionButton>Edit</ActionButton>
  <Menu>
    <Item key="undo">Undo</Item>
    <ContextualHelpTrigger isUnavailable>
      <Item key="cut">Cut</Item>
      <Dialog>
        <Heading>Cut</Heading>
        <Content>Select text to enable.</Content>
      </Dialog>
    </ContextualHelpTrigger>
  </Menu>
</MenuTrigger>;
```

## Submenus

### Static

```jsx
import { SubmenuTrigger } from "@react-spectrum/menu";

<MenuTrigger>
  <ActionButton>Actions</ActionButton>
  <Menu onAction={(key) => alert(`Root: ${key}`)}>
    <Item key="Copy">Copy</Item>
    <Item key="Cut">Cut</Item>
    <SubmenuTrigger>
      <Item key="Share">Share</Item>
      <Menu onAction={(key) => alert(`Share: ${key}`)}>
        <Item key="Copy Link">Copy Link</Item>
        <Item key="SMS">SMS</Item>
      </Menu>
    </SubmenuTrigger>
  </Menu>
</MenuTrigger>;
```

### Dynamic

```jsx
import { SubmenuTrigger } from "@react-spectrum/menu";

let items = [
  { name: "Copy" },
  { name: "Cut" },
  { name: "Share", children: [{ name: "Copy Link" }, { name: "SMS" }] },
];

<MenuTrigger>
  <ActionButton>Actions</ActionButton>
  <Menu items={items}>
    {function renderSubmenu(item) {
      if (item.children) {
        return (
          <SubmenuTrigger>
            <Item key={item.name}>{item.name}</Item>
            <Menu items={item.children}>{(item) => renderSubmenu(item)}</Menu>
          </SubmenuTrigger>
        );
      }
      return <Item key={item.name}>{item.name}</Item>;
    }}
  </Menu>
</MenuTrigger>;
```

## Props API

### Menu Props

| Name                     | Type                               | Default            | Description                        |
| ------------------------ | ---------------------------------- | ------------------ | ---------------------------------- |
| `children`               | `CollectionChildren<object>`       | --                 | Collection contents                |
| `items`                  | `Iterable<object>`                 | --                 | Data items for dynamic collections |
| `selectionMode`          | `'none' \| 'single' \| 'multiple'` | `'none'`           | Selection behavior                 |
| `selectedKeys`           | `'all' \| Iterable<Key>`           | --                 | Controlled selected items          |
| `defaultSelectedKeys`    | `'all' \| Iterable<Key>`           | --                 | Uncontrolled initial selection     |
| `disabledKeys`           | `Iterable<Key>`                    | --                 | Non-interactive item keys          |
| `disallowEmptySelection` | `boolean`                          | --                 | Require at least one selection     |
| `escapeKeyBehavior`      | `'clearSelection' \| 'none'`       | `'clearSelection'` | Escape key handling                |
| `autoFocus`              | `boolean \| 'first' \| 'last'`     | --                 | Focus on open                      |
| `shouldFocusWrap`        | `boolean`                          | --                 | Circular keyboard navigation       |

### Menu Events

| Name                | Type                        | Description                       |
| ------------------- | --------------------------- | --------------------------------- |
| `onAction`          | `(key: Key) => void`        | Item selected (no selection mode) |
| `onSelectionChange` | `(keys: Selection) => void` | Selection changed                 |
| `onClose`           | `() => void`                | Menu should close                 |

### Item Props

| Name         | Type                        | Description                           |
| ------------ | --------------------------- | ------------------------------------- |
| `children`   | `ReactNode`                 | Item contents                         |
| `key`        | `Key`                       | Unique identifier (required)          |
| `textValue`  | `string`                    | Text for typeahead                    |
| `href`       | `Href`                      | Link URL                              |
| `target`     | `HTMLAttributeAnchorTarget` | Link target                           |
| `title`      | `ReactNode`                 | Title if children contain child items |
| `aria-label` | `string`                    | Accessibility label                   |

### Section Props

| Name         | Type                            | Description                  |
| ------------ | ------------------------------- | ---------------------------- |
| `children`   | `ItemElement[] \| ItemRenderer` | Child items                  |
| `items`      | `Iterable<T>`                   | Dynamic item data            |
| `title`      | `ReactNode`                     | Section header               |
| `aria-label` | `string`                        | Label (required if no title) |

### ContextualHelpTrigger Props

| Name            | Type             | Description                      |
| --------------- | ---------------- | -------------------------------- |
| `children`      | `[Item, Dialog]` | Trigger Item and Dialog elements |
| `isUnavailable` | `boolean`        | Disable item with help dialog    |

### SubmenuTrigger Props

| Name       | Type             | Description            |
| ---------- | ---------------- | ---------------------- |
| `children` | `ReactElement[]` | Item and Menu elements |

### Accessibility Props

| Name               | Type     | Description           |
| ------------------ | -------- | --------------------- |
| `id`               | `string` | Unique identifier     |
| `aria-label`       | `string` | Element label         |
| `aria-labelledby`  | `string` | Label reference       |
| `aria-describedby` | `string` | Description reference |
| `aria-details`     | `string` | Details reference     |

### Layout/Spacing/Sizing/Positioning Props (Responsive)

All standard Spectrum layout props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

### Advanced Props

| Name               | Type            | Description                 |
| ------------------ | --------------- | --------------------------- |
| `UNSAFE_className` | `string`        | CSS class (last resort)     |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort) |

## Accessibility

- Arrow keys for navigation, Enter/Space to select, Escape to close/clear
- Layout automatically flips for RTL languages
- Section `aria-label` required when section has no `title`
- ContextualHelpTrigger explains why items are disabled
- On mobile devices, menus automatically display as trays instead of popovers
