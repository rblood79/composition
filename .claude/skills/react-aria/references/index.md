# React Aria Components

React Aria Components is a library of unstyled, accessible UI components that you can style with any CSS solution. Built on top of React Aria hooks, it provides the accessibility and behavior without prescribing any visual design.

## Documentation Structure

The `references/` directory contains detailed documentation organized as follows:

### Guides

- [Collections](guides/collections.md): Many components display a collection of items, and provide functionality such as keyboard navigation, and selection. Learn how to load and render collections using React Aria's compositional API.
- [Customization](guides/customization.md): React Aria is built using a flexible and composable API. Learn how to use contexts and slots to create custom component patterns, or mix and match with the lower level Hook-based API for even more control over rendering and behavior.
- [Drag and Drop](guides/dnd.md): React Aria collection components support drag and drop with mouse and touch interactions, and full keyboard and screen reader accessibility. Learn how to provide drag data and handle drop events to move, insert, or reorder items.
- [Forms](guides/forms.md): Learn how to integrate with HTML forms, validate and submit data, and use React Aria with form libraries.
- [Framework setup](guides/frameworks.md): Learn how to integrate React Aria with your framework.
- [Getting started](guides/getting-started.md): How to install React Aria and build your first component.
- [Quality](guides/quality.md): React Aria is built around three core principles: , , and . Learn how to apply these tools to build high quality UIs that work for everyone, everywhere, and on every device.
- [Selection](guides/selection.md): Many collection components support selecting items by clicking or tapping them, or by using the keyboard. Learn how to handle selection events, how to control selection programmatically, and the data structures used to represent a selection.
- [Styling](guides/styling.md): React Aria does not include any styles by default. Learn how to build custom designs to fit your application or design system using any styling solution.
- [Working with AI](guides/ai.md): Learn how to use the React Aria MCP Server, Agent Skills, and more to help you build with AI.

### Components

- [Autocomplete](components/Autocomplete.md): An autocomplete allows users to search or filter a list of suggestions.
- [Breadcrumbs](components/Breadcrumbs.md): Breadcrumbs display a hierarchy of links to the current page or resource in an application.
- [Button](components/Button.md): A button allows a user to perform an action, with mouse, touch, and keyboard interactions.
- [Calendar](components/Calendar.md): A calendar displays one or more date grids and allows users to select a single date. (v1.18.0: multiple date selection; `CalendarHeading`, `CalendarMonthPicker`, `CalendarYearPicker` for month/year navigation)
- [Checkbox](components/Checkbox.md): A checkbox allows a user to select multiple items from a list of individual items, or (v1.18.0: `description` and error message support)
- [CheckboxGroup](components/CheckboxGroup.md): A CheckboxGroup allows users to select one or more items from a list of choices.
- [ColorArea](components/ColorArea.md): A color area allows users to adjust two channels of an RGB, HSL or HSB color value against a two-dimensional gradient background.
- [ColorField](components/ColorField.md): A color field allows users to edit a hex color or individual color channel value.
- [ColorPicker](components/ColorPicker.md): A ColorPicker synchronizes a color value between multiple React Aria color components.
- [ColorSlider](components/ColorSlider.md): A color slider allows users to adjust an individual channel of a color value.
- [ColorSwatch](components/ColorSwatch.md): A ColorSwatch displays a preview of a selected color.
- [ColorSwatchPicker](components/ColorSwatchPicker.md): A ColorSwatchPicker displays a list of color swatches and allows a user to select one of them.
- [ColorWheel](components/ColorWheel.md): A color wheel allows users to adjust the hue of an HSL or HSB color value on a circular track.
- [ComboBox](components/ComboBox.md): A combo box combines a text input with a listbox, allowing users to filter a list of options to items matching a query.
- [DateField](components/DateField.md): A date field allows users to enter and edit date and time values using a keyboard.
- [DatePicker](components/DatePicker.md): A date picker combines a DateField and a Calendar popover to allow users to enter or select a date and time value.
- [DateRangePicker](components/DateRangePicker.md): DateRangePickers combine two DateFields and a RangeCalendar popover to allow users
- [Disclosure](components/Disclosure.md): A disclosure is a collapsible section of content. It is composed of a a header with a heading and trigger button, and a panel that contains the content.
- [DisclosureGroup](components/DisclosureGroup.md): A DisclosureGroup is a grouping of related disclosures, sometimes called an accordion.
- [DropZone](components/DropZone.md): A drop zone is an area into which one or multiple objects can be dragged and dropped.
- [FileTrigger](components/FileTrigger.md): A FileTrigger allows a user to access the file system with any pressable React Aria or React Spectrum component, or custom components built with usePress.
- [Form](components/Form.md): A form is a group of inputs that allows users to submit data to a server,
- [GridList](components/GridList.md): A grid list displays a list of interactive items, with support for keyboard navigation,
- [Group](components/Group.md): A group represents a set of related UI controls, and supports interactive states for styling.
- [Link](components/Link.md): A link allows a user to navigate to another page or resource within a web page
- [ListBox](components/ListBox.md): A listbox displays a list of options and allows a user to select one or more of them.
- [mcp](components/mcp.md)
- [Menu](components/Menu.md): A menu displays a list of actions or options that a user can choose.
- [Meter](components/Meter.md): A meter represents a quantity within a known range, or a fractional value.
- [Modal](components/Modal.md): A modal is an overlay element which blocks interaction with elements outside it.
- [NumberField](components/NumberField.md): A number field allows a user to enter a number, and increment or decrement the value using stepper buttons.
- [Popover](components/Popover.md): A popover is an overlay element positioned relative to a trigger.
- [ProgressBar](components/ProgressBar.md): Progress bars show either determinate or indeterminate progress of an operation
- [RadioGroup](components/RadioGroup.md): A radio group allows a user to select a single item from a list of mutually exclusive options. (v1.18.0: per-Radio `description` and error message support)
- [RangeCalendar](components/RangeCalendar.md): RangeCalendars display a grid of days in one or more months and allow users to select a contiguous range of dates. (v1.18.0: dynamic available dates based on the first selected date)
- [SearchField](components/SearchField.md): A search field allows a user to enter and clear a search query.
- [Select](components/Select.md): A select displays a collapsible list of options and allows a user to select one of them.
- [Separator](components/Separator.md): A separator is a visual divider between two groups of content, e.g. groups of menu items or sections of a page.
- [Slider](components/Slider.md): A slider allows a user to select one or more values within a range. (v1.18.0: `SliderFill` component for styling the filled track portion)
- [Switch](components/Switch.md): A switch allows a user to turn a setting on or off. (v1.18.0: `description` and error message support)
- [Table](components/Table.md): A table displays data in rows and columns and enables a user to navigate its contents via directional navigation keys, (v1.18.0: `TableFooter` component for footer rows)
- [Tabs](components/Tabs.md): Tabs organize content into multiple sections and allow users to navigate between them.
- [TagGroup](components/TagGroup.md): A tag group is a focusable list of labels, categories, keywords, filters, or other items, with support for keyboard navigation, selection, and removal.
- [TextField](components/TextField.md): A text field allows a user to enter a plain text value with a keyboard.
- [TimeField](components/TimeField.md): TimeFields allow users to enter and edit time values using a keyboard.
- [Toast](components/Toast.md)
- [ToggleButton](components/ToggleButton.md): A toggle button allows a user to toggle a selection on or off, for example switching between two states or modes.
- [ToggleButtonGroup](components/ToggleButtonGroup.md): A toggle button group allows a user to toggle multiple options, with single or multiple selection.
- [Toolbar](components/Toolbar.md): A toolbar is a container for a set of interactive controls, such as buttons, dropdown menus, or checkboxes,
- [Tooltip](components/Tooltip.md): A tooltip displays a description of an element on hover or focus.
- [Tree](components/Tree.md): A tree provides users with a way to navigate nested hierarchical information, with support for keyboard navigation
- [Virtualizer](components/Virtualizer.md): A Virtualizer renders a scrollable collection of data using customizable layouts.

### Interactions

- [FocusRing](interactions/FocusRing.md): A utility component that applies a CSS class when an element has keyboard focus.
- [FocusScope](interactions/FocusScope.md): A FocusScope manages focus for its descendants. It supports containing focus inside
- [useClipboard](interactions/useClipboard.md): Handles clipboard interactions for a focusable element. Supports items of multiple
- [useDrag](interactions/useDrag.md): Handles drag interactions for an element, with support for traditional mouse and touch
- [useDrop](interactions/useDrop.md): Handles drop interactions for an element, with support for traditional mouse and touch
- [useFocus](interactions/useFocus.md): Handles focus events for the immediate target.
- [useFocusRing](interactions/useFocusRing.md): Determines whether a focus ring should be shown to indicate keyboard focus.
- [useFocusVisible](interactions/useFocusVisible.md): Manages focus visible state for the page, and subscribes individual components for updates.
- [useFocusWithin](interactions/useFocusWithin.md): Handles focus events for the target and its descendants.
- [useHover](interactions/useHover.md): Handles pointer hover interactions for an element. Normalizes behavior
- [useKeyboard](interactions/useKeyboard.md): Handles keyboard interactions for a focusable element.
- [useLandmark](interactions/useLandmark.md): Provides landmark navigation in an application. Call this with a role and label to register a landmark navigable with F6.
- [useLongPress](interactions/useLongPress.md): Handles long press interactions across mouse and touch devices. Supports a customizable time threshold,
- [useMove](interactions/useMove.md): Handles move interactions across mouse, touch, and keyboard, including dragging with
- [usePress](interactions/usePress.md): Handles press interactions across mouse, touch, keyboard, and screen readers.

### Utilities

- [I18nProvider](utilities/I18nProvider.md): Provides the locale for the application to all child components.
- [mergeProps](utilities/mergeProps.md): Merges multiple props objects together. Event handlers are chained,
- [PortalProvider](utilities/PortalProvider.md): Sets the portal container for all overlay elements rendered by its children.
- [SSRProvider](utilities/SSRProvider.md): When using SSR with React Aria in React 16 or 17, applications must be wrapped in an SSRProvider.
- [useCollator](utilities/useCollator.md): Provides localized string collation for the current locale. Automatically updates when the locale changes,
- [useDateFormatter](utilities/useDateFormatter.md): Provides localized date formatting for the current locale. Automatically updates when the locale changes,
- [useField](utilities/useField.md): Provides the accessibility implementation for input fields.
- [useFilter](utilities/useFilter.md): Provides localized string search functionality that is useful for filtering or matching items
- [useId](utilities/useId.md): If a default is not provided, generate an id.
- [useIsSSR](utilities/useIsSSR.md): Returns whether the component is currently being server side rendered or
- [useLabel](utilities/useLabel.md): Provides the accessibility implementation for labels and their associated elements.
- [useLocale](utilities/useLocale.md): Returns the current locale and layout direction.
- [useNumberFormatter](utilities/useNumberFormatter.md): Provides localized number formatting for the current locale. Automatically updates when the locale changes,
- [useObjectRef](utilities/useObjectRef.md): Offers an object ref for a given callback ref or an object ref. Especially
- [VisuallyHidden](utilities/VisuallyHidden.md): VisuallyHidden hides its children visually, while keeping content visible

### Internationalization

- [Calendar](internationalized/date/Calendar.md)
- [CalendarDate](internationalized/date/CalendarDate.md)
- [CalendarDateTime](internationalized/date/CalendarDateTime.md)
- [DateFormatter](internationalized/date/DateFormatter.md)
- [Internationalized Date](internationalized/date/index.md)
- [Internationalized Number](internationalized/number/index.md)
- [NumberFormatter](internationalized/number/NumberFormatter.md)
- [NumberParser](internationalized/number/NumberParser.md)
- [Time](internationalized/date/Time.md)
- [ZonedDateTime](internationalized/date/ZonedDateTime.md)

### Testing

- [Testing CheckboxGroup](testing/CheckboxGroup/testing.md)
- [Testing ComboBox](testing/ComboBox/testing.md)
- [Testing GridList](testing/GridList/testing.md)
- [Testing ListBox](testing/ListBox/testing.md)
- [Testing Menu](testing/Menu/testing.md)
- [Testing RadioGroup](testing/RadioGroup/testing.md)
- [Testing Select](testing/Select/testing.md)
- [Testing Table](testing/Table/testing.md)
- [Testing Tabs](testing/Tabs/testing.md)
- [Testing Tree](testing/Tree/testing.md)
