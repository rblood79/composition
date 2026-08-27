<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Picker.html -->
<!-- Last fetched: 2026-04-05 -->

# Picker

Pickers allow users to choose a single option from a collapsible list of options when space is limited.

**Added:** v3.0.0

```tsx
import { Picker, Item, Section } from "@adobe/react-spectrum";
```

## Basic Usage

```tsx
<Picker label="Choose frequency">
  <Item key="rarely">Rarely</Item>
  <Item key="sometimes">Sometimes</Item>
  <Item key="always">Always</Item>
</Picker>
```

### Dynamic Collections

```tsx
function Example() {
  let options = [
    { id: 1, name: "Aardvark" },
    { id: 2, name: "Cat" },
    { id: 3, name: "Dog" },
  ];
  let [animalId, setAnimalId] = React.useState(null);

  return (
    <>
      <Picker
        label="Pick an animal"
        items={options}
        onSelectionChange={setAnimalId}
      >
        {(item) => <Item>{item.name}</Item>}
      </Picker>
      <p>Animal id: {animalId}</p>
    </>
  );
}
```

## Content

### Complex Items

Items can include icons, avatars, and descriptions:

```tsx
<Picker label="Options">
  <Section title="Permission">
    <Item textValue="Read">
      <Book size="S" />
      <Text>Read</Text>
      <Text slot="description">Read Only</Text>
    </Item>
  </Section>
</Picker>
```

### Sections

```tsx
<Picker label="Pick your favorite">
  <Section title="Animals">
    <Item key="Aardvark">Aardvark</Item>
    <Item key="Kangaroo">Kangaroo</Item>
  </Section>
  <Section title="People">
    <Item key="Danni">Danni</Item>
  </Section>
</Picker>
```

### Asynchronous Loading

```tsx
import { useAsyncList } from "react-stately";

function AsyncLoadingExample() {
  let list = useAsyncList({
    async load({ signal, cursor }) {
      let res = await fetch(cursor || "https://pokeapi.co/api/v2/pokemon", {
        signal,
      });
      let json = await res.json();
      return { items: json.results, cursor: json.next };
    },
  });

  return (
    <Picker
      label="Pick a Pokemon"
      items={list.items}
      isLoading={list.isLoading}
      onLoadMore={list.loadMore}
    >
      {(item) => <Item key={item.name}>{item.name}</Item>}
    </Picker>
  );
}
```

## Selection

### Controlled

```tsx
let [animal, setAnimal] = React.useState("Bison");

<Picker
  label="Pick an animal"
  items={options}
  selectedKey={animal}
  onSelectionChange={(selected) => setAnimal(selected)}
>
  {(item) => <Item key={item.name}>{item.name}</Item>}
</Picker>;
```

### Uncontrolled

```tsx
<Picker label="Pick an animal" items={options} defaultSelectedKey="Bison">
  {(item) => <Item key={item.name}>{item.name}</Item>}
</Picker>
```

### HTML Forms

```tsx
<Picker label="Favorite Animal" name="favoriteAnimalId">
  <Item key="panda">Panda</Item>
  <Item key="cat">Cat</Item>
  <Item key="dog">Dog</Item>
</Picker>
```

## Links

Items can function as navigation links (not selectable):

```tsx
<Picker label="Project">
  <Item href="https://example.com/" target="_blank">
    Create new...
  </Item>
  <Item>Proposal</Item>
  <Item>Budget</Item>
</Picker>
```

## Validation

```tsx
<Form validationBehavior="native" maxWidth="size-3000">
  <Picker label="Favorite animal" name="animal" isRequired>
    <Item>Aardvark</Item>
    <Item>Cat</Item>
    <Item>Dog</Item>
  </Picker>
  <ButtonGroup>
    <Button type="submit" variant="primary">
      Submit
    </Button>
    <Button type="reset" variant="secondary">
      Reset
    </Button>
  </ButtonGroup>
</Form>
```

## Visual Options

### Label Position

```tsx
<Picker label="Choose frequency" labelPosition="side" labelAlign="end">
  <Item key="rarely">Rarely</Item>
</Picker>
```

### Quiet Style

```tsx
<Picker label="Choose frequency" isQuiet>
  <Item key="rarely">Rarely</Item>
</Picker>
```

### Disabled

```tsx
<Picker label="Choose frequency" isDisabled>
  <Item key="rarely">Rarely</Item>
</Picker>
```

### Help Text

```tsx
<Picker
  label="Favorite animal"
  description="Pick your favorite animal"
  errorMessage="Selection is required"
  isInvalid={!isValid}
>
  <Item>Cat</Item>
</Picker>
```

### Custom Width / Menu Width

```tsx
<Picker label="Choose frequency" width="size-3600" maxWidth="100%">
  <Item key="rarely">Rarely</Item>
</Picker>

<Picker label="Choose animal" menuWidth="size-6000">
  <Item key="Emu">Emu</Item>
</Picker>
```

### Menu Alignment and Direction

```tsx
<Picker label="Choose frequency" align="end" menuWidth="size-3000">
  <Item key="rarely">Rarely</Item>
</Picker>

<Picker label="Choose animal" direction="top">
  <Item key="Emu">Emu</Item>
</Picker>
```

### Controlled Open State

```tsx
function Example() {
  let [open, setOpen] = React.useState(false);
  return (
    <Picker label="Frequency" isOpen={open} onOpenChange={setOpen}>
      <Item key="rarely">Rarely</Item>
    </Picker>
  );
}
```

## Props

### Main Props

| Name                  | Type                    | Default    | Description                         |
| --------------------- | ----------------------- | ---------- | ----------------------------------- |
| `children`            | `CollectionChildren`    | --         | Collection contents                 |
| `items`               | `Iterable<object>`      | --         | Dynamic item objects                |
| `label`               | `ReactNode`             | --         | Field label                         |
| `placeholder`         | `string`                | --         | Placeholder text                    |
| `selectedKey`         | `Key \| null`           | --         | Selected key (controlled)           |
| `defaultSelectedKey`  | `Key \| null`           | --         | Initial selected key (uncontrolled) |
| `isOpen`              | `boolean`               | --         | Menu open state (controlled)        |
| `defaultOpen`         | `boolean`               | --         | Initial open state                  |
| `isQuiet`             | `boolean`               | --         | Quiet style                         |
| `isDisabled`          | `boolean`               | --         | Disable the input                   |
| `isRequired`          | `boolean`               | --         | Mark as required                    |
| `isInvalid`           | `boolean`               | --         | Mark as invalid                     |
| `isLoading`           | `boolean`               | --         | Show loading state                  |
| `disabledKeys`        | `Iterable<Key>`         | --         | Keys of disabled items              |
| `autoFocus`           | `boolean`               | --         | Focus on render                     |
| `autoComplete`        | `string`                | --         | HTML autocomplete attribute         |
| `name`                | `string`                | --         | Form field name                     |
| `form`                | `string`                | --         | Associated form id                  |
| `validationBehavior`  | `'aria' \| 'native'`    | `'aria'`   | Validation mode                     |
| `validate`            | `Function`              | --         | Custom validation function          |
| `description`         | `ReactNode`             | --         | Field description/hint              |
| `errorMessage`        | `ReactNode \| Function` | --         | Error message                       |
| `labelPosition`       | `'top' \| 'side'`       | `'top'`    | Label placement                     |
| `labelAlign`          | `'start' \| 'end'`      | `'start'`  | Label alignment                     |
| `necessityIndicator`  | `'icon' \| 'label'`     | `'icon'`   | Required indicator style            |
| `contextualHelp`      | `ReactNode`             | --         | Contextual help element             |
| `align`               | `'start' \| 'end'`      | `'start'`  | Menu alignment                      |
| `direction`           | `'bottom' \| 'top'`     | `'bottom'` | Menu direction                      |
| `shouldFlip`          | `boolean`               | `true`     | Auto-flip when space limited        |
| `menuWidth`           | `DimensionValue`        | --         | Menu width                          |
| `excludeFromTabOrder` | `boolean`               | --         | Remove from tab order               |
| `id`                  | `string`                | --         | Element ID                          |

### Events

| Name                | Type                           | Description                      |
| ------------------- | ------------------------------ | -------------------------------- |
| `onSelectionChange` | `(key: Key \| null) => void`   | Fires when selection changes     |
| `onOpenChange`      | `(isOpen: boolean) => void`    | Fires when menu opens/closes     |
| `onLoadMore`        | `() => any`                    | Fires when scrolling near bottom |
| `onFocus`           | `(e: FocusEvent) => void`      | Fires on focus                   |
| `onBlur`            | `(e: FocusEvent) => void`      | Fires on blur                    |
| `onFocusChange`     | `(isFocused: boolean) => void` | Focus state changes              |
| `onKeyDown`         | `(e: KeyboardEvent) => void`   | Key pressed                      |
| `onKeyUp`           | `(e: KeyboardEvent) => void`   | Key released                     |

### Accessibility Props

| Name               | Type     | Description                |
| ------------------ | -------- | -------------------------- |
| `aria-label`       | `string` | ARIA label                 |
| `aria-labelledby`  | `string` | ARIA label reference       |
| `aria-describedby` | `string` | ARIA description reference |
| `aria-details`     | `string` | ARIA details reference     |

Layout/spacing/positioning props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, `gridColumnStart`, `gridColumnEnd`, `gridRowStart`, `gridRowEnd`, `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`, `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`, `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`, `UNSAFE_className`, `UNSAFE_style`

### Item Props

| Name             | Type                | Description                                 |
| ---------------- | ------------------- | ------------------------------------------- |
| `children`       | `ReactNode`         | Item content                                |
| `title`          | `ReactNode`         | Item title if children contains child items |
| `textValue`      | `string`            | String for typeahead                        |
| `aria-label`     | `string`            | ARIA label                                  |
| `key`            | `Key`               | Unique identifier                           |
| `href`           | `string`            | Link URL (makes item non-selectable)        |
| `target`         | `string`            | Link target                                 |
| `rel`            | `string`            | Link relationship                           |
| `download`       | `boolean \| string` | Download attribute                          |
| `ping`           | `string`            | Ping URLs                                   |
| `referrerPolicy` | `string`            | Referrer policy                             |
| `hrefLang`       | `string`            | Linked URL language hint                    |
| `routerOptions`  | `object`            | Client router options                       |
| `childItems`     | `Iterable<T>`       | Child items for dynamic collections         |
| `hasChildItems`  | `boolean`           | Whether item has children                   |

### Section Props

| Name         | Type                                       | Description               |
| ------------ | ------------------------------------------ | ------------------------- |
| `children`   | `ItemElement \| ItemElement[] \| Function` | Static or dynamic items   |
| `title`      | `ReactNode`                                | Section header            |
| `aria-label` | `string`                                   | ARIA label                |
| `items`      | `Iterable<T>`                              | Dynamic item objects      |
| `key`        | `Key`                                      | Unique section identifier |

## Testing

```tsx
import { User } from "@react-spectrum/test-utils";

let testUtilUser = new User({ interactionType: "mouse" });

it("Picker can select an option", async function () {
  let { getByTestId } = render(
    <Provider theme={defaultTheme}>
      <Picker data-testid="test-select">
        <Item>Cat</Item>
      </Picker>
    </Provider>,
  );

  let selectTester = testUtilUser.createTester("Select", {
    root: getByTestId("test-select"),
    interactionType: "keyboard",
  });

  await selectTester.selectOption({ option: "Cat" });
});
```

### SelectTester Properties

| Property   | Type                  | Description                  |
| ---------- | --------------------- | ---------------------------- |
| `trigger`  | `HTMLElement`         | The select's trigger element |
| `listbox`  | `HTMLElement \| null` | The select's listbox         |
| `sections` | `HTMLElement[]`       | The select's sections        |

### SelectTester Methods

| Method                     | Description                               |
| -------------------------- | ----------------------------------------- |
| `open(opts)`               | Opens the select menu                     |
| `close()`                  | Closes the select menu                    |
| `findOption(opts)`         | Returns option by index or text           |
| `selectOption(opts)`       | Selects an option by node, text, or index |
| `options(opts)`            | Returns all select options                |
| `setInteractionType(type)` | Changes interaction type                  |

## Accessibility

- Required fields display via `isRequired` and `necessityIndicator` props
- Use `aria-label` when no visible label is provided
- Error messages display with `validationBehavior="native"`
- RTL layout automatically flipped
- On mobile, renders in a tray instead of a popover
