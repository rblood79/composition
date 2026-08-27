<!-- Source: https://react-spectrum.adobe.com/react-spectrum/DropZone.html -->
<!-- Last fetched: 2026-04-05 -->

# DropZone

A drop zone is an area into which one or multiple objects can be dragged and dropped. It supports drop operations via mouse, keyboard, and touch interactions.

**Added in:** 3.35.0

## Import

```javascript
import { DropZone } from "@adobe/react-spectrum";
```

## Basic Example

```jsx
import Upload from "@spectrum-icons/illustrations/Upload";

function Example() {
  let [isFilled, setIsFilled] = React.useState(false);

  return (
    <>
      <Draggable />
      <DropZone
        maxWidth="size-3000"
        isFilled={isFilled}
        onDrop={() => setIsFilled(true)}
      >
        <IllustratedMessage>
          <Upload />
          <Heading>
            {isFilled ? "You dropped something!" : "Drag and drop your file"}
          </Heading>
        </IllustratedMessage>
      </DropZone>
    </>
  );
}
```

## With FileTrigger and Browse Button

```jsx
import { FileTrigger } from "@adobe/react-spectrum";

function Example() {
  let [isFilled, setIsFilled] = React.useState(false);

  return (
    <DropZone
      maxWidth="size-3000"
      isFilled={isFilled}
      onDrop={() => setIsFilled(true)}
    >
      <IllustratedMessage>
        <Upload />
        <Heading>
          {isFilled ? "You dropped something!" : "Drag and drop here"}
        </Heading>
        <Content>
          <FileTrigger onSelect={() => setIsFilled(true)}>
            <Button variant="primary">Browse</Button>
          </FileTrigger>
        </Content>
      </IllustratedMessage>
    </DropZone>
  );
}
```

## Handling Drop Events with File Data

```jsx
function Example() {
  let [filledSrc, setFilledSrc] = React.useState(null);

  return (
    <DropZone
      maxWidth="size-3000"
      isFilled={!!filledSrc}
      onDrop={async (e) => {
        e.items.find(async (item) => {
          if (item.kind === "file") {
            setFilledSrc(item.name);
          } else if (item.kind === "text" && item.types.has("text/plain")) {
            setFilledSrc(await item.getText("text/plain"));
          }
        });
      }}
    >
      {filledSrc ? (
        <Flex
          direction="column"
          alignItems="center"
          justifyContent="center"
          gap="size-100"
        >
          <File />
          {filledSrc}
        </Flex>
      ) : (
        <IllustratedMessage>
          <Upload />
          <Heading>Drag and drop here</Heading>
        </IllustratedMessage>
      )}
    </DropZone>
  );
}
```

## Image Drop Zone with Type Validation

```jsx
function Example() {
  let [filledSrc, setFilledSrc] = React.useState(null);

  return (
    <DropZone
      maxWidth="size-3000"
      isFilled={!!filledSrc}
      getDropOperation={(types) =>
        types.has("image/jpeg") ? "copy" : "cancel"
      }
      onDrop={async (e) => {
        e.items.find(async (item) => {
          if (item.kind === "file" && item.type === "image/jpeg") {
            let file = await item.getFile();
            setFilledSrc({ type: file.type, name: file.name });
          }
        });
      }}
    >
      <IllustratedMessage>
        <Upload />
        <Heading>
          {filledSrc
            ? `${filledSrc.type} ${filledSrc.name}`
            : "Drag and drop here"}
        </Heading>
      </IllustratedMessage>
    </DropZone>
  );
}
```

## Custom Replace Message

```jsx
<DropZone
  isFilled={isFilled}
  maxWidth="size-3000"
  replaceMessage="This is a custom message"
  onDrop={() => setIsFilled(true)}
>
  <IllustratedMessage>
    <Upload />
    <Heading>
      {isFilled ? "You dropped something!" : "Drag and drop here"}
    </Heading>
  </IllustratedMessage>
</DropZone>
```

## Props API

### Core Props

| Name               | Type                                                                      | Default                  | Description                                           |
| ------------------ | ------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------- |
| `children`         | `ReactNode`                                                               | --                       | The content to display in the drop zone               |
| `isFilled`         | `boolean`                                                                 | `false`                  | Whether the drop zone has been filled                 |
| `replaceMessage`   | `string`                                                                  | `"Drop file to replace"` | Custom message shown when filled and drag hovers      |
| `getDropOperation` | `(types: DragTypes, allowedOperations: DropOperation[]) => DropOperation` | --                       | Function returning the drop operation for given types |

### Event Handlers

| Name             | Type                             | Description                                    |
| ---------------- | -------------------------------- | ---------------------------------------------- |
| `onDropEnter`    | `(e: DropEnterEvent) => void`    | Valid drag enters the drop target              |
| `onDropMove`     | `(e: DropMoveEvent) => void`     | Valid drag moves within the drop target        |
| `onDropActivate` | `(e: DropActivateEvent) => void` | Valid drag held over target for period of time |
| `onDropExit`     | `(e: DropExitEvent) => void`     | Valid drag exits the drop target               |
| `onDrop`         | `(e: DropEvent) => void`         | Valid drag is dropped on the drop target       |

### Accessibility Props

| Name               | Type     | Description                             |
| ------------------ | -------- | --------------------------------------- |
| `id`               | `string` | Unique element identifier               |
| `aria-label`       | `string` | Label for assistive technology          |
| `aria-labelledby`  | `string` | ID of labeling element                  |
| `aria-describedby` | `string` | ID of describing element                |
| `aria-details`     | `string` | ID of element with extended description |

### Layout/Spacing/Sizing/Positioning Props (Responsive)

All standard Spectrum layout props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `slot`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`

### Advanced Props

| Name               | Type            | Description                        |
| ------------------ | --------------- | ---------------------------------- |
| `UNSAFE_className` | `string`        | CSS className (use as last resort) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (use as last resort) |

## Drop Event Types

### DropEvent

| Property        | Type                                     | Description                     |
| --------------- | ---------------------------------------- | ------------------------------- |
| `type`          | `'drop'`                                 | Event type                      |
| `dropOperation` | `'copy' \| 'link' \| 'move' \| 'cancel'` | Operation to perform            |
| `items`         | `DropItem[]`                             | Array of dropped items          |
| `x`             | `number`                                 | X coordinate relative to target |
| `y`             | `number`                                 | Y coordinate relative to target |

### Drop Item Types

**TextDropItem**: `kind: 'text'`, `types: Set<string>`, `getText(type): Promise<string>`

**FileDropItem**: `kind: 'file'`, `type: string` (MIME), `name: string`, `getFile(): Promise<File>`, `getText(): Promise<string>`

**DirectoryDropItem**: `kind: 'directory'`, `name: string`, `getEntries(): AsyncIterable`

## Accessibility

A visual label should be provided to DropZone using a `Text` element with a `label` slot. If not provided, an `aria-label` or `aria-labelledby` prop must be passed to identify the visually hidden button to assistive technology.
