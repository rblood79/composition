<!-- Source: https://react-spectrum.adobe.com/react-spectrum/ContextualHelp.html -->
<!-- Last fetched: 2026-04-05 -->

# ContextualHelp

ContextualHelp displays additional information about an adjacent component or overall view through a popover interface. The component is triggered by a quiet action button featuring either a help or info icon.

**Added:** v3.16.0

```tsx
import { ContextualHelp } from "@adobe/react-spectrum";
```

## Basic Usage

```tsx
<ContextualHelp variant="info">
  <Heading>Need help?</Heading>
  <Content>
    <Text>
      If you're having issues accessing your account, contact our customer
      support team for help.
    </Text>
  </Content>
</ContextualHelp>
```

## Content Structure

The component accepts these child sections:

- **Heading** -- Title/main text (required)
- **Content** -- Body text (required)
- **Footer** -- Optional link

### With Footer

```tsx
<ContextualHelp variant="help">
  <Heading>What is a segment?</Heading>
  <Content>
    <Text>
      Segments identify who your visitors are, what devices and services they
      use, where they navigated from, and much more.
    </Text>
  </Content>
  <Footer>
    <Link>Learn more about segments</Link>
  </Footer>
</ContextualHelp>
```

## Placement

```tsx
<ContextualHelp variant="info" placement="top start">
  <Heading>Placement</Heading>
  <Content>
    <Text>The placement has been customized to use top start.</Text>
  </Content>
</ContextualHelp>
```

## Events

```tsx
function Example() {
  let [state, setState] = React.useState(false);

  return (
    <Flex alignItems="center" gap="size-100">
      <ContextualHelp
        variant="info"
        onOpenChange={(isOpen) => setState(isOpen)}
      >
        <Heading>Permission required</Heading>
        <Content>
          <Text>
            Your admin must grant you permission before you can create a
            segment.
          </Text>
        </Content>
      </ContextualHelp>
      <Text>Current open state: {state.toString()}</Text>
    </Flex>
  );
}
```

## Visual Variants

- **info**: Brief, supplementary contextual guidance with an informative tone.
- **help**: Detailed, in-depth guidance with links or additional resources in a helpful tone.

## Props

| Name               | Type               | Default          | Description                                |
| ------------------ | ------------------ | ---------------- | ------------------------------------------ |
| `children`         | `ReactNode`        | --               | Contents of the popover                    |
| `variant`          | `'help' \| 'info'` | `'help'`         | Icon type: informative or helpful guidance |
| `placement`        | `Placement`        | `'bottom start'` | Popover position relative to trigger       |
| `isOpen`           | `boolean`          | --               | Controlled open state                      |
| `defaultOpen`      | `boolean`          | --               | Uncontrolled initial open state            |
| `containerPadding` | `number`           | `12`             | Padding between element and container edge |
| `offset`           | `number`           | `0`              | Additional offset along main axis          |
| `crossOffset`      | `number`           | `0`              | Additional offset along cross axis         |
| `shouldFlip`       | `boolean`          | `true`           | Flip orientation when insufficient space   |
| `id`               | `string`           | --               | Element identifier                         |

### Events

| Name           | Type                        | Description                        |
| -------------- | --------------------------- | ---------------------------------- |
| `onOpenChange` | `(isOpen: boolean) => void` | Fired when popover opens or closes |

### Accessibility Props

| Name               | Type     | Description                     |
| ------------------ | -------- | ------------------------------- |
| `aria-label`       | `string` | Accessible label                |
| `aria-labelledby`  | `string` | References labeling element     |
| `aria-describedby` | `string` | References description element  |
| `aria-details`     | `string` | References detailed description |

Layout/spacing/positioning props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`, `UNSAFE_className`, `UNSAFE_style`

## Accessibility

The component follows WAI-ARIA patterns. Use `aria-label`, `aria-labelledby`, `aria-describedby`, and `aria-details` attributes to enhance screen reader support.
