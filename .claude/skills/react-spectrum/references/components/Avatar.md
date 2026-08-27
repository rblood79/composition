<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Avatar.html -->
<!-- Last fetched: 2026-04-05 -->

# Avatar

## Description

An avatar is a thumbnail representation of an entity, such as a user or an organization.

**Version:** Added in 3.26.0

## Installation

```bash
yarn add @adobe/react-spectrum
```

```javascript
import { Avatar } from "@adobe/react-spectrum";
```

## Usage Examples

### Basic Usage

```jsx
<Avatar src="https://i.imgur.com/kJOwAdv.png" alt="default Adobe avatar" />
```

### Disabled State

```jsx
<Avatar
  src="https://i.imgur.com/kJOwAdv.png"
  alt="default Adobe avatar"
  isDisabled
/>
```

### Size Variants

Avatars support predefined sizes (50, 75, 100, 200, 300, 400, 500, 600, 700) or custom pixel values:

```jsx
<Flex gap="size-100" wrap>
  {[50, 75, 100, 200, 300, 400, 500, 600, 700].map((size) => (
    <Avatar
      key={size}
      src="https://i.imgur.com/kJOwAdv.png"
      alt="default Adobe avatar"
      size={`avatar-size-${size}`}
    />
  ))}
  <Avatar
    src="https://i.imgur.com/kJOwAdv.png"
    alt="avatar with custom size"
    size={50}
  />
</Flex>
```

## Props API

| Name               | Type                                                                                                                                                                                                          | Default             | Description                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------- |
| `src`              | `string`                                                                                                                                                                                                      | --                  | The image URL for the avatar                  |
| `alt`              | `string`                                                                                                                                                                                                      | `null`              | Text description of the avatar                |
| `isDisabled`       | `boolean`                                                                                                                                                                                                     | --                  | Whether the avatar is disabled                |
| `size`             | `'avatar-size-50' \| 'avatar-size-75' \| 'avatar-size-100' \| 'avatar-size-200' \| 'avatar-size-300' \| 'avatar-size-400' \| 'avatar-size-500' \| 'avatar-size-600' \| 'avatar-size-700' \| string \| number` | `'avatar-size-100'` | Size of the avatar affecting height and width |
| `id`               | `string`                                                                                                                                                                                                      | --                  | Unique element identifier                     |
| `UNSAFE_className` | `string`                                                                                                                                                                                                      | --                  | CSS class name (last resort only)             |
| `UNSAFE_style`     | `CSSProperties`                                                                                                                                                                                               | --                  | Inline styles (last resort only)              |

(layout props omitted)

## Accessibility

By default, avatars are decorative with an empty `alt` attribute. Standalone avatars with no surrounding context must have a custom `alt` prop defined for accessibility.

## Internationalization

To support multiple languages, provide a localized string to the `alt` prop for accessible descriptions.
