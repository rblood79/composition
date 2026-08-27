<!-- Source: https://react-spectrum.adobe.com/react-spectrum/TimeField.html -->
<!-- Last fetched: 2026-04-05 -->

# TimeField

TimeFields allow users to enter and edit time values using a keyboard. Each part of the time is displayed in an individually editable segment.

**Added in:** 3.19.0

```tsx
import { TimeField } from "@adobe/react-spectrum";
```

## Usage Examples

### Basic

```jsx
<TimeField label="Event time" />
```

### Controlled / Uncontrolled

```jsx
import { Time } from "@internationalized/date";

function Example() {
  let [value, setValue] = React.useState(new Time(11, 45));
  return (
    <Flex gap="size-150" wrap>
      <TimeField label="Time (uncontrolled)" defaultValue={new Time(11, 45)} />
      <TimeField label="Time (controlled)" value={value} onChange={setValue} />
    </Flex>
  );
}
```

### Time Zone Support

```jsx
import { parseZonedDateTime } from "@internationalized/date";

<TimeField
  label="Event time"
  defaultValue={parseZonedDateTime("2022-11-07T00:45[America/Los_Angeles]")}
/>;
```

### Granularity Control

```jsx
import { parseAbsoluteToLocal } from "@internationalized/date";

<TimeField
  label="Event time"
  granularity="second"
  defaultValue={parseAbsoluteToLocal("2021-04-07T18:45:22Z")}
/>;
```

### HTML Forms

```jsx
<TimeField label="Meeting time" name="meetingTime" />
```

### Validation

```jsx
// Required with native validation
<Form validationBehavior="native" maxWidth="size-3000">
  <TimeField label="Meeting time" name="time" isRequired />
  <ButtonGroup>
    <Button type="submit" variant="primary">Submit</Button>
    <Button type="reset" variant="secondary">Reset</Button>
  </ButtonGroup>
</Form>

// Min/Max values
<TimeField
  label="Meeting time"
  minValue={new Time(9)}
  maxValue={new Time(17)}
  defaultValue={new Time(8)}
/>

// Custom validation
<TimeField
  label="Meeting time"
  validate={(time) => time?.minute % 15 !== 0 ? 'Meetings start every 15 minutes.' : null}
  defaultValue={new Time(9, 25)}
/>
```

### Visual Options

```jsx
// Quiet style
<TimeField label="Event time" isQuiet />

// Disabled
<TimeField label="Event time" isDisabled />

// Read-only
<TimeField label="Event time" value={new Time(11)} isReadOnly />

// Label positioning
<TimeField label="Event time" labelPosition="side" labelAlign="end" />

// Hour cycle override
<TimeField label="Appointment time" hourCycle={24} />

// Hide time zone
<TimeField
  label="Appointment time"
  defaultValue={parseZonedDateTime('2022-11-07T10:45[America/Los_Angeles]')}
  hideTimeZone
/>

// Placeholder value
<TimeField label="Appointment time" placeholderValue={new Time(9)} />
```

## Props API

| Name                      | Type                                                      | Default    | Description                                         |
| ------------------------- | --------------------------------------------------------- | ---------- | --------------------------------------------------- |
| `label`                   | `ReactNode`                                               | --         | Field label                                         |
| `value`                   | `TimeValue \| null`                                       | --         | Controlled value                                    |
| `defaultValue`            | `TimeValue \| null`                                       | --         | Uncontrolled default value                          |
| `name`                    | `string`                                                  | --         | HTML form input name                                |
| `form`                    | `string`                                                  | --         | Associated `<form>` element ID                      |
| `isQuiet`                 | `boolean`                                                 | `false`    | Display with quiet styling                          |
| `hourCycle`               | `12 \| 24`                                                | --         | 12 or 24-hour format; determined by locale if unset |
| `granularity`             | `'hour' \| 'minute' \| 'second'`                          | `'minute'` | Smallest displayable time unit                      |
| `hideTimeZone`            | `boolean`                                                 | --         | Hide time zone abbreviation                         |
| `shouldForceLeadingZeros` | `boolean`                                                 | --         | Always show leading zeros in hour field             |
| `placeholderValue`        | `TimeValue`                                               | --         | Influences placeholder format; defaults to midnight |
| `minValue`                | `TimeValue \| null`                                       | --         | Minimum allowed time                                |
| `maxValue`                | `TimeValue \| null`                                       | --         | Maximum allowed time                                |
| `isDisabled`              | `boolean`                                                 | --         | Disable the input                                   |
| `isReadOnly`              | `boolean`                                                 | --         | Prevent user changes                                |
| `isRequired`              | `boolean`                                                 | --         | Require user input before form submission           |
| `validationBehavior`      | `'aria' \| 'native'`                                      | `'aria'`   | Use native HTML or ARIA validation                  |
| `validationState`         | `'valid' \| 'invalid'`                                    | --         | Visual validation indicator                         |
| `validate`                | `(value) => ValidationError \| true \| null \| undefined` | --         | Custom validation function                          |
| `autoFocus`               | `boolean`                                                 | --         | Receive focus on render                             |
| `description`             | `ReactNode`                                               | --         | Helper text providing hints                         |
| `errorMessage`            | `ReactNode \| (v) => ReactNode`                           | --         | Custom error message                                |
| `labelPosition`           | `'top' \| 'side'`                                         | `'top'`    | Label placement                                     |
| `labelAlign`              | `'start' \| 'end'`                                        | `'start'`  | Label horizontal alignment                          |
| `necessityIndicator`      | `'icon' \| 'label'`                                       | `'icon'`   | Show required state as icon or text                 |
| `contextualHelp`          | `ReactNode`                                               | --         | ContextualHelp element next to label                |

### Accessibility Props

| Name               | Type     | Description                 |
| ------------------ | -------- | --------------------------- |
| `id`               | `string` | Unique element identifier   |
| `aria-label`       | `string` | Accessible label definition |
| `aria-labelledby`  | `string` | ID of labeling element      |
| `aria-describedby` | `string` | ID of describing element    |
| `aria-details`     | `string` | ID of detailed description  |

### Layout/Spacing/Sizing/Positioning Props (abbreviated)

Standard Responsive layout props: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, `justifySelf`, `order`, `gridArea`, `gridColumn`, `gridRow`, etc. Standard spacing: `margin`, `marginTop`, `marginBottom`, `marginStart`, `marginEnd`, `marginX`, `marginY`. Standard sizing: `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight`. Standard positioning: `position`, `top`, `bottom`, `left`, `right`, `start`, `end`, `zIndex`, `isHidden`.

### Advanced Props

| Name               | Type            | Description                  |
| ------------------ | --------------- | ---------------------------- |
| `UNSAFE_className` | `string`        | CSS class name (last resort) |
| `UNSAFE_style`     | `CSSProperties` | Inline styles (last resort)  |

## Events

| Name            | Type                                       | Description                       |
| --------------- | ------------------------------------------ | --------------------------------- |
| `onChange`      | `(value: MappedTimeValue \| null) => void` | Fired when time value changes     |
| `onFocus`       | `(e: FocusEvent) => void`                  | Fired when element receives focus |
| `onBlur`        | `(e: FocusEvent) => void`                  | Fired when element loses focus    |
| `onFocusChange` | `(isFocused: boolean) => void`             | Fired when focus status changes   |
| `onKeyDown`     | `(e: KeyboardEvent) => void`               | Fired when key is pressed         |
| `onKeyUp`       | `(e: KeyboardEvent) => void`               | Fired when key is released        |

## Related Types

- **Time** -- clock time without date (hour 0-23, minute, second, millisecond)
- **CalendarDateTime** -- date and time without time zone
- **ZonedDateTime** -- date and time with time zone (IANA identifier + UTC offset)

### Helper Functions

```javascript
parseTime("04:45:23.123");
parseZonedDateTime("2022-11-07T00:45[America/Los_Angeles]");
parseAbsolute("2021-11-07T07:45:00Z", "America/Los_Angeles");
parseAbsoluteToLocal("2021-11-07T07:45:00Z");
```

## Accessibility

- Provide `label` or `aria-label`
- Each time segment is individually editable via keyboard
- RTL layout automatic
