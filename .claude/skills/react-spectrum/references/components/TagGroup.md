<!-- Source: https://react-spectrum.adobe.com/react-spectrum/TagGroup.html -->
<!-- Last fetched: 2026-04-05 -->

# TagGroup

Tags allow users to categorize content. They can represent keywords or people, and are grouped to describe an item or a search request.

**Added in:** 3.27.0

```tsx
import { TagGroup, Item } from "@adobe/react-spectrum";
```

## Usage Examples

### Static Collection

```jsx
<TagGroup aria-label="Static TagGroup items example">
  <Item>News</Item>
  <Item>Travel</Item>
  <Item>Gaming</Item>
  <Item>Shopping</Item>
</TagGroup>
```

### Dynamic Collection

```jsx
const items = [
  { id: 1, name: "News" },
  { id: 2, name: "Travel" },
  { id: 3, name: "Gaming" },
  { id: 4, name: "Shopping" },
];

<TagGroup items={items} aria-label="Dynamic TagGroup items example">
  {(item) => <Item>{item.name}</Item>}
</TagGroup>;
```

### Removable Tags

```jsx
function Example() {
  let defaultItems = [
    { id: 1, name: "News" },
    { id: 2, name: "Travel" },
    { id: 3, name: "Gaming" },
    { id: 4, name: "Shopping" },
  ];
  let [items, setItems] = React.useState(defaultItems);

  let onRemove = (keys) => {
    setItems((prevItems) => prevItems.filter((item) => !keys.has(item.id)));
  };

  return (
    <TagGroup
      items={items}
      onRemove={onRemove}
      aria-label="Removable TagGroup example"
    >
      {(item) => <Item>{item.name}</Item>}
    </TagGroup>
  );
}
```

### With Action Button

```jsx
<TagGroup
  actionLabel="Clear"
  onAction={() => alert("Clear action pressed.")}
  aria-label="TagGroup with action"
>
  <Item>News</Item>
  <Item>Travel</Item>
</TagGroup>
```

### With Icons / Avatars

```jsx
<TagGroup aria-label="TagGroup with icons example">
  <Item textValue="News">
    <News />
    <Text>News</Text>
  </Item>
  <Item textValue="Travel">
    <Airplane />
    <Text>Travel</Text>
  </Item>
</TagGroup>
```

### Links

```jsx
<TagGroup label="Links">
  <Item href="https://adobe.com/" target="_blank">
    Adobe
  </Item>
  <Item href="https://apple.com/" target="_blank">
    Apple
  </Item>
</TagGroup>
```

### Help Text

```jsx
<TagGroup
  label="Categories"
  description="Please include tags for related categories."
  errorMessage="Must contain no more than 3 tags."
  isInvalid={!isValid}
>
  {(item) => <Item>{item.name}</Item>}
</TagGroup>
```

### Limit Rows

```jsx
<TagGroup maxRows={2} aria-label="TagGroup with row limit">
  <Item>News</Item>
  <Item>Travel</Item>
  <Item>Gaming</Item>
</TagGroup>
```

### Empty State

```jsx
<TagGroup
  label="Categories"
  renderEmptyState={() => (
    <span>
      No categories.{" "}
      <Link>
        <a href="#">Click here</a>
      </Link>{" "}
      to add some.
    </span>
  )}
/>
```

## Props API

| Name                    | Type                         | Default            | Description                 |
| ----------------------- | ---------------------------- | ------------------ | --------------------------- |
| `children`              | `CollectionChildren<T>`      | --                 | Collection contents         |
| `items`                 | `Iterable<T>`                | --                 | Item objects in collection  |
| `label`                 | `ReactNode`                  | --                 | Visual label text           |
| `description`           | `ReactNode`                  | --                 | Field hint/description      |
| `errorMessage`          | `ReactNode`                  | --                 | Error message for field     |
| `isInvalid`             | `boolean`                    | --                 | Marks input as invalid      |
| `labelPosition`         | `'top' \| 'side'`            | `'top'`            | Label placement             |
| `labelAlign`            | `'start' \| 'end'`           | `'start'`          | Label horizontal alignment  |
| `contextualHelp`        | `ReactNode`                  | --                 | ContextualHelp element      |
| `actionLabel`           | `string`                     | --                 | Action button label         |
| `onAction`              | `() => void`                 | --                 | Action button handler       |
| `onRemove`              | `(keys: Set<Key>) => void`   | --                 | Tag deletion handler        |
| `renderEmptyState`      | `() => JSX.Element`          | --                 | Empty state renderer        |
| `maxRows`               | `number`                     | --                 | Initial row limit           |
| `shouldSelectOnPressUp` | `boolean`                    | --                 | Select on press-up behavior |
| `escapeKeyBehavior`     | `'clearSelection' \| 'none'` | `'clearSelection'` | Escape key handling         |

### Accessibility Props

| Name               | Type     | Description                |
| ------------------ | -------- | -------------------------- |
| `id`               | `string` | Unique element identifier  |
| `aria-label`       | `string` | Accessibility label        |
| `aria-labelledby`  | `string` | ID of labeling element     |
| `aria-describedby` | `string` | ID of describing element   |
| `aria-details`     | `string` | ID of detailed description |

### Item Props

| Name             | Type                          | Description                       |
| ---------------- | ----------------------------- | --------------------------------- |
| `children`       | `ReactNode`                   | Item content                      |
| `title`          | `ReactNode`                   | Title if children contain items   |
| `textValue`      | `string`                      | Text representation for typeahead |
| `aria-label`     | `string`                      | Accessibility label               |
| `href`           | `Href`                        | Link URL                          |
| `hrefLang`       | `string`                      | Linked URL language hint          |
| `target`         | `HTMLAttributeAnchorTarget`   | Link target window                |
| `rel`            | `string`                      | Link relationship                 |
| `download`       | `boolean \| string`           | Download attribute                |
| `ping`           | `string`                      | URLs to ping                      |
| `referrerPolicy` | `HTMLAttributeReferrerPolicy` | Referrer policy                   |
| `routerOptions`  | `RouterOptions`               | Client router options             |
| `childItems`     | `Iterable<T>`                 | Child items (dynamic)             |
| `hasChildItems`  | `boolean`                     | Has children indicator            |

### Layout/Spacing/Sizing/Positioning Props (abbreviated)

Standard Responsive layout props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, etc. Standard spacing: `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`. Standard sizing: `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`. Standard positioning: `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`.

### Advanced Props

| Name               | Type            | Description                 |
| ------------------ | --------------- | --------------------------- |
| `UNSAFE_className` | `string`        | CSS class (last resort)     |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort) |

## Events

| Name       | Type                       | Description           |
| ---------- | -------------------------- | --------------------- |
| `onRemove` | `(keys: Set<Key>) => void` | Tag deletion handler  |
| `onAction` | `() => void`               | Action button handler |

## Accessibility

- Provide `aria-label` or `label` prop for labeling
- Keyboard navigation with escape key handling
- RTL layout automatic
