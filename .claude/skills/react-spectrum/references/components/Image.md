<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Image.html -->
<!-- Last fetched: 2026-04-05 -->

# Image

Image component for inserting and displaying images within React Spectrum containers such as Dialogs. Provides semantic HTML image rendering with Spectrum layout support.

**Important:** All images must include an `alt` attribute. Use `alt=""` for decorative images.

```tsx
import { Image } from "@adobe/react-spectrum";
```

## Usage Examples

### Basic

```jsx
<Image src="https://i.imgur.com/Z7AzH2c.png" alt="Sky and roof" />
```

### Decorative Image

```jsx
<Flex width="200px">
  <Image src="https://i.imgur.com/c3gTKSJ.jpg" alt="" />
</Flex>
```

### With Object Fit

```jsx
<Flex width="100%" height="200px">
  <Image
    src="https://i.imgur.com/c3gTKSJ.jpg"
    alt="Eiffel Tower at sunset"
    objectFit="cover"
  />
</Flex>
```

## Props API

### Core Props

| Name          | Type                               | Default   | Description                   |
| ------------- | ---------------------------------- | --------- | ----------------------------- |
| `src`         | `string`                           | --        | The URL of the image          |
| `alt`         | `string`                           | --        | Text description of the image |
| `objectFit`   | `any`                              | --        | Sets the CSS object-fit style |
| `crossOrigin` | `'anonymous' \| 'use-credentials'` | --        | CORS request configuration    |
| `slot`        | `string`                           | `'image'` | Slot for image placement      |

### Layout Props (abbreviated)

`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd` -- all `Responsive<>` typed.

### Spacing Props (abbreviated)

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY` -- all `Responsive<DimensionValue>`.

### Sizing Props (abbreviated)

`width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight` -- all `Responsive<DimensionValue>`.

### Positioning Props (abbreviated)

`position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden` -- all `Responsive<>` typed.

### Accessibility Props

| Name | Type     | Description               |
| ---- | -------- | ------------------------- |
| `id` | `string` | Unique element identifier |

### Advanced Props

| Name               | Type            | Description                 |
| ------------------ | --------------- | --------------------------- |
| `UNSAFE_className` | `string`        | CSS className (last resort) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort) |

## Events

| Name      | Type                                  | Description                          |
| --------- | ------------------------------------- | ------------------------------------ |
| `onLoad`  | `ReactEventHandler<HTMLImageElement>` | Fires when image loads successfully  |
| `onError` | `ReactEventHandler<HTMLImageElement>` | Fires if error occurs during loading |

## Accessibility

- All images must include `alt` attribute
- Use `alt=""` for decorative images to suppress screen reader announcements
- Localize `alt` prop for internationalization
