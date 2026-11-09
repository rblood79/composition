import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button as RACButton } from "react-aria-components/Button";
import { ListBoxItem } from "react-aria-components/ListBox";
import { ChevronDown, Crosshair } from "lucide-react";
import { useI18n } from "@/i18n";
import type { CatalogTargetOption } from "../../../catalogRuntime/interactions";
import {
  SearchablePicker,
  SearchablePickerSection,
} from "../../../components/property/SearchablePicker";
import "./CatalogTargetPicker.css";

/** ADR-283 G2 — past this many candidates the list draws only the rows in view (RAC Virtualizer). */
export const TARGET_PICKER_VIRTUALIZE_AT = 50;
const GROUPS = ["page", "component"] as const;
const GROUP_LABEL = {
  page: "interactions.targetGroupPage",
  component: "interactions.targetGroupComponent",
} as const;

/** An option's name: its instance chain (`OrderCard ▸ Save`), else `name (type)`, else type. */
const baseLabel = (option: CatalogTargetOption) =>
  option.path.length > 1
    ? option.path.join(" ▸ ")
    : option.name
      ? `${option.name} (${option.type})`
      : option.type;

/**
 * ADR-283 Decision 4 — every option's label. `#` is the element's DOM id (Accessibility ID — the
 * `id=""` the Preview renders): a page node's own after its name (`Save (Button) #button_1`), a
 * place inside an instance's on the instance (`OrderCard #ordercard_1 ▸ Save`). Without a DOM id,
 * a label that repeats in the list, or an unnamed node's, takes the id's short tail (`· a1b2`).
 */
export function catalogTargetLabels(
  options: readonly CatalogTargetOption[],
): Map<string, string> {
  const named = (option: CatalogTargetOption) =>
    !option.htmlId
      ? baseLabel(option)
      : option.path.length > 1
        ? [`${option.path[0]} #${option.htmlId}`, ...option.path.slice(1)].join(
            " ▸ ",
          )
        : `${baseLabel(option)} #${option.htmlId}`;
  const counts = new Map<string, number>();
  for (const option of options) {
    const label = named(option);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return new Map(
    options.map((option) => {
      const label = named(option);
      return [
        option.key,
        !option.htmlId &&
        ((counts.get(label) ?? 0) > 1 ||
          (!option.name && option.path.length < 2))
          ? `${label} · ${option.shortId}`
          : label,
      ];
    }),
  );
}

/** A row reporting virtual focus (the search field keeps DOM focus — arrows move `isFocused`). */
function FocusReport({
  focused,
  onFocus,
  children,
}: {
  focused: boolean;
  onFocus: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (focused) onFocus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report on the focus change only
  }, [focused]);
  return <>{children}</>;
}

/**
 * ADR-283 Decision 4 — a capability rule's target field: the current target (or 「대상 없음」),
 * a searchable list of the places in groups (「이 페이지」 · 「컴포넌트 안」 — read when it opens),
 * and the Canvas pick button (Decision 5). Hover · focus in the list highlights the place on the
 * Canvas (`onHover`); the Canvas hover marks its row (`canvasHoverKey`).
 */
export const CatalogTargetPicker = memo(function CatalogTargetPicker({
  label,
  value,
  options: readOptions,
  onPick,
  onHover,
  canvasHoverKey,
  onAim,
  aiming,
}: {
  label: string;
  /** The current target's text (`undefined` = no target). */
  value: string | undefined;
  options: () => CatalogTargetOption[];
  onPick: (option: CatalogTargetOption) => void;
  onHover: (option: CatalogTargetOption | undefined) => void;
  canvasHoverKey?: string;
  onAim?: () => void;
  aiming?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<CatalogTargetOption[]>([]);
  const labels = useMemo(() => catalogTargetLabels(options), [options]);
  const byKey = useMemo(
    () => new Map(options.map((option) => [option.key, option])),
    [options],
  );
  const virtualized = options.length > TARGET_PICKER_VIRTUALIZE_AT;
  const changeOpen = (next: boolean) => {
    if (next && !open) setOptions(readOptions());
    setOpen(next);
    if (!next) onHover(undefined);
  };
  return (
    <fieldset
      className="properties-aria interactions-target-field"
      data-label-mode="legend"
    >
      <legend className="fieldset-legend">{label}</legend>
      <div className="react-aria-control react-aria-Group interactions-target-control">
        <SearchablePicker
          label={label}
          searchLabel={t("interactions.targetSearch")}
          open={open}
          onOpenChange={changeOpen}
          popoverClassName="interactions-target-popover"
          listClassName="interactions-target-list"
          virtualized={virtualized}
          onAction={(key) => {
            const option = byKey.get(String(key));
            changeOpen(false);
            if (option) onPick(option);
          }}
          trigger={
            <RACButton
              className="react-aria-Button interactions-target-trigger"
              aria-label={`${label}: ${value ?? t("interactions.targetUnset")}`}
            >
              <span
                className="interactions-target-value"
                data-unset={value === undefined || undefined}
              >
                {value ?? t("interactions.targetUnset")}
              </span>
              <ChevronDown aria-hidden="true" size={12} />
            </RACButton>
          }
        >
          {GROUPS.map((group) => (
            <SearchablePickerSection
              key={group}
              id={group}
              title={t(GROUP_LABEL[group])}
            >
              {options
                .filter((option) => option.group === group)
                .map((option) => (
                  <ListBoxItem
                    key={option.key}
                    id={option.key}
                    textValue={labels.get(option.key)}
                    className="react-aria-ListBoxItem"
                    data-canvas-hover={
                      canvasHoverKey === option.key ? true : undefined
                    }
                    onHoverStart={() => onHover(option)}
                  >
                    {({ isFocused }) => (
                      <FocusReport
                        focused={isFocused}
                        onFocus={() => onHover(option)}
                      >
                        {labels.get(option.key)}
                      </FocusReport>
                    )}
                  </ListBoxItem>
                ))}
            </SearchablePickerSection>
          ))}
        </SearchablePicker>
        {onAim && (
          <RACButton
            className="react-aria-Button interactions-target-aim"
            aria-label={t("interactions.targetAim")}
            aria-pressed={aiming}
            data-active={aiming || undefined}
            onPress={onAim}
          >
            <Crosshair aria-hidden="true" size={14} />
          </RACButton>
        )}
      </div>
    </fieldset>
  );
});
