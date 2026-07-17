import React, { lazy } from "react";

// Component map definition (code splitting)

export const componentMap: Record<
  string,
  React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>>
> = {
  Button: lazy(() =>
    import("@composition/shared/components/Button").then((module) => ({
      default: module.Button,
    })),
  ),
  TextField: lazy(() =>
    import("@composition/shared/components/TextField").then((module) => ({
      default: module.TextField,
    })),
  ),
  Checkbox: lazy(() =>
    import("@composition/shared/components/Checkbox").then((module) => ({
      default: module.Checkbox,
    })),
  ),
  CheckboxGroup: lazy(() =>
    import("@composition/shared/components/CheckboxGroup").then((module) => ({
      default: module.CheckboxGroup,
    })),
  ),
  Radio: lazy(() =>
    import("@composition/shared/components/Radio").then((module) => ({
      default: module.Radio as unknown as React.ComponentType<
        Record<string, unknown>
      >,
    })),
  ),
  RadioGroup: lazy(() =>
    import("@composition/shared/components/RadioGroup").then((module) => ({
      default: module.RadioGroup,
    })),
  ),
  Select: lazy(() =>
    import("@composition/shared/components/Select").then((module) => ({
      default: module.Select,
    })),
  ),
  ComboBox: lazy(() =>
    import("@composition/shared/components/ComboBox").then((module) => ({
      default: module.ComboBox,
    })),
  ),
  ListBox: lazy(() =>
    import("@composition/shared/components/ListBox").then((module) => ({
      default: module.ListBox,
    })),
  ),
  GridList: lazy(() =>
    import("@composition/shared/components/GridList").then((module) => ({
      default: module.GridList,
    })),
  ),
  Tree: lazy(() =>
    import("@composition/shared/components/Tree").then((module) => ({
      default: module.Tree,
    })),
  ),
  Table: lazy(
    () =>
      import("@composition/shared/components/Table") as unknown as Promise<{
        default: React.ComponentType<Record<string, unknown>>;
      }>,
  ),
  Tabs: lazy(() =>
    import("@composition/shared/components/Tabs").then((module) => ({
      default: module.Tabs,
    })),
  ),
  Dialog: lazy(() =>
    import("@composition/shared/components/Dialog").then((module) => ({
      default: module.Dialog,
    })),
  ),
  Modal: lazy(() =>
    import("@composition/shared/components/Modal").then((module) => ({
      default: module.Modal,
    })),
  ),
  Popover: lazy(() =>
    import("@composition/shared/components/Popover").then((module) => ({
      default: module.Popover as unknown as React.ComponentType<
        Record<string, unknown>
      >,
    })),
  ),
  ToggleButton: lazy(() =>
    import("@composition/shared/components/ToggleButton").then((module) => ({
      default: module.ToggleButton,
    })),
  ),
  ToggleButtonGroup: lazy(() =>
    import("@composition/shared/components/ToggleButtonGroup").then(
      (module) => ({ default: module.ToggleButtonGroup }),
    ),
  ),
  TagGroup: lazy(() =>
    import("@composition/shared/components/TagGroup").then((module) => ({
      default: module.TagGroup,
    })),
  ),
  Form: lazy(() =>
    import("@composition/shared/components/Form").then((module) => ({
      default: module.Form,
    })),
  ),
  FieldGroup: lazy(() =>
    import("@composition/shared/components/Field").then((module) => ({
      default: module.FieldGroup,
    })),
  ),
  Label: lazy(() =>
    import("@composition/shared/components/Field").then((module) => ({
      default: module.Label,
    })),
  ),
  Input: lazy(() =>
    import("@composition/shared/components/Field").then((module) => ({
      default: module.Input,
    })),
  ),
  DateField: lazy(() =>
    import("@composition/shared/components/DateField").then((module) => ({
      default: module.DateField,
    })),
  ),
  DatePicker: lazy(() =>
    import("@composition/shared/components/DatePicker").then((module) => ({
      default: module.DatePicker,
    })),
  ),
  DateRangePicker: lazy(() =>
    import("@composition/shared/components/DateRangePicker").then((module) => ({
      default: module.DateRangePicker,
    })),
  ),
  TimeField: lazy(() =>
    import("@composition/shared/components/TimeField").then((module) => ({
      default: module.TimeField,
    })),
  ),
  Switch: lazy(() =>
    import("@composition/shared/components/Switch").then((module) => ({
      default: module.Switch as unknown as React.ComponentType<
        Record<string, unknown>
      >,
    })),
  ),
  Slider: lazy(() =>
    import("@composition/shared/components/Slider").then((module) => ({
      default: module.Slider,
    })),
  ),
  Calendar: lazy(() =>
    import("@composition/shared/components/Calendar").then((module) => ({
      default: module.Calendar,
    })),
  ),
  Card: lazy(() =>
    import("@composition/shared/components/Card").then((module) => ({
      default: module.Card,
    })),
  ),
  NumberField: lazy(() =>
    import("@composition/shared/components/NumberField").then((module) => ({
      default: module.NumberField,
    })),
  ),
  SearchField: lazy(() =>
    import("@composition/shared/components/SearchField").then((module) => ({
      default: module.SearchField,
    })),
  ),
  Menu: lazy(() =>
    import("@composition/shared/components/Menu").then((module) => ({
      default: module.MenuButton,
    })),
  ),
  Tooltip: lazy(() =>
    import("@composition/shared/components/Tooltip").then((module) => ({
      default: module.Tooltip,
    })),
  ),
  ProgressBar: lazy(() =>
    import("@composition/shared/components/ProgressBar").then((module) => ({
      default: module.ProgressBar,
    })),
  ),
  Meter: lazy(() =>
    import("@composition/shared/components/Meter").then((module) => ({
      default: module.Meter,
    })),
  ),
  Toolbar: lazy(() =>
    import("@composition/shared/components/Toolbar").then((module) => ({
      default: module.Toolbar,
    })),
  ),
  Separator: lazy(() =>
    import("@composition/shared/components/Separator").then((module) => ({
      default: module.Separator,
    })),
  ),
};
