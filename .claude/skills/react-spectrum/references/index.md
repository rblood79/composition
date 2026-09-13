# React Spectrum 공식 Props API

react-spectrum.adobe.com 공식 문서 기반의 컴포넌트 Props 레퍼런스.
S2 패키지 소스가 아닌 **공식 문서 Props 테이블**이 단일 소스.

> **주의**: Props 목록은 S2 명시 props + React Aria 상속 props 모두 포함.
> 로컬 references가 공식 문서와 다를 경우, `WebFetch react-spectrum.adobe.com/react-spectrum/{Component}.html`로 최신 확인.

## Documentation Structure

The `references/` directory contains detailed documentation organized as follows:

### Guides

- [Collections](guides/collections.md): Many components display a collection of items, and provide functionality such as keyboard navigation, and selection. Learn how to load and render collections using React Spectrum's compositional API.
- [Forms](guides/forms.md): Learn how to integrate with HTML forms, validate and submit data, and use React Spectrum with form libraries.
- [Getting started](guides/getting-started.md): ## Installation
- [Migrating to Spectrum 2](guides/migrating.md): Learn how to migrate from React Spectrum v3 to Spectrum 2.
- [Selection](guides/selection.md): Many collection components support selecting items by clicking or tapping them, or by using the keyboard. Learn how to handle selection events, how to control selection programmatically, and the data structures used to represent a selection.
- [Style Macro](guides/style-macro.md): The macro supports a constrained set of values per property that conform to Spectrum 2.
- [Styling](guides/styling.md): Learn how to use the macro to apply Spectrum tokens directly in your components with type-safe autocompletion.
- [Working with AI](guides/ai.md): Learn how to use the React Spectrum MCP Server, Agent Skills, and more to help you build with AI.

### Components

- [Accordion](components/Accordion.md): An accordion is a container for multiple accordion items.
- [ActionBar](components/ActionBar.md): Action bars are used for single and bulk selection patterns when a user needs to perform actions on one or more items at the same time.
- [ActionButton](components/ActionButton.md): ActionButtons allow users to perform an action.
- [ActionButtonGroup](components/ActionButtonGroup.md): An ActionButtonGroup is a grouping of related ActionButtons.
- [ActionMenu](components/ActionMenu.md): ActionMenu combines an ActionButton with a Menu for simple "more actions" use cases.
- [Avatar](components/Avatar.md): An avatar is a thumbnail representation of an entity, such as a user or an organization.
- [AvatarGroup](components/AvatarGroup.md): An avatar group is a grouping of avatars that are related to each other.
- [Badge](components/Badge.md): Badges are used for showing a small amount of color-categorized metadata, ideal for getting a user's attention.
- [Breadcrumbs](components/Breadcrumbs.md): Breadcrumbs show hierarchy and navigational context for a user's location within an application.
- [Button](components/Button.md): Buttons allow users to perform an action.
- [ButtonGroup](components/ButtonGroup.md): ButtonGroup handles overflow for a grouping of buttons whose actions are related to each other.
- [Calendar](components/Calendar.md): Calendars display a grid of days in one or more months and allow users to select a single date. (S2 v1.4.0: multiple date selection)
- [Card](components/Card.md): A Card summarizes an object that a user can select or navigate to.
- [CardView](components/CardView.md): A CardView displays a group of related objects, with support for selection and bulk actions.
- [Checkbox](components/Checkbox.md): Checkboxes allow users to select multiple items from a list of individual items, (S2 v1.4.0: description/error message)
- [CheckboxGroup](components/CheckboxGroup.md): A CheckboxGroup allows users to select one or more items from a list of choices.
- [ColorArea](components/ColorArea.md): A ColorArea allows users to adjust two channels of an RGB, HSL or HSB color value against a two-dimensional gradient background.
- [ColorField](components/ColorField.md): A color field allows users to edit a hex color or individual color channel value.
- [ColorSlider](components/ColorSlider.md): A ColorSlider allows users to adjust an individual channel of a color value.
- [ColorSwatch](components/ColorSwatch.md): A ColorSwatch displays a preview of a selected color.
- [ColorSwatchPicker](components/ColorSwatchPicker.md): A ColorSwatchPicker displays a list of color swatches and allows a user to select one of them.
- [ColorWheel](components/ColorWheel.md): A ColorWheel allows users to adjust the hue of an HSL or HSB color value on a circular track.
- [ComboBox](components/ComboBox.md): ComboBox allow users to choose a single option from a collapsible list of options when space is limited. (S2 v1.4.0: custom prefix)
- [ContextualHelp](components/ContextualHelp.md): Contextual help shows a user extra information about the state of an adjacent component, or a total view.
- [DateField](components/DateField.md): DateFields allow users to enter and edit date and time values using a keyboard.
- [DatePicker](components/DatePicker.md): DatePickers combine a DateField and a Calendar popover to allow users to enter or select a date and time value.
- [DateRangePicker](components/DateRangePicker.md): DateRangePickers combine two DateFields and a RangeCalendar popover to allow users
- [Dialog](components/Dialog.md): Dialogs are windows containing contextual information, tasks, or workflows that appear over the user interface.
- [Disclosure](components/Disclosure.md): A disclosure is a collapsible section of content. It is composed of a header with a heading and trigger button, and a panel that contains the content.
- [Divider](components/Divider.md): Dividers bring clarity to a layout by grouping and dividing content in close proximity.
- [DropZone](components/DropZone.md): A drop zone is an area into which one or multiple objects can be dragged and dropped.
- [Form](components/Form.md): Forms allow users to enter data that can be submitted while providing alignment and styling for form fields.
- [Icons](components/icons.md): React Spectrum offers a set of open source icons that can be imported from .
- [IllustratedMessage](components/IllustratedMessage.md): An IllustratedMessage displays an illustration and a message, usually
- [Illustrations](components/illustrations.md): React Spectrum offers a collection of illustrations that can be imported from .
- [Image](components/Image.md): An image with support for skeleton loading and custom error states.
- [InlineAlert](components/InlineAlert.md): Inline alerts display a non-modal message associated with objects in a view.
- [LabeledValue](components/LabeledValue.md): A LabeledValue displays a non-editable value with a label. It formats numbers, dates, times, and other values. (S2 v1.4.0 신규)
- [Link](components/Link.md): Links allow users to navigate to a different location.
- [LinkButton](components/LinkButton.md): A LinkButton combines the functionality of a link with the appearance of a button. Useful for allowing users to navigate to another page.
- [ListView](components/ListView.md): A ListView displays a list of interactive items, and allows a user to navigate, select, or perform actions on them. (S2 v1.2.0 신규; v1.4.0 drag and drop 지원)
- [mcp](components/mcp.md)
- [Menu](components/Menu.md): Menus display a list of actions or options that a user can choose.
- [Meter](components/Meter.md): Meters are visual representations of a quantity or an achievement.
- [NumberField](components/NumberField.md): NumberFields allow users to input number values with a keyboard or increment/decrement with step buttons.
- [Picker](components/Picker.md): Pickers allow users to choose a single option from a collapsible list of options when space is limited.
- [Popover](components/Popover.md): A popover is an overlay element positioned relative to a trigger.
- [ProgressBar](components/ProgressBar.md): ProgressBars show the progression of a system operation: downloading, uploading, processing, etc., in a visual way.
- [ProgressCircle](components/ProgressCircle.md): ProgressCircles show the progression of a system operation such as downloading, uploading, or processing, in a visual way.
- [Provider](components/Provider.md): Provider is the container for all React Spectrum components.
- [RadioGroup](components/RadioGroup.md): Radio groups allow users to select a single option from a list of mutually exclusive options. (S2 v1.4.0: per-Radio description/error message)
- [RangeCalendar](components/RangeCalendar.md): RangeCalendars display a grid of days in one or more months and allow users to select a contiguous range of dates.
- [RangeSlider](components/RangeSlider.md): RangeSliders allow users to quickly select a subset range. They should be used when the upper and lower bounds to the range are invariable.
- [SearchField](components/SearchField.md): A SearchField is a text field designed for searches.
- [SegmentedControl](components/SegmentedControl.md): A SegmentedControl is a mutually exclusive group of buttons used for view switching.
- [SelectBoxGroup](components/SelectBoxGroup.md): SelectBoxGroup allows users to select one or more options from a list.
- [Skeleton](components/Skeleton.md): A Skeleton wraps around content to render it as a placeholder.
- [Slider](components/Slider.md): Sliders allow users to quickly select a value within a range. They should be used when the upper and lower bounds to the range are invariable.
- [StatusLight](components/StatusLight.md): Status lights are used to color code categories and labels commonly found in data visualization.
- [Switch](components/Switch.md): Switches allow users to turn an individual option on or off. (S2 v1.4.0: description/error message)
- [TableView](components/TableView.md): Tables are containers for displaying information. They allow users to quickly scan, sort, compare, and take action on large amounts of data. (S2 v1.4.0: drag and drop, highlight selection, `TableFooter`)
- [Tabs](components/Tabs.md): Tabs organize content into multiple sections and allow users to navigate between them. The content under the set of tabs should be related and form a coherent unit.
- [TagGroup](components/TagGroup.md): Tags allow users to categorize content. They can represent keywords or people, and are grouped to describe an item or a search request.
- [TextArea](components/TextArea.md): A textarea allows a user to input mult-line text.
- [TextField](components/TextField.md): TextFields are text inputs that allow users to input custom text entries (S2 v1.4.0: custom prefix)
- [TimeField](components/TimeField.md): TimeFields allow users to enter and edit time values using a keyboard.
- [Toast](components/Toast.md): A ToastContainer renders the queued toasts in an application. It should be placed
- [ToggleButton](components/ToggleButton.md): ToggleButtons allow users to toggle a selection on or off, for example
- [ToggleButtonGroup](components/ToggleButtonGroup.md): A ToggleButtonGroup is a grouping of related ToggleButtons, with single or multiple selection.
- [Tooltip](components/Tooltip.md): Display container for Tooltip content. Has a directional arrow dependent on its placement.
- [TreeView](components/TreeView.md): A tree view provides users with a way to navigate nested hierarchical information. (S2 v1.4.0: drag and drop)

### Testing

- [Testing CheckboxGroup](testing/CheckboxGroup/testing.md)
- [Testing ComboBox](testing/ComboBox/testing.md)
- [Testing Dialog](testing/Dialog/testing.md)
- [Testing Menu](testing/Menu/testing.md)
- [Testing Picker](testing/Picker/testing.md)
- [Testing RadioGroup](testing/RadioGroup/testing.md)
- [Testing TableView](testing/TableView/testing.md)
- [Testing Tabs](testing/Tabs/testing.md)
- [Testing TreeView](testing/TreeView/testing.md)
