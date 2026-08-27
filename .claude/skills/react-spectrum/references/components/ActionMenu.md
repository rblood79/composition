<!-- Source: https://react-spectrum.adobe.com/react-spectrum/ActionMenu.html -->
<!-- Last fetched: 2026-04-05 -->

# ActionMenu

ActionMenu combines an ActionButton with a Menu for simple "more actions" use cases. It automatically adapts to mobile devices by displaying in a tray instead of a popover.

**Added:** v3.18.0

```tsx
import { ActionMenu } from "@adobe/react-spectrum";
```

## Basic Usage

```tsx
<ActionMenu>
  <Item>Cut</Item>
  <Item>Copy</Item>
  <Item>Paste</Item>
</ActionMenu>
```

## Content

### Static Collections

```tsx
<ActionMenu>
  <Item key="cut">Cut</Item>
  <Item key="copy">Copy</Item>
  <Item key="paste">Paste</Item>
</ActionMenu>
```

### Dynamic Collections

```tsx
function Example() {
  let items = [
    { name: "Cut" },
    { name: "Copy" },
    { name: "Paste" },
    { name: "Select All" },
  ];

  return (
    <ActionMenu items={items}>
      {(item) => <Item key={item.name}>{item.name}</Item>}
    </ActionMenu>
  );
}
```

### Sections

```tsx
<ActionMenu>
  <Section title="File">
    <Item key="new">New</Item>
    <Item key="open">Open...</Item>
  </Section>
  <Section title="Save">
    <Item key="save">Save</Item>
    <Item key="saveAs">Save As...</Item>
  </Section>
</ActionMenu>
```

### Dynamic Sections

```tsx
function Example() {
  let data = [
    {
      name: "Reversion",
      id: "reversion",
      children: [
        { id: "undo", name: "Undo" },
        { id: "redo", name: "Redo" },
      ],
    },
    {
      name: "Clipboard",
      id: "clipboard",
      children: [
        { id: "cut", name: "Cut" },
        { id: "copy", name: "Copy" },
        { id: "paste", name: "Paste" },
      ],
    },
  ];

  return (
    <ActionMenu items={data}>
      {(item) => (
        <Section items={item.children} title={item.name}>
          {(item) => <Item>{item.name}</Item>}
        </Section>
      )}
    </ActionMenu>
  );
}
```

### Complex Items

```tsx
import { Keyboard, Text } from "@adobe/react-spectrum";

<ActionMenu>
  <Item key="cut" textValue="cut">
    <Cut />
    <Text>Cut</Text>
    <Keyboard>⌘X</Keyboard>
  </Item>
  <Item key="copy" textValue="copy">
    <Copy />
    <Text>Copy</Text>
    <Keyboard>⌘C</Keyboard>
  </Item>
  <Item key="paste" textValue="paste">
    <Paste />
    <Text>Paste</Text>
    <Keyboard>⌘V</Keyboard>
  </Item>
</ActionMenu>;
```

## Events

### onAction

Called when a menu item is pressed, receiving the item's key:

```tsx
function Example() {
  let [action, setAction] = React.useState(null);

  return (
    <>
      <ActionMenu onAction={setAction}>
        <Item key="cut">Cut</Item>
        <Item key="copy">Copy</Item>
        <Item key="paste">Paste</Item>
      </ActionMenu>
      <p>Action: {action}</p>
    </>
  );
}
```

## Links

Items can function as links using the `href` property:

```tsx
<ActionMenu>
  <Item href="https://adobe.com/" target="_blank">
    Adobe
  </Item>
  <Item href="https://apple.com/" target="_blank">
    Apple
  </Item>
  <Item href="https://google.com/" target="_blank">
    Google
  </Item>
</ActionMenu>
```

## Visual Options

### Quiet Style

```tsx
<ActionMenu isQuiet>
  <Item key="cut">Cut</Item>
  <Item key="copy">Copy</Item>
</ActionMenu>
```

### Disabled

```tsx
<ActionMenu isDisabled>
  <Item key="cut">Cut</Item>
  <Item key="copy">Copy</Item>
</ActionMenu>
```

### Disabled Items

```tsx
<ActionMenu disabledKeys={["redo", "paste"]}>
  <Item key="undo">Undo</Item>
  <Item key="redo">Redo</Item>
  <Item key="cut">Cut</Item>
  <Item key="paste">Paste</Item>
</ActionMenu>
```

### Placement

```tsx
<Flex gap="size-100">
  <ActionMenu align="start">
    <Item key="cut">Cut</Item>
    <Item key="copy">Copy</Item>
  </ActionMenu>
  <ActionMenu align="end" direction="top" shouldFlip={false}>
    <Item key="cut">Cut</Item>
    <Item key="copy">Copy</Item>
  </ActionMenu>
</Flex>
```

### Controlled Open State

```tsx
function Example() {
  let [open, setOpen] = React.useState(false);

  return (
    <ActionMenu isOpen={open} onOpenChange={setOpen}>
      <Item key="cut">Cut</Item>
      <Item key="copy">Copy</Item>
    </ActionMenu>
  );
}
```

## Props

| Name            | Type                                                         | Default    | Description                          |
| --------------- | ------------------------------------------------------------ | ---------- | ------------------------------------ |
| `children`      | `CollectionChildren<object>`                                 | --         | Collection contents                  |
| `items`         | `Iterable<object>`                                           | --         | Item objects for dynamic collections |
| `isDisabled`    | `boolean`                                                    | --         | Disables the button                  |
| `isQuiet`       | `boolean`                                                    | --         | Quiet style                          |
| `autoFocus`     | `boolean`                                                    | --         | Focus on render                      |
| `disabledKeys`  | `Iterable<Key>`                                              | --         | Keys of disabled items               |
| `align`         | `'start' \| 'end'`                                           | `'start'`  | Menu alignment relative to trigger   |
| `direction`     | `'bottom' \| 'top' \| 'left' \| 'right' \| 'start' \| 'end'` | `'bottom'` | Menu opening direction               |
| `shouldFlip`    | `boolean`                                                    | `true`     | Auto-flip when space limited         |
| `closeOnSelect` | `boolean`                                                    | `true`     | Close after selection                |
| `trigger`       | `'press' \| 'longPress'`                                     | `'press'`  | Activation method                    |
| `isOpen`        | `boolean`                                                    | --         | Controlled open state                |
| `defaultOpen`   | `boolean`                                                    | --         | Uncontrolled default open            |
| `id`            | `string`                                                     | --         | Unique identifier                    |

### Events

| Name           | Type                        | Description                    |
| -------------- | --------------------------- | ------------------------------ |
| `onAction`     | `(key: Key) => void`        | Fired when an item is selected |
| `onOpenChange` | `(isOpen: boolean) => void` | Fired when open state changes  |

### Accessibility Props

| Name               | Type     | Description                     |
| ------------------ | -------- | ------------------------------- |
| `aria-label`       | `string` | Element label                   |
| `aria-labelledby`  | `string` | References labeling element     |
| `aria-describedby` | `string` | References description element  |
| `aria-details`     | `string` | References detailed description |

Layout/spacing/positioning props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`, `UNSAFE_className`, `UNSAFE_style`

### Item Props

| Name             | Type                          | Description                           |
| ---------------- | ----------------------------- | ------------------------------------- |
| `children`       | `ReactNode`                   | Item content or child items           |
| `title`          | `ReactNode`                   | Rendered title if children are nested |
| `textValue`      | `string`                      | Text for typeahead and accessibility  |
| `aria-label`     | `string`                      | Accessibility label                   |
| `childItems`     | `Iterable<T>`                 | Child items for dynamic collections   |
| `hasChildItems`  | `boolean`                     | Whether item has children             |
| `href`           | `Href`                        | Link URL                              |
| `hrefLang`       | `string`                      | Language hint for linked URL          |
| `target`         | `HTMLAttributeAnchorTarget`   | Link target window                    |
| `rel`            | `string`                      | Relationship to linked resource       |
| `download`       | `boolean \| string`           | Download linked URL                   |
| `ping`           | `string`                      | URLs to ping when followed            |
| `referrerPolicy` | `HTMLAttributeReferrerPolicy` | Referrer policy                       |
| `routerOptions`  | `RouterOptions`               | Client router config                  |

### Section Props

| Name         | Type                                                    | Description                       |
| ------------ | ------------------------------------------------------- | --------------------------------- |
| `children`   | `ItemElement<T> \| ItemElement<T>[] \| ItemRenderer<T>` | Static items or render function   |
| `title`      | `ReactNode`                                             | Section header                    |
| `aria-label` | `string`                                                | Accessibility label when no title |
| `items`      | `Iterable<T>`                                           | Dynamic items                     |

## Accessibility

- Section elements without a `title` must provide an `aria-label`
- Item `textValue` prop assists with typeahead functionality
- Complex items with multiple Text elements require `slot="description"` on descriptions
- Layout automatically flips for RTL languages
- On mobile, items display in a tray instead of a popover
