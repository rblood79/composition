<!-- Source: https://react-spectrum.adobe.com/s2/ (S2) + GitHub @react-spectrum/s2/src/SelectBoxGroup.tsx -->
<!-- Last fetched: 2026-04-05 -->

# SelectBoxGroup

SelectBoxGroup allows users to select one or more options from a grid-based list of items with configurable selection behavior and orientation.

```tsx
import { SelectBoxGroup, SelectBox } from "@react-spectrum/s2";
```

## Examples

### Basic

```jsx
<SelectBoxGroup
  aria-label="Choose a cloud"
  selectionMode="single"
  orientation="vertical"
>
  <SelectBox id="aws" textValue="Amazon Web Services">
    <Server />
    <Text slot="label">Amazon Web Services</Text>
    <Text slot="description">Reliable cloud infrastructure</Text>
  </SelectBox>
  <SelectBox id="azure" textValue="Microsoft Azure">
    <AlertNotice />
    <Text slot="label">Microsoft Azure</Text>
  </SelectBox>
  <SelectBox id="gcp" textValue="Google Cloud Platform">
    <PaperAirplane />
    <Text slot="label">Google Cloud Platform</Text>
  </SelectBox>
</SelectBoxGroup>
```

### Slot Combinations

SelectBox supports the following content slot combinations:

- Label only
- Illustration + Label
- Label + Description
- Illustration + Label + Description

```jsx
{
  /* Vertical: All slots */
}
<SelectBoxGroup aria-label="Full example" orientation="vertical">
  <SelectBox id="full" textValue="Full">
    <AlertNotice />
    <Text slot="label">Full Vertical</Text>
    <Text slot="description">Complete description</Text>
  </SelectBox>
</SelectBoxGroup>;

{
  /* Horizontal: All slots */
}
<SelectBoxGroup aria-label="Horizontal" orientation="horizontal">
  <SelectBox id="h-full" textValue="Horizontal Full">
    <PaperAirplane />
    <Text slot="label">Horizontal All</Text>
    <Text slot="description">Complete horizontal layout</Text>
  </SelectBox>
</SelectBoxGroup>;
```

## Props

### SelectBoxGroupProps

| Name            | Type                                    | Default      | Description                                   |
| --------------- | --------------------------------------- | ------------ | --------------------------------------------- |
| `children`      | `ReactNode \| ((item: T) => ReactNode)` | --           | The SelectBox elements                        |
| `orientation`   | `'vertical' \| 'horizontal'`            | `'vertical'` | Layout direction of content in each SelectBox |
| `selectionMode` | `'single' \| 'multiple'`                | `'single'`   | Selection mode                                |
| `isDisabled`    | `boolean`                               | --           | Whether the group is disabled                 |
| `aria-label`    | `string`                                | --           | Accessibility label                           |
| `styles`        | `StyleString`                           | --           | Spectrum style overrides                      |

### SelectBoxProps

| Name         | Type        | Default | Description                                          |
| ------------ | ----------- | ------- | ---------------------------------------------------- |
| `id`         | `Key`       | --      | Unique identifier                                    |
| `textValue`  | `string`    | --      | Text representation for typeahead                    |
| `children`   | `ReactNode` | --      | Content (illustration, label slot, description slot) |
| `isDisabled` | `boolean`   | --      | Whether the item is disabled                         |
| `aria-label` | `string`    | --      | Accessibility label                                  |

## Content Slots

| Slot          | Element                     | Description                                            |
| ------------- | --------------------------- | ------------------------------------------------------ |
| (default)     | Illustration/Icon           | Visual element at top (vertical) or start (horizontal) |
| `label`       | `<Text slot="label">`       | Primary label text                                     |
| `description` | `<Text slot="description">` | Secondary description text                             |

## Accessibility

An `aria-label` is required on SelectBoxGroup. Each SelectBox should have a `textValue` for typeahead support.
