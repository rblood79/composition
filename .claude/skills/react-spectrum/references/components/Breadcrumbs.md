<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Breadcrumbs.html -->
<!-- Last fetched: 2026-04-05 -->

# Breadcrumbs

## Description

Breadcrumbs show hierarchy and navigational context for a user's location within an application.

## Installation

```bash
yarn add @adobe/react-spectrum
```

```jsx
import { Breadcrumbs, Item } from "@adobe/react-spectrum";
```

## Usage Examples

### Basic Example

```jsx
<Breadcrumbs>
  <Item key="home">Home</Item>
  <Item key="trendy">Trendy</Item>
  <Item key="march 2020 assets">March 2020 Assets</Item>
</Breadcrumbs>
```

### With onAction

```jsx
function Example() {
  let folders = [
    { id: 1, label: "Home" },
    { id: 2, label: "Trendy" },
    { id: 3, label: "March 2020 Assets" },
  ];
  let [folderId, setFolderId] = React.useState(null);
  return (
    <div>
      <Breadcrumbs onAction={(a) => setFolderId(a)}>
        {folders.map((f) => (
          <Item key={f.id}>{f.label}</Item>
        ))}
      </Breadcrumbs>
      <p>You pressed folder ID: {folderId}</p>
    </div>
  );
}
```

### Links

```jsx
<Breadcrumbs>
  <Item href="#">Home</Item>
  <Item href="#">React Spectrum</Item>
  <Item>Breadcrumbs</Item>
</Breadcrumbs>
```

### Size Variants

```jsx
<Breadcrumbs size="S">
  <Item key="home">Home</Item>
  <Item key="trendy">Trendy</Item>
</Breadcrumbs>

<Breadcrumbs size="M">
  <Item key="home">Home</Item>
  <Item key="trendy">Trendy</Item>
</Breadcrumbs>

<Breadcrumbs size="L">
  <Item key="home">Home</Item>
  <Item key="trendy">Trendy</Item>
</Breadcrumbs>
```

### Multiline

```jsx
<Breadcrumbs isMultiline>
  <Item key="home">Home</Item>
  <Item key="trendy">Trendy</Item>
  <Item key="march 2020 assets">March 2020 Assets</Item>
</Breadcrumbs>
```

### Root Context

```jsx
<View overflow="hidden" width="200px">
  <Breadcrumbs showRoot>
    <Item key="home">Home</Item>
    <Item key="trendy">Trendy</Item>
    <Item key="2020 assets">March 2020 Assets</Item>
    <Item key="winter">Winter</Item>
    <Item key="holiday">Holiday</Item>
  </Breadcrumbs>
</View>
```

### Disabled State

```jsx
<Breadcrumbs isDisabled>
  <Item key="home">Home</Item>
  <Item key="trendy">Trendy</Item>
  <Item key="march 2020 assets">March 2020 Assets</Item>
</Breadcrumbs>
```

## Props API

### Breadcrumbs

| Name               | Type                           | Default | Description                           |
| ------------------ | ------------------------------ | ------- | ------------------------------------- |
| `children`         | `ReactElement<ItemProps<T>>[]` | --      | Breadcrumb items to display           |
| `isDisabled`       | `boolean`                      | --      | Disables all breadcrumbs              |
| `size`             | `'S' \| 'M' \| 'L'`            | `'L'`   | Controls spacing and layout size      |
| `showRoot`         | `boolean`                      | --      | Always shows root item when collapsed |
| `isMultiline`      | `boolean`                      | --      | Places last item on new line          |
| `autoFocusCurrent` | `boolean`                      | --      | Auto-focuses last item on render      |
| `onAction`         | `(key: Key) => void`           | --      | Called when item is pressed           |
| `id`               | `string`                       | --      | Unique element identifier             |
| `aria-label`       | `string`                       | --      | Accessibility label                   |
| `aria-labelledby`  | `string`                       | --      | IDs of labeling elements              |
| `aria-describedby` | `string`                       | --      | IDs of describing elements            |
| `aria-details`     | `string`                       | --      | IDs providing extended description    |
| `UNSAFE_className` | `string`                       | --      | CSS class name (use as last resort)   |
| `UNSAFE_style`     | `CSSProperties`                | --      | Inline styles (use as last resort)    |

(layout props omitted)

### Item Props

| Name             | Type                          | Default | Description                                |
| ---------------- | ----------------------------- | ------- | ------------------------------------------ |
| `children`       | `ReactNode`                   | --      | Item contents                              |
| `title`          | `ReactNode`                   | --      | Title if children contain child items      |
| `textValue`      | `string`                      | --      | String representation for typeahead        |
| `aria-label`     | `string`                      | --      | Accessibility label                        |
| `childItems`     | `Iterable<T>`                 | --      | Child item objects for dynamic collections |
| `hasChildItems`  | `boolean`                     | --      | Whether item has children                  |
| `href`           | `Href`                        | --      | URL to link to                             |
| `hrefLang`       | `string`                      | --      | Language hint for linked URL               |
| `target`         | `HTMLAttributeAnchorTarget`   | --      | Target window for link                     |
| `rel`            | `string`                      | --      | Relationship to linked resource            |
| `download`       | `boolean \| string`           | --      | Downloads linked URL                       |
| `ping`           | `string`                      | --      | URLs to ping when followed                 |
| `referrerPolicy` | `HTMLAttributeReferrerPolicy` | --      | Referrer policy                            |
| `routerOptions`  | `RouterOptions`               | --      | Client-side router options                 |

## Overflow Behavior

Breadcrumbs collapses items into a menu when space is limited, showing a maximum of 4 visible items including root and menu button. The last item truncates with ellipsis rather than collapsing into the menu.

## Accessibility

- Supports standard ARIA attributes (`aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details`)
- Items support `href` attribute for semantic link navigation
- Works with client-side routers for proper navigation semantics
- Keyboard navigation supported through standard breadcrumb interaction patterns
