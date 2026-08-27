<!-- Source: https://react-spectrum.adobe.com/react-spectrum/StatusLight.html -->
<!-- Last fetched: 2026-04-05 -->

# StatusLight

Status lights are used to color code categories and labels commonly found in data visualization. When status lights have a semantic meaning, they should use semantic variant colors.

```jsx
import { StatusLight } from "@adobe/react-spectrum";

<StatusLight variant="positive">Ready</StatusLight>;
```

## Content

A visible label is provided through children content. The `variant` prop indicates the status type.

```jsx
<StatusLight variant="positive">Semantic color</StatusLight>
<StatusLight variant="yellow">Label color</StatusLight>
```

## Semantic Variants

```jsx
<StatusLight variant="neutral">Gray: Archived, Deleted, Paused, Draft, Not Started, Ended</StatusLight>
<StatusLight variant="positive">Green: Approved, Complete, Success, New, Purchased, Licensed</StatusLight>
<StatusLight variant="notice">Orange: Needs Approval, Pending, Scheduled, Syncing, Indexing, Processing</StatusLight>
<StatusLight variant="negative">Red: Error, Alert, Rejected, Failed</StatusLight>
<StatusLight variant="info">Blue: Active, In Use, Live, Published</StatusLight>
```

## Label Color Variants

Use for color-coding 8 or fewer categories in recommended order:

```jsx
<StatusLight variant="indigo">Indigo</StatusLight>
<StatusLight variant="celery">Celery</StatusLight>
<StatusLight variant="magenta">Magenta</StatusLight>
<StatusLight variant="yellow">Yellow</StatusLight>
<StatusLight variant="fuchsia">Fuchsia</StatusLight>
<StatusLight variant="seafoam">Seafoam</StatusLight>
<StatusLight variant="chartreuse">Chartreuse</StatusLight>
<StatusLight variant="purple">Purple</StatusLight>
```

## Disabled

```jsx
<StatusLight variant="yellow" isDisabled>
  Yellow
</StatusLight>
```

## Props

| Name               | Type                                                                                                                                                                 | Default | Description                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| `variant`          | `'positive' \| 'negative' \| 'notice' \| 'info' \| 'neutral' \| 'celery' \| 'chartreuse' \| 'yellow' \| 'magenta' \| 'fuchsia' \| 'purple' \| 'indigo' \| 'seafoam'` | --      | Changes the color; use semantic colors for meaningful status.              |
| `children`         | `ReactNode`                                                                                                                                                          | --      | Label content.                                                             |
| `isDisabled`       | `boolean`                                                                                                                                                            | --      | Disables the component visually.                                           |
| `role`             | `'status'`                                                                                                                                                           | --      | Use when status changes at runtime for assistive technology announcements. |
| `id`               | `string`                                                                                                                                                             | --      | Unique identifier.                                                         |
| `aria-label`       | `string`                                                                                                                                                             | --      | Label definition.                                                          |
| `aria-labelledby`  | `string`                                                                                                                                                             | --      | References labeling element ID.                                            |
| `aria-describedby` | `string`                                                                                                                                                             | --      | References describing element.                                             |
| `aria-details`     | `string`                                                                                                                                                             | --      | References detailed description.                                           |
| `UNSAFE_className` | `string`                                                                                                                                                             | --      | Direct CSS className (last resort).                                        |
| `UNSAFE_style`     | `CSSProperties`                                                                                                                                                      | --      | Inline styles (last resort).                                               |

### Layout/Spacing/Sizing/Positioning Props (all Responsive)

Layout: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`

Spacing: `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`

Sizing: `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`

Positioning: `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

## Accessibility

If no visible label exists, provide `aria-label` for accessibility. Use `aria-labelledby` when labeled by a separate element. Add `role="status"` when status changes at runtime for assistive technology announcements.

## Internationalization

Localized strings are set as children content. The component automatically flips for right-to-left languages.
