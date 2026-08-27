<!-- Source: https://react-spectrum.adobe.com/react-spectrum/InlineAlert.html -->
<!-- Last fetched: 2026-04-05 -->

# InlineAlert

Inline alerts display a non-modal message associated with objects in a view. These are often used in form validation, providing a place to aggregate feedback related to multiple fields.

**Added in:** 3.29.0

## Import

```javascript
import { InlineAlert } from "@adobe/react-spectrum";
```

## Basic Usage

```jsx
<InlineAlert>
  <Heading>Payment Information</Heading>
  <Content>
    Enter your billing address, shipping address, and payment method to complete
    your purchase.
  </Content>
</InlineAlert>
```

## Visual Variants

### Neutral (default)

```jsx
<InlineAlert variant="neutral">
  <Heading>Payment Information</Heading>
  <Content>Enter your billing and payment info.</Content>
</InlineAlert>
```

### Info

```jsx
<InlineAlert variant="info">
  <Heading>Accepted Payment Methods</Heading>
  <Content>Only major credit cards are accepted for payment.</Content>
</InlineAlert>
```

### Positive

```jsx
<InlineAlert variant="positive">
  <Heading>Purchase completed</Heading>
  <Content>
    You'll get a confirmation email with your order details shortly.
  </Content>
</InlineAlert>
```

### Notice

```jsx
<InlineAlert variant="notice">
  <Heading>Update payment information</Heading>
  <Content>
    The saved credit card has expired. Update your payment information.
  </Content>
</InlineAlert>
```

### Negative

```jsx
<InlineAlert variant="negative">
  <Heading>Unable to process payment</Heading>
  <Content>
    There was an error processing your payment. Please verify your information.
  </Content>
</InlineAlert>
```

## Props API

### Core Props

| Name        | Type                                                          | Default     | Description                       |
| ----------- | ------------------------------------------------------------- | ----------- | --------------------------------- |
| `children`  | `ReactNode`                                                   | --          | Contents of the InlineAlert       |
| `variant`   | `'neutral' \| 'info' \| 'positive' \| 'notice' \| 'negative'` | `'neutral'` | Visual style of the component     |
| `autoFocus` | `boolean`                                                     | --          | Auto-focus when component renders |
| `id`        | `string`                                                      | --          | Element's unique identifier       |

### Layout/Spacing/Sizing/Positioning Props (Responsive)

All standard Spectrum layout props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

### Advanced Props

| Name               | Type            | Description                  |
| ------------------ | --------------- | ---------------------------- |
| `UNSAFE_className` | `string`        | CSS class name (last resort) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort)  |

## Accessibility

The component receives the `alert` role, which means it should only be used for information that requires the user's immediate attention.

## Internationalization

Localize alert text through the `Heading` and `Content` children. The component automatically flips for right-to-left languages like Hebrew and Arabic.
