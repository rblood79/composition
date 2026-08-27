<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Link.html -->
<!-- Last fetched: 2026-04-05 -->

# Link

Links allow users to navigate to a different location. They can be presented inline inside a paragraph or as standalone text.

## Import

```javascript
import { Link } from "@adobe/react-spectrum";
```

## Basic Usage

### Link with href

```jsx
<Link href="https://www.imdb.com/title/tt6348138/" target="_blank">
  The missing link.
</Link>
```

### JavaScript-Handled Link

When no `href` prop is provided, the component renders as a styled `<span>` with link semantics:

```jsx
<Link onPress={() => alert("Pressed link")}>Adobe</Link>
```

**Note:** JavaScript-handled links lack native browser features like context menus and "open in new tab."

## Visual Variants

### Primary (default)

```jsx
<p>
  Would you like to <Link variant="primary">learn more</Link> about this?
</p>
```

### Secondary

```jsx
<p>
  Would you like to <Link variant="secondary">learn more</Link> about this?
</p>
```

### Over Background

```jsx
<View backgroundColor="positive" padding="size-300">
  <Link variant="overBackground">Learn more here!</Link>
</View>
```

### Quiet

```jsx
<p>
  Would you like to <Link isQuiet>learn more</Link> about this?
</p>
```

## Props API

### Core Props

| Name             | Type                                           | Default     | Description                                           |
| ---------------- | ---------------------------------------------- | ----------- | ----------------------------------------------------- |
| `children`       | `ReactNode`                                    | --          | Content to display in the link                        |
| `variant`        | `'primary' \| 'secondary' \| 'overBackground'` | `'primary'` | Visual style of the link                              |
| `isQuiet`        | `boolean`                                      | --          | Display with quiet (underline-less) style             |
| `autoFocus`      | `boolean`                                      | --          | Element receives focus on render                      |
| `href`           | `Href`                                         | --          | URL to link to                                        |
| `hrefLang`       | `string`                                       | --          | Hints at human language of linked URL                 |
| `target`         | `HTMLAttributeAnchorTarget`                    | --          | Target window for the link                            |
| `rel`            | `string`                                       | --          | Relationship between linked resource and current page |
| `download`       | `boolean \| string`                            | --          | Causes browser to download linked URL                 |
| `ping`           | `string`                                       | --          | Space-separated list of URLs to ping                  |
| `referrerPolicy` | `HTMLAttributeReferrerPolicy`                  | --          | How much referrer info to send                        |
| `routerOptions`  | `RouterOptions`                                | --          | Options for client-side router                        |

### Events

| Name            | Type                           | Description                |
| --------------- | ------------------------------ | -------------------------- |
| `onPress`       | `(e: PressEvent) => void`      | Press released over target |
| `onPressStart`  | `(e: PressEvent) => void`      | Press interaction starts   |
| `onPressEnd`    | `(e: PressEvent) => void`      | Press interaction ends     |
| `onPressChange` | `(isPressed: boolean) => void` | Press state changes        |
| `onPressUp`     | `(e: PressEvent) => void`      | Press releases over target |
| `onFocus`       | `(e: FocusEvent) => void`      | Element receives focus     |
| `onBlur`        | `(e: FocusEvent) => void`      | Element loses focus        |
| `onFocusChange` | `(isFocused: boolean) => void` | Focus status changes       |
| `onKeyDown`     | `(e: KeyboardEvent) => void`   | Key is pressed             |
| `onKeyUp`       | `(e: KeyboardEvent) => void`   | Key is released            |

### Accessibility Props

| Name               | Type     | Description                                |
| ------------------ | -------- | ------------------------------------------ |
| `aria-label`       | `string` | Labels the current element                 |
| `aria-labelledby`  | `string` | Identifies labeling element(s)             |
| `aria-describedby` | `string` | Identifies describing element(s)           |
| `aria-details`     | `string` | Identifies detailed description element(s) |

### Layout/Spacing/Sizing/Positioning Props (Responsive)

All standard Spectrum layout props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

### Advanced Props

| Name               | Type            | Description                             |
| ------------------ | --------------- | --------------------------------------- |
| `UNSAFE_className` | `string`        | Sets CSS className (use as last resort) |
| `UNSAFE_style`     | `CSSProperties` | Sets inline style (use as last resort)  |

## Accessibility

- When `href` is omitted, the component exposes the "link" role to assistive technology
- Provide sufficient context about link destinations for screen reader users
- Use quiet style only when placement and context are explicit enough that underlines are unnecessary
- Avoid quiet style within body paragraphs of text
