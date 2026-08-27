<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Accordion.html -->
<!-- Last fetched: 2026-04-05 -->

# Accordion

## Description

The Accordion component displays a group of disclosures that can be expanded and collapsed. It allows users to organize content in expandable sections with controlled or uncontrolled expansion states.

**Version:** Added in 3.38.0

## Installation

```bash
yarn add @adobe/react-spectrum
```

```typescript
import {
  Accordion,
  Disclosure,
  DisclosureTitle,
  DisclosurePanel,
} from "@adobe/react-spectrum";
```

## Usage Examples

### Basic Accordion

```jsx
<Accordion defaultExpandedKeys={["personal"]}>
  <Disclosure id="personal">
    <DisclosureTitle>Personal Information</DisclosureTitle>
    <DisclosurePanel>Personal information form here.</DisclosurePanel>
  </Disclosure>
  <Disclosure id="billing">
    <DisclosureTitle>Billing Address</DisclosureTitle>
    <DisclosurePanel>Billing address form here.</DisclosurePanel>
  </Disclosure>
</Accordion>
```

### Controlled Expansion

```jsx
import { Key } from "@react-types/shared";

function ControlledExpansion() {
  let [expandedKeys, setExpandedKeys] =
    React.useState < Set < Key >> new Set(["personal"]);

  return (
    <>
      <Accordion expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys}>
        <Disclosure id="personal">
          <DisclosureTitle>Personal Information</DisclosureTitle>
          <DisclosurePanel>Personal information form here.</DisclosurePanel>
        </Disclosure>
        <Disclosure id="billing">
          <DisclosureTitle>Billing Address</DisclosureTitle>
          <DisclosurePanel>Billing address form here.</DisclosurePanel>
        </Disclosure>
      </Accordion>
      <div style={{ marginTop: "20px" }}>You have expanded: {expandedKeys}</div>
    </>
  );
}
```

### Multiple Expanded Items

```jsx
<Accordion allowsMultipleExpanded defaultExpandedKeys={["personal", "billing"]}>
  <Disclosure id="personal">
    <DisclosureTitle>Personal Information</DisclosureTitle>
    <DisclosurePanel>Personal information form here.</DisclosurePanel>
  </Disclosure>
  <Disclosure id="billing">
    <DisclosureTitle>Billing Address</DisclosureTitle>
    <DisclosurePanel>Billing address form here.</DisclosurePanel>
  </Disclosure>
</Accordion>
```

### Quiet Style

```jsx
<Accordion isQuiet>
  <Disclosure id="personal">
    <DisclosureTitle>Personal Information</DisclosureTitle>
    <DisclosurePanel>Personal information form here.</DisclosurePanel>
  </Disclosure>
</Accordion>
```

### Disabled State

```jsx
<Accordion isDisabled>
  <Disclosure id="personal">
    <DisclosureTitle>Personal Information</DisclosureTitle>
    <DisclosurePanel>Personal information form here.</DisclosurePanel>
  </Disclosure>
</Accordion>
```

## Props API

### Accordion

| Name                     | Type                      | Default | Description                                       |
| ------------------------ | ------------------------- | ------- | ------------------------------------------------- |
| `children`               | `React.ReactNode`         | --      | The disclosures within the accordion group        |
| `isQuiet`                | `boolean`                 | --      | Whether the Accordion displays with a quiet style |
| `allowsMultipleExpanded` | `boolean`                 | --      | Whether multiple items can expand simultaneously  |
| `isDisabled`             | `boolean`                 | --      | Whether all items are disabled                    |
| `expandedKeys`           | `Iterable<Key>`           | --      | Currently expanded keys (controlled)              |
| `defaultExpandedKeys`    | `Iterable<Key>`           | --      | Initial expanded keys (uncontrolled)              |
| `onExpandedChange`       | `(keys: Set<Key>) => any` | --      | Handler called when items expand or collapse      |
| `id`                     | `string`                  | --      | Unique identifier                                 |
| `UNSAFE_className`       | `string`                  | --      | Custom CSS class (last resort)                    |
| `UNSAFE_style`           | `CSSProperties`           | --      | Inline styles (last resort)                       |

(layout props omitted)

### Disclosure

| Name               | Type                            | Default | Description                                      |
| ------------------ | ------------------------------- | ------- | ------------------------------------------------ |
| `children`         | `React.ReactNode`               | --      | Disclosure contents (header first, panel second) |
| `isQuiet`          | `boolean`                       | --      | Display with quiet style                         |
| `id`               | `Key`                           | --      | Identifier matching `expandedKeys`               |
| `isDisabled`       | `boolean`                       | --      | Whether disclosure is disabled                   |
| `isExpanded`       | `boolean`                       | --      | Expansion state (controlled)                     |
| `defaultExpanded`  | `boolean`                       | --      | Initial expansion state (uncontrolled)           |
| `onExpandedChange` | `(isExpanded: boolean) => void` | --      | Handler for expansion state changes              |
| `slot`             | `string \| null`                | --      | Slot name for component composition              |
| `aria-label`       | `string`                        | --      | Element label                                    |
| `aria-labelledby`  | `string`                        | --      | Labeling element reference                       |
| `aria-describedby` | `string`                        | --      | Describing element reference                     |
| `aria-details`     | `string`                        | --      | Details element reference                        |
| `UNSAFE_className` | `string`                        | --      | Custom CSS class                                 |
| `UNSAFE_style`     | `CSSProperties`                 | --      | Inline styles                                    |

(layout props omitted)

### DisclosureTitle

| Name               | Type              | Default | Description                  |
| ------------------ | ----------------- | ------- | ---------------------------- |
| `children`         | `React.ReactNode` | --      | Disclosure header contents   |
| `level`            | `number`          | `3`     | Heading level (h1-h6)        |
| `id`               | `string`          | --      | Unique identifier            |
| `aria-label`       | `string`          | --      | Element label                |
| `aria-labelledby`  | `string`          | --      | Labeling element reference   |
| `aria-describedby` | `string`          | --      | Describing element reference |
| `aria-details`     | `string`          | --      | Details element reference    |
| `UNSAFE_className` | `string`          | --      | Custom CSS class             |
| `UNSAFE_style`     | `CSSProperties`   | --      | Inline styles                |

(layout props omitted)

### DisclosurePanel

| Name               | Type                  | Default   | Description                  |
| ------------------ | --------------------- | --------- | ---------------------------- |
| `children`         | `React.ReactNode`     | --        | Panel contents               |
| `labelElementType` | `ElementType`         | `'label'` | HTML element for label       |
| `label`            | `ReactNode`           | --        | Label content                |
| `role`             | `'group' \| 'region'` | `'group'` | Accessibility role           |
| `id`               | `string`              | --        | Unique identifier            |
| `aria-label`       | `string`              | --        | Element label                |
| `aria-labelledby`  | `string`              | --        | Labeling element reference   |
| `aria-describedby` | `string`              | --        | Describing element reference |
| `aria-details`     | `string`              | --        | Details element reference    |
| `UNSAFE_className` | `string`              | --        | Custom CSS class             |
| `UNSAFE_style`     | `CSSProperties`       | --        | Inline styles                |

(layout props omitted)

## Events

- **`onExpandedChange`**: Triggered when a disclosure expands or collapses, receiving a `Set<Key>` of expanded keys.

## Accessibility

- Components support standard ARIA attributes (`aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details`).
- DisclosurePanel has configurable `role` property (defaults to `'group'`; use `'region'` when appropriate).
- DisclosureTitle supports customizable heading levels via `level` prop.
- All text content should be localized for internationalization support.
