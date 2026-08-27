<!-- Source: https://react-aria.adobe.com/Popover -->
<!-- Note: React Spectrum v3 does not have a standalone Popover page (404). This references React Aria Components Popover. -->
<!-- In React Spectrum v3, use DialogTrigger with type="popover" for popover dialogs. -->
<!-- Last fetched: 2026-04-05 -->

# Popover

A popover is an overlay element positioned relative to a trigger.

## Import (React Aria Components)

```javascript
import { Popover, DialogTrigger, OverlayArrow } from "react-aria-components";
```

## React Spectrum v3 Usage

In React Spectrum v3, popovers are created via `DialogTrigger` with `type="popover"`:

```jsx
import {
  DialogTrigger,
  ActionButton,
  Dialog,
  Heading,
  Divider,
  Content,
  Text,
} from "@adobe/react-spectrum";

<DialogTrigger type="popover">
  <ActionButton>Trigger Popover</ActionButton>
  <Dialog>
    <Heading>Popover</Heading>
    <Divider />
    <Content>
      <Text>This is a popover.</Text>
    </Content>
  </Dialog>
</DialogTrigger>;
```

## React Aria Components Usage

### Basic Example

```tsx
import { DialogTrigger } from "react-aria-components";

function Example() {
  return (
    <DialogTrigger>
      <Button aria-label="Settings">Settings</Button>
      <Popover>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Switch defaultSelected>Wi-Fi</Switch>
          <Switch defaultSelected>Bluetooth</Switch>
          <Switch>Mute</Switch>
        </div>
      </Popover>
    </DialogTrigger>
  );
}
```

### With Arrow

```tsx
function Popover({ children, showArrow, ...props }) {
  return (
    <AriaPopover {...props}>
      {showArrow && (
        <OverlayArrow>
          <svg width={12} height={12} viewBox="0 0 12 12">
            <path d="M0 0 L6 6 L12 0" />
          </svg>
        </OverlayArrow>
      )}
      {children}
    </AriaPopover>
  );
}
```

### Custom Anchor

Position a popover relative to a different element than its trigger:

```tsx
function Example() {
  let [isOpen, setOpen] = useState(false);
  let triggerRef = useRef(null);

  return (
    <div>
      <Button onPress={() => setOpen(true)}>Trigger</Button>
      <span ref={triggerRef}>Popover will be positioned relative to me</span>
      <Popover triggerRef={triggerRef} isOpen={isOpen} onOpenChange={setOpen}>
        I'm over here!
      </Popover>
    </div>
  );
}
```

## Props API

### DialogTrigger Props

| Name           | Type                        | Default | Description                       |
| -------------- | --------------------------- | ------- | --------------------------------- |
| `children`     | `ReactNode`                 | --      | Child elements                    |
| `defaultOpen`  | `boolean`                   | --      | Initial open state (uncontrolled) |
| `isOpen`       | `boolean`                   | --      | Controlled open state             |
| `onOpenChange` | `(isOpen: boolean) => void` | --      | Callback when open state changes  |

### Popover Props

| Name                        | Type                                     | Default         | Description                               |
| --------------------------- | ---------------------------------------- | --------------- | ----------------------------------------- |
| `children`                  | `ReactNode \| Function`                  | --              | Popover content                           |
| `className`                 | `string \| Function`                     | --              | CSS class name                            |
| `style`                     | `CSSProperties \| Function`              | --              | Inline styles                             |
| `defaultOpen`               | `boolean`                                | --              | Initial open state                        |
| `isOpen`                    | `boolean`                                | --              | Controlled open state                     |
| `onOpenChange`              | `(isOpen: boolean) => void`              | --              | Open state callback                       |
| `placement`                 | `'top' \| 'bottom' \| 'left' \| 'right'` | `'bottom'`      | Popover position relative to trigger      |
| `offset`                    | `number`                                 | `8`             | Distance from anchor element (px)         |
| `crossOffset`               | `number`                                 | `0`             | Cross-axis offset (px)                    |
| `containerPadding`          | `number`                                 | `12`            | Boundary padding (px)                     |
| `shouldFlip`                | `boolean`                                | `true`          | Auto-flip when space insufficient         |
| `shouldUpdatePosition`      | `boolean`                                | `true`          | Auto-update position on scroll/resize     |
| `maxHeight`                 | `number`                                 | --              | Maximum height                            |
| `isKeyboardDismissDisabled` | `boolean`                                | `false`         | Disable Escape key closing                |
| `isNonModal`                | `boolean`                                | --              | Allow outside interaction without closing |
| `arrowRef`                  | `RefObject<Element \| null>`             | --              | Arrow element ref                         |
| `arrowBoundaryOffset`       | `number`                                 | `0`             | Arrow edge boundary distance              |
| `boundaryElement`           | `Element`                                | `document.body` | Positioning boundary element              |
| `scrollRef`                 | `RefObject<Element \| null>`             | `overlayRef`    | Scrollable region ref                     |
| `triggerRef`                | `RefObject<Element \| null>`             | --              | Anchor element ref (for custom anchor)    |
| `slot`                      | `string \| null`                         | --              | Slot name                                 |
| `dir`                       | `string`                                 | --              | Text direction                            |
| `lang`                      | `string`                                 | --              | Language code                             |
| `render`                    | `DOMRenderFunction<'div'>`               | --              | Custom render function                    |

### OverlayArrow Props

| Name        | Type                        | Default | Description                   |
| ----------- | --------------------------- | ------- | ----------------------------- |
| `children`  | `ReactNode \| Function`     | --      | Arrow content (typically SVG) |
| `className` | `string \| Function`        | --      | CSS class name                |
| `style`     | `CSSProperties \| Function` | --      | Inline styles                 |
| `role`      | `AriaRole`                  | --      | ARIA role                     |
| `id`        | `string`                    | --      | Element ID                    |

### Event Handlers

Standard React DOM event handlers are supported: mouse, touch, pointer, keyboard, focus, composition, animation, transition events.

## Accessibility

- Custom trigger components must use semantic HTML (e.g., `<button>`) or include an interactive ARIA role
- Custom triggers must forward `ref` and spread all props to underlying DOM elements
- Icon-only buttons need proper `aria-label` attributes
- Use `<Pressable>` component to wrap non-interactive elements as triggers

## State Management

### Uncontrolled

```tsx
<DialogTrigger defaultOpen={false}>
  <Button>Open</Button>
  <Popover>Content</Popover>
</DialogTrigger>
```

### Controlled

```tsx
const [isOpen, setIsOpen] = useState(false);
<Popover isOpen={isOpen} onOpenChange={setIsOpen}>
  Content
</Popover>;
```
