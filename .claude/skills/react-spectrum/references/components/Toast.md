<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Toast.html -->
<!-- Last fetched: 2026-04-05 -->

# Toast

Toasts display brief, temporary notifications of actions, errors, or other events in an application.

**Version:** 3.46.2

```tsx
import { ToastContainer, ToastQueue } from "@adobe/react-spectrum";
```

## Usage Examples

### Basic Setup

Place ToastContainer at the application root:

```jsx
<ToastContainer />
```

Queue toasts from anywhere:

```jsx
<Button onPress={() => ToastQueue.positive("Toast is done!")} variant="primary">
  Show toast
</Button>
```

### Toast Types

```jsx
// Neutral
ToastQueue.neutral("Toast available");

// Positive
ToastQueue.positive("Toast is done!");

// Negative
ToastQueue.negative("Toast is burned!");

// Info
ToastQueue.info("Toasting...");
```

### With Action Button

```jsx
ToastQueue.info("An update is available", {
  actionLabel: "Update",
  onAction: () => alert("Updating!"),
  shouldCloseOnAction: true,
});
```

### Auto-Dismiss (minimum 5 seconds)

```jsx
ToastQueue.positive("Toast is done!", { timeout: 5000 });
```

### Programmatic Dismissal

```jsx
function Example() {
  let [close, setClose] = React.useState(null);

  return (
    <Button
      onPress={() => {
        if (!close) {
          let close = ToastQueue.negative("Unable to save", {
            onClose: () => setClose(null),
          });
          setClose(() => close);
        } else {
          close();
        }
      }}
      variant="primary"
    >
      {close ? "Hide" : "Show"} Toast
    </Button>
  );
}
```

### Placement

```jsx
<ToastContainer placement="bottom end" />
```

Valid placements: `'top'`, `'top end'`, `'bottom'`, `'bottom end'`

## API Reference

### ToastQueue Methods

| Method                                                       | Return          | Description            |
| ------------------------------------------------------------ | --------------- | ---------------------- |
| `neutral(children: string, options?: SpectrumToastOptions)`  | `CloseFunction` | Queue a neutral toast  |
| `positive(children: string, options?: SpectrumToastOptions)` | `CloseFunction` | Queue a positive toast |
| `negative(children: string, options?: SpectrumToastOptions)` | `CloseFunction` | Queue a negative toast |
| `info(children: string, options?: SpectrumToastOptions)`     | `CloseFunction` | Queue an info toast    |

### Toast Options (SpectrumToastOptions)

| Name                  | Type         | Description                                   |
| --------------------- | ------------ | --------------------------------------------- |
| `actionLabel`         | `string`     | Label for the action button                   |
| `onAction`            | `() => void` | Triggered when action button is pressed       |
| `shouldCloseOnAction` | `boolean`    | Auto-close after action performed             |
| `onClose`             | `() => void` | Triggered when toast closes                   |
| `timeout`             | `number`     | Auto-dismiss delay in milliseconds (min 5000) |
| `id`                  | `string`     | Unique identifier for the element             |

### ToastContainer Props

| Name               | Type                                             | Default           | Description                          |
| ------------------ | ------------------------------------------------ | ----------------- | ------------------------------------ |
| `placement`        | `'top' \| 'top end' \| 'bottom' \| 'bottom end'` | --                | Toast position on screen             |
| `aria-label`       | `string`                                         | `"Notifications"` | Accessibility label for toast region |
| `aria-labelledby`  | `string`                                         | --                | Labels the current element           |
| `aria-describedby` | `string`                                         | --                | Describes the element                |
| `aria-details`     | `string`                                         | --                | Provides detailed description        |

## Accessibility

- Toasts are rendered in a landmark region labeled "Notifications"
- Navigate to toasts using F6 (forward) or Shift+F6 (backward)
- Focus restores when the last toast closes
- RTL layout automatic

## Testing

| data-testid                 | Element       |
| --------------------------- | ------------- |
| `rsp-Toast-secondaryButton` | Action button |
| `rsp-Toast-closeButton`     | Close button  |
