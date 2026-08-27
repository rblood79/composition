<!-- Source: https://react-spectrum.adobe.com/react-spectrum/ActionBar.html -->
<!-- Last fetched: 2026-04-05 -->

# ActionBar

Action bars are used for single and bulk selection patterns when a user needs to perform actions on one or more items at the same time.

The ActionBar component facilitates bulk operations on selected collection items, comprising an ActionGroup, clear button, and selection counter.

**Added:** v3.27.0

```tsx
import { ActionBar, ActionBarContainer } from "@adobe/react-spectrum";
```

## Basic Usage

```tsx
import type { Selection } from "@adobe/react-spectrum";

function Example() {
  let [selectedKeys, setSelectedKeys] = React.useState<Selection>(
    new Set(["photoshop"]),
  );

  return (
    <ActionBarContainer height={300} maxWidth="size-6000">
      <ListView
        aria-label="ListView with action bar"
        selectionMode="multiple"
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
      >
        <Item key="photoshop">Adobe Photoshop</Item>
        <Item key="illustrator">Adobe Illustrator</Item>
        <Item key="xd">Adobe XD</Item>
      </ListView>
      <ActionBar
        isEmphasized
        selectedItemCount={selectedKeys === "all" ? "all" : selectedKeys.size}
        onAction={(key) => alert(`Performing ${key} action...`)}
        onClearSelection={() => setSelectedKeys(new Set())}
      >
        <Item key="edit">
          <Edit />
          <Text>Edit</Text>
        </Item>
        <Item key="copy">
          <Copy />
          <Text>Copy</Text>
        </Item>
        <Item key="delete">
          <Delete />
          <Text>Delete</Text>
        </Item>
      </ActionBar>
    </ActionBarContainer>
  );
}
```

## Dynamic Items

```tsx
import type { Selection } from "@adobe/react-spectrum";

function Example() {
  let barItems = [
    { key: "edit", label: "Edit" },
    { key: "copy", label: "Copy" },
    { key: "delete", label: "Delete" },
  ];

  let [selectedKeys, setSelectedKeys] = React.useState<Selection>(
    new Set(["photoshop"]),
  );

  return (
    <ActionBarContainer height={300} maxWidth="size-6000">
      <ListView
        aria-label="ListView with action bar"
        selectionMode="multiple"
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
      >
        <Item key="photoshop">Adobe Photoshop</Item>
        <Item key="illustrator">Adobe Illustrator</Item>
        <Item key="xd">Adobe XD</Item>
      </ListView>
      <ActionBar
        items={barItems}
        selectedItemCount={selectedKeys === "all" ? "all" : selectedKeys.size}
        onAction={(key) => alert(`Performing ${key} action...`)}
        onClearSelection={() => setSelectedKeys(new Set())}
        isEmphasized
      >
        {(item) => <Item key={item.key}>{item.label}</Item>}
      </ActionBar>
    </ActionBarContainer>
  );
}
```

## Events

### onAction

Called when the user presses any action button. The `key` from the pressed `<Item>` is passed to the callback.

```tsx
<ActionBar onAction={(key) => alert(`Performing ${key} action...`)} />
```

### onClearSelection

Called when the clear button in the ActionBar is pressed.

```tsx
<ActionBar onClearSelection={() => setSelectedKeys(new Set())} />
```

## TableView Integration

```tsx
import type { Selection } from "@adobe/react-spectrum";

function ActionBarActions() {
  let [selectedKeys, setSelectedKeys] = React.useState<Selection>(new Set([2]));
  let rows = [
    { id: 1, name: "Charizard", type: "Fire, Flying", level: "67" },
    { id: 2, name: "Blastoise", type: "Water", level: "56" },
    { id: 3, name: "Venusaur", type: "Grass, Poison", level: "83" },
    { id: 4, name: "Pikachu", type: "Electric", level: "100" },
  ];

  return (
    <ActionBarContainer height="size-5000">
      <TableView
        aria-label="Table with action bar"
        selectionMode="multiple"
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
      >
        <TableHeader>
          <Column key="name">Name</Column>
          <Column key="type">Type</Column>
          <Column key="level" align="end">
            Level
          </Column>
        </TableHeader>
        <TableBody items={rows}>
          {(item) => <Row>{(columnKey) => <Cell>{item[columnKey]}</Cell>}</Row>}
        </TableBody>
      </TableView>
      <ActionBar
        isEmphasized
        selectedItemCount={selectedKeys === "all" ? "all" : selectedKeys.size}
        onClearSelection={() => setSelectedKeys(new Set())}
        onAction={(key) => alert(`Performing ${key} action...`)}
      >
        <Item key="edit">
          <Edit />
          <Text>Edit</Text>
        </Item>
        <Item key="delete">
          <Delete />
          <Text>Delete</Text>
        </Item>
      </ActionBar>
    </ActionBarContainer>
  );
}
```

## Visual Options

### isEmphasized

Apply when the ActionBar should call attention, such as when floating in a TableView. Omit if the ActionBar should blend in.

```tsx
<ActionBar isEmphasized selectedItemCount={selectedKeys.size} />
```

### disabledKeys

Disable individual items:

```tsx
<ActionBar
  disabledKeys={["edit"]}
  isEmphasized
  selectedItemCount={selectedKeys.size}
/>
```

## Props

### ActionBarContainer Props

| Name       | Type        | Default | Description                                                    |
| ---------- | ----------- | ------- | -------------------------------------------------------------- |
| `children` | `ReactNode` | --      | Contents including ActionBar and associated renderable content |

Layout/spacing/positioning props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`, `id`, `UNSAFE_className`, `UNSAFE_style`

### ActionBar Props

| Name                  | Type                                                                   | Default      | Description                          |
| --------------------- | ---------------------------------------------------------------------- | ------------ | ------------------------------------ |
| `children`            | `ItemElement<object> \| ItemElement<object>[] \| ItemRenderer<object>` | --           | Item elements or render function     |
| `selectedItemCount`   | `number \| 'all'`                                                      | --           | Count of selected items (hides at 0) |
| `items`               | `Iterable<object>`                                                     | --           | Item list for dynamic rendering      |
| `disabledKeys`        | `Iterable<Key>`                                                        | --           | Keys of disabled items               |
| `isEmphasized`        | `boolean`                                                              | --           | Emphasized visual style              |
| `buttonLabelBehavior` | `'show' \| 'collapse' \| 'hide'`                                       | `'collapse'` | When to hide button text             |
| `onClearSelection`    | `() => void`                                                           | --           | Callback when clear button pressed   |
| `onAction`            | `(key: Key) => void`                                                   | --           | Callback when action button pressed  |
| `id`                  | `string`                                                               | --           | Unique identifier                    |

Layout/spacing/positioning props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`, `UNSAFE_className`, `UNSAFE_style`

### Item Props

| Name             | Type                          | Description                                |
| ---------------- | ----------------------------- | ------------------------------------------ |
| `children`       | `ReactNode`                   | Rendered content or child items            |
| `title`          | `ReactNode`                   | Title if children contain items            |
| `textValue`      | `string`                      | Text representation for typeahead          |
| `aria-label`     | `string`                      | Accessibility label                        |
| `childItems`     | `Iterable<T>`                 | Child item objects for dynamic collections |
| `hasChildItems`  | `boolean`                     | Whether item has children                  |
| `href`           | `Href`                        | Link URL                                   |
| `hrefLang`       | `string`                      | Linked URL language hint                   |
| `target`         | `HTMLAttributeAnchorTarget`   | Link target window                         |
| `rel`            | `string`                      | Relationship to linked resource            |
| `download`       | `boolean \| string`           | Download link or filename                  |
| `ping`           | `string`                      | Space-separated ping URLs                  |
| `referrerPolicy` | `HTMLAttributeReferrerPolicy` | Referrer policy for link                   |
| `routerOptions`  | `RouterOptions`               | Client-side router options                 |

## Accessibility

The contents of the ActionBar should follow the same accessibility guidelines as ActionGroup's items. A localized string for selection count and clear button `aria-label` is provided automatically.

## Internationalization

For right-to-left languages (e.g. Hebrew and Arabic), the layout of the ActionBar is automatically flipped. Content provided to all child items should be localized appropriately.
