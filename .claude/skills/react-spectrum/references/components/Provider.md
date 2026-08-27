<!-- Source: https://react-spectrum.adobe.com/react-spectrum/Provider.html -->
<!-- Last fetched: 2026-04-05 -->

# Provider

Provider is the container for all React Spectrum applications. It defines the theme, locale, and other application level settings, and can also be used to provide common properties to a group of components.

```tsx
import { Provider, useProvider } from "@adobe/react-spectrum";
```

## Basic Example

```jsx
import { Button, defaultTheme, Provider } from "@adobe/react-spectrum";

function App() {
  return (
    <Provider theme={defaultTheme}>
      <Button variant="accent">Hello React Spectrum!</Button>
    </Provider>
  );
}
```

## Key Features

### Application Provider

Provider must be the root component of your application. All child React Spectrum components depend on it for theme, locale, and configuration settings.

### Themes

Themes provide CSS variables for styling across light/dark color schemes and medium/large platform scales. The system automatically selects schemes based on OS preferences and device type.

### Color Schemes

Override automatic detection with explicit color scheme control:

```jsx
<Provider theme={theme} colorScheme="light">
  <ActionButton margin="size-100">Light theme button</ActionButton>
</Provider>
```

### Locales

Set application language using BCP 47 codes:

```jsx
<Provider theme={theme} locale={appSettings.locale}>
  <YourApp />
</Provider>
```

### Breakpoints

Customize responsive breakpoints for layout components and style props. Default breakpoints: S (640px), M (768px), L (1024px), XL (1280px), XXL (1536px).

```jsx
<Provider theme={theme} breakpoints={{ tablet: 640, desktop: 1024 }}>
  <View
    height="size-1000"
    backgroundColor={{
      base: "celery-600",
      tablet: "blue-600",
      desktop: "magenta-600",
    }}
  />
</Provider>
```

### Client-Side Routing

```jsx
let navigate = useNavigateFromYourRouter();

<Provider theme={theme} router={{ navigate }}>
  <YourApp />
</Provider>;
```

## Property Groups

Provider applies common properties to descendant components, enabling bulk configuration:

```jsx
<Flex direction="column" gap="size-100" alignItems="start">
  <Provider isDisabled>
    <RadioGroup label="Favorite animal">
      <Radio value="dogs">Dogs</Radio>
      <Radio value="cats">Cats</Radio>
      <Radio value="horses">Horses</Radio>
    </RadioGroup>
    <Checkbox>I agree</Checkbox>
    <Button variant="primary">Submit</Button>
  </Provider>
</Flex>
```

Supported group properties: `isQuiet`, `isEmphasized`, `isDisabled`, `isRequired`, `isReadOnly`, `validationState`.

### Nested Providers

Inner Providers override outer configurations:

```jsx
function Register() {
  let [email, setEmail] = React.useState("");

  return (
    <Flex direction="column" gap="size-100" alignItems="start">
      <Provider isQuiet>
        <TextField label="Email" value={email} onChange={setEmail} />
        <Provider isDisabled={email.length === 0}>
          <Picker label="Favorite color">
            <Item key="magenta">Magenta</Item>
            <Item key="indigo">Indigo</Item>
            <Item key="chartreuse">Chartreuse</Item>
          </Picker>
          <Button variant="primary">Submit</Button>
        </Provider>
      </Provider>
    </Flex>
  );
}
```

## Props

### Core Props

| Name                 | Type                  | Default                  | Description                             |
| -------------------- | --------------------- | ------------------------ | --------------------------------------- |
| `children`           | `ReactNode`           | --                       | Content wrapped by Provider             |
| `theme`              | `Theme`               | --                       | Required theme object for application   |
| `colorScheme`        | `'light' \| 'dark'`   | --                       | Override OS color preference            |
| `defaultColorScheme` | `'light' \| 'dark'`   | `'light'`                | Fallback when OS setting unavailable    |
| `scale`              | `'medium' \| 'large'` | --                       | Device scale (auto-detected by default) |
| `locale`             | `string`              | `'en-US'`                | BCP 47 language code                    |
| `breakpoints`        | `Breakpoints`         | `{S:640, M:768, L:1024}` | Custom responsive breakpoints           |
| `router`             | `Router`              | --                       | Client-side router configuration        |

### Property Group Props

| Name              | Type                   | Description                           |
| ----------------- | ---------------------- | ------------------------------------- |
| `isQuiet`         | `boolean`              | Apply quiet style to descendants      |
| `isEmphasized`    | `boolean`              | Apply emphasized style to descendants |
| `isDisabled`      | `boolean`              | Disable descendant components         |
| `isRequired`      | `boolean`              | Mark descendants as required          |
| `isReadOnly`      | `boolean`              | Make descendants read-only            |
| `validationState` | `'valid' \| 'invalid'` | Apply validation styling              |

### Layout Props

| Name              | Type                                      | Description                  |
| ----------------- | ----------------------------------------- | ---------------------------- |
| `flex`            | `Responsive<string \| number \| boolean>` | Flex grow/shrink behavior    |
| `flexGrow`        | `Responsive<number>`                      | Flex growth factor           |
| `flexShrink`      | `Responsive<number>`                      | Flex shrink factor           |
| `flexBasis`       | `Responsive<number \| string>`            | Initial flex size            |
| `alignSelf`       | `Responsive<alignment>`                   | Override container alignment |
| `justifySelf`     | `Responsive<alignment>`                   | Justify within container     |
| `order`           | `Responsive<number>`                      | Layout order in flex/grid    |
| `gridArea`        | `Responsive<string>`                      | Named grid area              |
| `gridColumn`      | `Responsive<string>`                      | Grid column placement        |
| `gridRow`         | `Responsive<string>`                      | Grid row placement           |
| `gridColumnStart` | `Responsive<string>`                      | Grid column start            |
| `gridColumnEnd`   | `Responsive<string>`                      | Grid column end              |
| `gridRowStart`    | `Responsive<string>`                      | Grid row start               |
| `gridRowEnd`      | `Responsive<string>`                      | Grid row end                 |

### Spacing Props

`margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY` -- all `Responsive<DimensionValue>`

### Sizing Props

`width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight` -- all `Responsive<DimensionValue>`

### Positioning Props

| Name       | Type                                                                      | Description            |
| ---------- | ------------------------------------------------------------------------- | ---------------------- |
| `position` | `Responsive<'static' \| 'relative' \| 'absolute' \| 'fixed' \| 'sticky'>` | Position type          |
| `top`      | `Responsive<DimensionValue>`                                              | Top position           |
| `bottom`   | `Responsive<DimensionValue>`                                              | Bottom position        |
| `left`     | `Responsive<DimensionValue>`                                              | Left position          |
| `right`    | `Responsive<DimensionValue>`                                              | Right position         |
| `start`    | `Responsive<DimensionValue>`                                              | Logical start position |
| `end`      | `Responsive<DimensionValue>`                                              | Logical end position   |
| `zIndex`   | `Responsive<number>`                                                      | Stacking order         |
| `isHidden` | `Responsive<boolean>`                                                     | Hide element           |

### Accessibility Props

| Name | Type     | Description               |
| ---- | -------- | ------------------------- |
| `id` | `string` | Unique element identifier |

### Advanced Props

| Name               | Type            | Description                      |
| ------------------ | --------------- | -------------------------------- |
| `UNSAFE_className` | `string`        | CSS class (last resort only)     |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort only) |

## useProvider Hook

Access Provider settings within descendant components:

```jsx
import { useProvider } from "@adobe/react-spectrum";

function Example() {
  let { colorScheme } = useProvider();
  return colorScheme === "dark" ? (
    <Moon aria-label="In dark theme" />
  ) : (
    <Light aria-label="In light theme" />
  );
}
```

### useProvider Return Type

| Property          | Type                   | Description            |
| ----------------- | ---------------------- | ---------------------- |
| `version`         | `string`               | Package version number |
| `theme`           | `Theme`                | Current theme object   |
| `colorScheme`     | `'light' \| 'dark'`    | Active color scheme    |
| `scale`           | `'medium' \| 'large'`  | Active scale           |
| `breakpoints`     | `Breakpoints`          | Configured breakpoints |
| `isQuiet`         | `boolean`              | Quiet mode status      |
| `isEmphasized`    | `boolean`              | Emphasized mode status |
| `isDisabled`      | `boolean`              | Disabled state         |
| `isRequired`      | `boolean`              | Required state         |
| `isReadOnly`      | `boolean`              | Read-only state        |
| `validationState` | `'valid' \| 'invalid'` | Validation state       |

## Theme Object Structure

| Property | Type        | Description                               |
| -------- | ----------- | ----------------------------------------- |
| `global` | `CSSModule` | Variables unchanged across schemes/scales |
| `light`  | `CSSModule` | Light color scheme variables              |
| `dark`   | `CSSModule` | Dark color scheme variables               |
| `medium` | `CSSModule` | Medium scale variables                    |
| `large`  | `CSSModule` | Large scale variables                     |
