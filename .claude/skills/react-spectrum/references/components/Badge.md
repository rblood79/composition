<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Badge.html -->
<!-- Last fetched: 2026-04-05 -->

# Badge

## Description

The Badge component displays a compact, color-categorized metadata element designed to capture user attention. It's ideal for showing status, categories, or semantic information in a visually concise manner.

**Version:** Added in 3.22.0

## Installation

```bash
yarn add @adobe/react-spectrum
```

```jsx
import { Badge } from "@adobe/react-spectrum";
```

## Usage Examples

### Basic Badge

```jsx
<Badge variant="positive">Licensed</Badge>
```

### Badge with Icon and Label

```jsx
import { Text } from "@adobe/react-spectrum";
import CheckmarkCircle from "@spectrum-icons/workflow/CheckmarkCircle";

<Badge variant="positive">
  <CheckmarkCircle aria-label="Done" />
  <Text>Icon + Label</Text>
</Badge>;
```

### Semantic Variants

```jsx
<Flex direction="column" gap={8}>
  <Badge variant="positive">Approved, Complete, Success</Badge>
  <Badge variant="info">Active, In Use, Live, Published</Badge>
  <Badge variant="negative">Error, Alert, Rejected, Failed</Badge>
  <Badge variant="neutral">Archived, Deleted, Paused, Draft</Badge>
</Flex>
```

### Color-Coded Categories

```jsx
<Flex direction="column" gap={8}>
  <Badge variant="seafoam">Seafoam</Badge>
  <Badge variant="indigo">Indigo</Badge>
  <Badge variant="purple">Purple</Badge>
  <Badge variant="fuchsia">Fuchsia</Badge>
  <Badge variant="magenta">Magenta</Badge>
  <Badge variant="yellow">Yellow</Badge>
</Flex>
```

## Props API

| Name               | Type                                                                                                                         | Default     | Description                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------- |
| `children`         | `ReactNode`                                                                                                                  | --          | The content to display in the badge (text, icon, or both)           |
| `variant`          | `'neutral' \| 'info' \| 'positive' \| 'negative' \| 'indigo' \| 'yellow' \| 'magenta' \| 'fuchsia' \| 'purple' \| 'seafoam'` | `'neutral'` | Changes background color; use semantic variants for status meanings |
| `id`               | `string`                                                                                                                     | --          | Unique element identifier                                           |
| `aria-label`       | `string`                                                                                                                     | --          | Text label for the element                                          |
| `aria-labelledby`  | `string`                                                                                                                     | --          | ID of labeling element(s)                                           |
| `aria-describedby` | `string`                                                                                                                     | --          | ID of describing element(s)                                         |
| `aria-details`     | `string`                                                                                                                     | --          | ID of detailed description element(s)                               |
| `UNSAFE_className` | `string`                                                                                                                     | --          | Direct CSS class name (use as last resort)                          |
| `UNSAFE_style`     | `CSSProperties`                                                                                                              | --          | Inline styles (use as last resort)                                  |

(layout props omitted)

## Accessibility

- **Icon-only badges:** When using only an icon without visible text, provide an `aria-label` attribute to the icon for screen reader users.
- **Icons with labels:** Labels are directly visible alongside icons for clarity.

## Internationalization

The component automatically supports right-to-left (RTL) languages by flipping the badge layout. Simply pass localized text as children.
