<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Dialog.html -->
<!-- Last fetched: 2026-04-05 -->

# Dialog

Dialogs are windows containing contextual information, tasks, or workflows that appear over the user interface. Depending on the kind of Dialog, further interactions may be blocked until the Dialog is acknowledged.

## Import

```javascript
import { Dialog, DialogTrigger } from "@adobe/react-spectrum";
```

## Basic Usage

```jsx
<DialogTrigger>
  <ActionButton>Check connectivity</ActionButton>
  {(close) => (
    <Dialog>
      <Heading>Internet Speed Test</Heading>
      <Divider />
      <Content>
        <Text>Start speed test?</Text>
      </Content>
      <ButtonGroup>
        <Button variant="secondary" onPress={close}>
          Cancel
        </Button>
        <Button variant="accent" onPress={close}>
          Confirm
        </Button>
      </ButtonGroup>
    </Dialog>
  )}
</DialogTrigger>
```

## Content Structure

A standard Dialog comprises these optional sections:

- **Header** - Supporting content area
- **Heading** - Title area (required for compliance)
- **Divider** - Visual separator
- **Content** - Main body area (required)
- **Footer** - Additional content area
- **ButtonGroup** - Action buttons area (required for non-dismissable)
- **Hero Slot** - Image via `slot="hero"` prop

## Dismissable Dialog

```jsx
<DialogTrigger isDismissable>
  <ActionButton>Status</ActionButton>
  <Dialog>
    <Heading>Status</Heading>
    <Divider />
    <Content>Printer Status: Connected</Content>
  </Dialog>
</DialogTrigger>
```

## Dialog with Form

```jsx
<DialogTrigger>
  <ActionButton>Register</ActionButton>
  {(close) => (
    <Dialog>
      <Heading>Register for newsletter</Heading>
      <Divider />
      <Content>
        <Form>
          <TextField label="First Name" autoFocus />
          <TextField label="Last Name" />
          <TextField label="Street Address" />
          <TextField label="City" />
        </Form>
      </Content>
      <Footer>
        <Checkbox>I want to receive updates for exclusive offers</Checkbox>
      </Footer>
      <ButtonGroup>
        <Button variant="secondary" onPress={close}>
          Cancel
        </Button>
        <Button variant="accent" onPress={close}>
          Register
        </Button>
      </ButtonGroup>
    </Dialog>
  )}
</DialogTrigger>
```

## Dialog with Hero Image

```jsx
<DialogTrigger>
  <ActionButton>Upload</ActionButton>
  {(close) => (
    <Dialog>
      <Image
        slot="hero"
        alt=""
        src="https://i.imgur.com/Z7AzH2c.png"
        objectFit="cover"
      />
      <Heading>Upload file</Heading>
      <Divider />
      <Content>Are you sure you want to upload this file?</Content>
      <ButtonGroup>
        <Button variant="secondary" onPress={close}>
          Cancel
        </Button>
        <Button variant="accent" onPress={close} autoFocus>
          Confirm
        </Button>
      </ButtonGroup>
    </Dialog>
  )}
</DialogTrigger>
```

## Dialog Types

### Modal

```jsx
<DialogTrigger isDismissable type="modal">
  <ActionButton>Trigger Modal</ActionButton>
  <Dialog>
    <Heading>Modal</Heading>
    <Divider />
    <Content>
      <Text>This is a modal.</Text>
    </Content>
  </Dialog>
</DialogTrigger>
```

### Popover

```jsx
<DialogTrigger type="popover">
  <ActionButton>Trigger Popover</ActionButton>
  <Dialog>
    <Heading>Popover</Heading>
    <Divider />
    <Content>
      <Text>This is a popover.</Text>
    </Content>
  </Dialog>
</DialogTrigger>
```

### Tray

```jsx
<DialogTrigger type="tray">
  <ActionButton>Trigger Tray</ActionButton>
  <Dialog>
    <Heading>Tray</Heading>
    <Divider />
    <Content>
      <Text>This is a tray.</Text>
    </Content>
  </Dialog>
</DialogTrigger>
```

## Size Variants

Sizes `'S'`, `'M'`, `'L'` are available for modal-type Dialogs.

```jsx
<DialogTrigger>
  <ActionButton>Small</ActionButton>
  {(close) => (
    <Dialog size="S">
      <Heading>Profile</Heading>
      <Divider />
      <Content>
        <Form>
          <TextField label="Name" />
          <Checkbox>Make private</Checkbox>
        </Form>
      </Content>
      <ButtonGroup>
        <Button variant="secondary" onPress={close}>
          Cancel
        </Button>
        <Button autoFocus variant="accent" onPress={close}>
          Save
        </Button>
      </ButtonGroup>
    </Dialog>
  )}
</DialogTrigger>
```

## Events

### Dismissable Dialog Events

```jsx
function Example() {
  let alertDismiss = (close) => {
    close();
    alert("Dialog dismissed.");
  };

  return (
    <DialogTrigger isDismissable>
      <ActionButton>Info</ActionButton>
      {(close) => (
        <Dialog onDismiss={() => alertDismiss(close)}>
          <Heading>Version Info</Heading>
          <Divider />
          <Content>
            <Text>Version 1.0.0, Copyright 2020</Text>
          </Content>
        </Dialog>
      )}
    </DialogTrigger>
  );
}
```

## Props API

### Dialog Props

| Name            | Type                | Default | Description                                 |
| --------------- | ------------------- | ------- | ------------------------------------------- |
| `children`      | `ReactNode`         | --      | The contents of the Dialog                  |
| `size`          | `'S' \| 'M' \| 'L'` | --      | Size for modal-type Dialogs only            |
| `isDismissable` | `boolean`           | --      | Shows close button; Dialog can be dismissed |

### Events

| Name        | Type         | Description                                                   |
| ----------- | ------------ | ------------------------------------------------------------- |
| `onDismiss` | `() => void` | Triggered when close button is clicked on dismissable dialogs |

### Accessibility Props

| Name               | Type                        | Default    | Description                      |
| ------------------ | --------------------------- | ---------- | -------------------------------- |
| `role`             | `'dialog' \| 'alertdialog'` | `'dialog'` | Accessibility role               |
| `id`               | `string`                    | --         | Unique element identifier        |
| `aria-label`       | `string`                    | --         | Defines label for element        |
| `aria-labelledby`  | `string`                    | --         | References labeling element(s)   |
| `aria-describedby` | `string`                    | --         | References describing element(s) |
| `aria-details`     | `string`                    | --         | References detailed description  |

### Layout Props (Responsive)

| Name              | Type                                                                                                                                               | Description                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `flex`            | `string \| number \| boolean`                                                                                                                      | Flex layout growth/shrink behavior |
| `flexGrow`        | `number`                                                                                                                                           | Flex growth amount                 |
| `flexShrink`      | `number`                                                                                                                                           | Flex shrink amount                 |
| `flexBasis`       | `number \| string`                                                                                                                                 | Initial main size                  |
| `alignSelf`       | `'auto' \| 'normal' \| 'start' \| 'end' \| 'center' \| 'flex-start' \| 'flex-end' \| 'self-start' \| 'self-end' \| 'stretch'`                      | Align override                     |
| `justifySelf`     | `'auto' \| 'normal' \| 'start' \| 'end' \| 'flex-start' \| 'flex-end' \| 'self-start' \| 'self-end' \| 'center' \| 'left' \| 'right' \| 'stretch'` | Justification positioning          |
| `order`           | `number`                                                                                                                                           | Layout order in flex/grid          |
| `gridArea`        | `string`                                                                                                                                           | Named grid area placement          |
| `gridColumn`      | `string`                                                                                                                                           | Grid column placement              |
| `gridRow`         | `string`                                                                                                                                           | Grid row placement                 |
| `gridColumnStart` | `string`                                                                                                                                           | Grid column start span             |
| `gridColumnEnd`   | `string`                                                                                                                                           | Grid column end span               |
| `gridRowStart`    | `string`                                                                                                                                           | Grid row start span                |
| `gridRowEnd`      | `string`                                                                                                                                           | Grid row end span                  |

### Spacing Props (Responsive)

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY` -- all `DimensionValue`

### Sizing Props (Responsive)

`width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight` -- all `DimensionValue`

### Positioning Props (Responsive)

| Name       | Type                                                          | Description                        |
| ---------- | ------------------------------------------------------------- | ---------------------------------- |
| `position` | `'static' \| 'relative' \| 'absolute' \| 'fixed' \| 'sticky'` | Element positioning                |
| `top`      | `DimensionValue`                                              | Top position                       |
| `bottom`   | `DimensionValue`                                              | Bottom position                    |
| `left`     | `DimensionValue`                                              | Left position                      |
| `right`    | `DimensionValue`                                              | Right position                     |
| `start`    | `DimensionValue`                                              | Logical start position (RTL-aware) |
| `end`      | `DimensionValue`                                              | Logical end position (RTL-aware)   |
| `zIndex`   | `number`                                                      | Stacking order                     |
| `isHidden` | `boolean`                                                     | Hide element                       |

### Advanced Props

| Name               | Type            | Description                       |
| ------------------ | --------------- | --------------------------------- |
| `UNSAFE_className` | `string`        | CSS class name (last resort only) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort only)  |

## Accessibility

- The title of a Dialog is typically provided via its Heading. The component automatically sets `aria-labelledby` to match the heading `id`.
- Override by providing your own `aria-labelledby` prop. When no visible label exists, supply an `aria-label` instead.
- Tab order follows the sequence of provided children. Specify which component receives focus when the Dialog opens via the `autoFocus` prop.
- When a Dialog opens, focus management and keyboard interaction follow standard modal patterns to ensure proper tab trapping and escape key handling.
