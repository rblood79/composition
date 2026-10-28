import { CalendarCog } from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import { readTargetProp } from "../../../../../../../packages/shared/src/catalog/resolution/fieldSource";
import {
  catalogCalendarHeaderCommand,
  catalogCalendarHeaderMode,
  catalogCalendarPickerPropCommand,
  catalogCalendarPickerTargets,
} from "../../../catalogRuntime/calendarHeader";
import { catalogSemanticContracts } from "../../../catalogRuntime/editContract";
import { catalogPaletteDefinitionId } from "../../../catalogRuntime/paletteInsert";
import {
  useCatalogStepReading,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { PropertyNumberInput } from "../../../components/property/PropertyNumberInput";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { PropertySwitch } from "../../../components/property/PropertySwitch";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";

/** RAC's month picker without `format` (`CalendarMonthPicker` — short; no default stored). */
const DEFAULT_MONTH_FORMAT = "short";

/**
 * ADR-256 Phase 9: a Calendar · RangeCalendar's month · year pickers in the Content section
 * (injected through `contentExtras`) — one switch puts RAC's pickers in the heading's place or
 * brings the heading back (`catalogRuntime/calendarHeader.ts`, one step each way; the value is
 * the header's children, not a prop). While on, the pickers' own props (`format` ·
 * `visibleYears` — their bindings' accepts) are edited here on every shown picker.
 */
export const CatalogCalendarHeaderField = memo(
  function CatalogCalendarHeaderField({ elementId }: { elementId: string }) {
    const workspace = useCatalogWorkspace();
    const run = useCatalogCommandRunner();
    const graph = workspace.runtime.graph;
    const view = useCatalogStepReading(
      workspace,
      (): {
        mode?: "heading" | "pickers";
        format?: unknown;
        visibleYears?: unknown;
        hasMonth?: boolean;
        hasYear?: boolean;
      } => {
        const calendar = workspace.positionOfRecord(elementId);
        const mode = catalogCalendarHeaderMode(graph, calendar);
        if (mode !== "pickers") return { mode };
        const pickers = catalogCalendarPickerTargets(graph, calendar);
        const read = (targets: readonly unknown[], key: string) => {
          const target = targets[0] as Parameters<typeof readTargetProp>[1];
          if (!target) return undefined;
          try {
            return readTargetProp(graph, target, key);
          } catch {
            return undefined;
          }
        };
        return {
          mode,
          format: read(pickers.CalendarMonthPicker, "format"),
          visibleYears: read(pickers.CalendarYearPicker, "visibleYears"),
          hasMonth: pickers.CalendarMonthPicker.length > 0,
          hasYear: pickers.CalendarYearPicker.length > 0,
        };
      },
    );
    // The pickers' own fields (their edit contracts — the one source of the choices and defaults).
    const { formatOptions, defaultYears } = useMemo(() => {
      const contract = (type: string) =>
        catalogSemanticContracts(
          catalogPaletteDefinitionId(graph.library, type),
          type,
        );
      const format = contract("CalendarMonthPicker").format as
        { options?: readonly { value: string; label: string }[] } | undefined;
      const years = contract("CalendarYearPicker").visibleYears as
        { default?: unknown } | undefined;
      return {
        formatOptions: format?.options ?? [],
        defaultYears:
          typeof years?.default === "number" ? years.default : undefined,
      };
    }, [graph]);

    const toggle = useCallback(
      (on: boolean) => {
        const calendar = workspace.positionOfRecord(elementId);
        const current = catalogCalendarHeaderMode(graph, calendar);
        const next = on ? "pickers" : "heading";
        if (!calendar || !current || current === next) return;
        run(
          catalogCalendarHeaderCommand(graph, calendar, next, workspace.newId),
        );
      },
      [elementId, graph, run, workspace],
    );
    const pickerTargets = useCallback(
      () =>
        catalogCalendarPickerTargets(
          graph,
          workspace.positionOfRecord(elementId),
        ),
      [elementId, graph, workspace],
    );
    const setFormat = useCallback(
      (value: string) => {
        const targets = pickerTargets().CalendarMonthPicker;
        if (!value || !targets.length) return;
        run(catalogCalendarPickerPropCommand(targets, "format", value));
      },
      [pickerTargets, run],
    );
    const setVisibleYears = useCallback(
      (value: number | undefined) => {
        const targets = pickerTargets().CalendarYearPicker;
        if (!targets.length) return;
        const years =
          value !== undefined && Number.isSafeInteger(value) && value >= 1
            ? value
            : undefined;
        run(catalogCalendarPickerPropCommand(targets, "visibleYears", years));
      },
      [pickerTargets, run],
    );

    if (!view.mode) return null;
    return (
      <>
        <div className="fieldset-row" data-wide="true">
          <PropertySwitch
            label="Month and Year Pickers"
            icon={CalendarCog}
            isSelected={view.mode === "pickers"}
            onChange={toggle}
          />
        </div>
        {view.hasMonth && (
          <div className="fieldset-row" data-wide="true">
            <PropertySelect
              label="Month Format"
              value={
                typeof view.format === "string"
                  ? view.format
                  : DEFAULT_MONTH_FORMAT
              }
              options={formatOptions}
              onChange={setFormat}
            />
          </div>
        )}
        {view.hasYear && (
          <div className="fieldset-row" data-wide="true">
            <PropertyNumberInput
              label="Visible Years"
              value={
                typeof view.visibleYears === "number"
                  ? view.visibleYears
                  : defaultYears
              }
              min={1}
              step={1}
              onChange={setVisibleYears}
            />
          </div>
        )}
      </>
    );
  },
);
