<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Disclosure.html -->
<!-- Last fetched: 2026-04-05 -->

# Disclosure

A disclosure is a collapsible section of content composed of a heading that expands and collapses a panel. It implements the ARIA Disclosure pattern and can be used standalone or combined to create an Accordion.

**Added in:** 3.38.0

## Import

```javascript
import {
  Disclosure,
  DisclosureTitle,
  DisclosurePanel,
} from "@adobe/react-spectrum";
```

## Basic Example

```jsx
<Disclosure>
  <DisclosureTitle>System Requirements</DisclosureTitle>
  <DisclosurePanel>Details about system requirements here.</DisclosurePanel>
</Disclosure>
```

## Structure

The Disclosure component consists of two required children:

- **DisclosureTitle**: Controls expansion/collapse of the panel and acts as the header
- **DisclosurePanel**: Container for the collapsible content

## Controlled Expansion

```jsx
function ControlledExpansion() {
  let [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <>
      <Disclosure isExpanded={isExpanded} onExpandedChange={setIsExpanded}>
        <DisclosureTitle>System Requirements</DisclosureTitle>
        <DisclosurePanel>
          Details about system requirements here.
        </DisclosurePanel>
      </Disclosure>
      <div style={{ marginTop: "20px" }}>
        {isExpanded
          ? "The disclosure is expanded"
          : "The disclosure is collapsed"}
      </div>
    </>
  );
}
```

## Visual Variants

### Disabled

```jsx
<Disclosure isDisabled>
  <DisclosureTitle>System Requirements</DisclosureTitle>
  <DisclosurePanel>Details about system requirements here.</DisclosurePanel>
</Disclosure>
```

### Expanded by Default

```jsx
<Disclosure defaultExpanded>
  <DisclosureTitle>System Requirements</DisclosureTitle>
  <DisclosurePanel>Details about system requirements here.</DisclosurePanel>
</Disclosure>
```

### Quiet Style

```jsx
<Disclosure isQuiet>
  <DisclosureTitle>System Requirements</DisclosureTitle>
  <DisclosurePanel>Details about system requirements here.</DisclosurePanel>
</Disclosure>
```

## Props API

### Disclosure Props

| Name              | Type             | Default | Description                                   |
| ----------------- | ---------------- | ------- | --------------------------------------------- |
| `children`        | `ReactNode`      | --      | Contents (first child: header, second: panel) |
| `isQuiet`         | `boolean`        | --      | Display with quiet styling                    |
| `id`              | `Key`            | --      | ID for use within DisclosureGroup             |
| `isDisabled`      | `boolean`        | --      | Disable the disclosure                        |
| `isExpanded`      | `boolean`        | --      | Controlled expansion state                    |
| `defaultExpanded` | `boolean`        | --      | Default uncontrolled expansion state          |
| `slot`            | `string \| null` | --      | Slot name for parent overrides                |

### Disclosure Events

| Name               | Type                            | Description                     |
| ------------------ | ------------------------------- | ------------------------------- |
| `onExpandedChange` | `(isExpanded: boolean) => void` | Callback when expansion changes |

### Disclosure Accessibility Props

| Name               | Type     | Description          |
| ------------------ | -------- | -------------------- |
| `aria-label`       | `string` | Element label        |
| `aria-labelledby`  | `string` | Labels element       |
| `aria-describedby` | `string` | Describes element    |
| `aria-details`     | `string` | Detailed description |

### DisclosureTitle Props

| Name               | Type            | Default | Description                 |
| ------------------ | --------------- | ------- | --------------------------- |
| `children`         | `ReactNode`     | --      | Header content              |
| `level`            | `number`        | `3`     | Heading level (h1-h6)       |
| `id`               | `string`        | --      | Unique identifier           |
| `aria-label`       | `string`        | --      | Element label               |
| `aria-labelledby`  | `string`        | --      | Labels element              |
| `aria-describedby` | `string`        | --      | Describes element           |
| `aria-details`     | `string`        | --      | Detailed description        |
| `UNSAFE_className` | `string`        | --      | CSS class (last resort)     |
| `UNSAFE_style`     | `CSSProperties` | --      | Inline styles (last resort) |

### DisclosurePanel Props

| Name               | Type                  | Default   | Description                 |
| ------------------ | --------------------- | --------- | --------------------------- |
| `children`         | `ReactNode`           | --        | Panel content               |
| `labelElementType` | `ElementType`         | `'label'` | HTML element for label      |
| `label`            | `ReactNode`           | --        | Label content               |
| `role`             | `'group' \| 'region'` | `'group'` | Accessibility role          |
| `id`               | `string`              | --        | Unique identifier           |
| `aria-label`       | `string`              | --        | Element label               |
| `aria-labelledby`  | `string`              | --        | Labels element              |
| `aria-describedby` | `string`              | --        | Describes element           |
| `aria-details`     | `string`              | --        | Detailed description        |
| `UNSAFE_className` | `string`              | --        | CSS class (last resort)     |
| `UNSAFE_style`     | `CSSProperties`       | --        | Inline styles (last resort) |

### Layout/Spacing/Positioning Props (Responsive)

All standard Spectrum layout props apply: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

### Advanced Props

| Name               | Type            | Description                 |
| ------------------ | --------------- | --------------------------- |
| `UNSAFE_className` | `string`        | CSS class (last resort)     |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort) |

## Accessibility

- Follows ARIA Disclosure pattern
- DisclosureTitle supports semantic heading levels via `level` prop (default: 3)
- DisclosurePanel supports `role` attribute ('group' or 'region')
- Full ARIA attribute support
- Keyboard accessible for expand/collapse functionality

## Related Components

- **Accordion**: Combine multiple Disclosures to form an accordion pattern
