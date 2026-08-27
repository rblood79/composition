<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Meter.html -->
<!-- Last fetched: 2026-04-05 -->

# Meter

Meters are visual representations of a quantity or an achievement. Their progress is determined by user actions, rather than system actions.

## Import

```javascript
import { Meter } from "@adobe/react-spectrum";
```

## Basic Usage

```jsx
<Meter label="Storage space" value={35} />
```

## Custom Scale

```jsx
<Meter label="Widgets Used" minValue={50} maxValue={150} value={100} />
```

## Custom Value Formatting

```jsx
<Meter
  label="Currency"
  formatOptions={{ style: "currency", currency: "JPY" }}
  value={60}
/>
```

## Label Positioning

```jsx
<Meter label="Label" value={25} variant="warning" />
<Meter label="Label" labelPosition="side" value={25} variant="warning" />
<Meter label="Label" showValueLabel={false} value={25} variant="warning" />
```

## Custom Value Labels

```jsx
<Meter label="Progress" value={25} valueLabel="1 of 4" variant="warning" />
```

## Size Variants

```jsx
<Meter label="Space used" size="S" value={90} variant="critical" />
<Meter label="Space used" size="L" value={90} variant="critical" />
```

## Visual Variants

```jsx
<Meter label="Space used" value={25} variant="informative" />
<Meter label="Space used" value={25} variant="positive" />
<Meter label="Space used" value={90} variant="critical" />
<Meter label="Space used" value={70} variant="warning" />
```

## Props API

### Core Props

| Name       | Type                                                     | Default         | Description                |
| ---------- | -------------------------------------------------------- | --------------- | -------------------------- |
| `value`    | `number`                                                 | `0`             | Current value (controlled) |
| `minValue` | `number`                                                 | `0`             | Smallest allowed value     |
| `maxValue` | `number`                                                 | `100`           | Largest allowed value      |
| `variant`  | `'informative' \| 'positive' \| 'warning' \| 'critical'` | `'informative'` | Visual style of the Meter  |
| `size`     | `'S' \| 'L'`                                             | `'L'`           | Bar thickness              |

### Labeling Props

| Name             | Type                       | Default              | Description                                                     |
| ---------------- | -------------------------- | -------------------- | --------------------------------------------------------------- |
| `label`          | `ReactNode`                | --                   | Label text content                                              |
| `labelPosition`  | `'top' \| 'side'`          | `'top'`              | Label position relative to element                              |
| `showValueLabel` | `boolean`                  | --                   | Display value label (true by default with label, false without) |
| `valueLabel`     | `ReactNode`                | --                   | Custom value label text (e.g., "1 of 4")                        |
| `formatOptions`  | `Intl.NumberFormatOptions` | `{style: 'percent'}` | Value label display format                                      |

### Accessibility Props

| Name               | Type     | Description                |
| ------------------ | -------- | -------------------------- |
| `id`               | `string` | Unique identifier          |
| `aria-label`       | `string` | Element label definition   |
| `aria-labelledby`  | `string` | ID of labeling element     |
| `aria-describedby` | `string` | ID of describing element   |
| `aria-details`     | `string` | ID of detailed description |

### Layout/Spacing/Sizing/Positioning Props (Responsive)

All standard Spectrum layout props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

### Advanced Props

| Name               | Type            | Description                      |
| ------------------ | --------------- | -------------------------------- |
| `UNSAFE_className` | `string`        | CSS class (last resort only)     |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort only) |

## Accessibility

A `label`, `aria-label`, or `aria-labelledby` prop is required depending on the visualization approach (particularly when `showValueLabel` is hidden).

## Internationalization

The component automatically flips layout for right-to-left languages and uses the current locale for value label formatting.
