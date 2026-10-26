import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { Autocomplete } from "react-aria-components/Autocomplete";
import { Button as RACButton } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Header } from "react-aria-components/Header";
import {
  ListBox,
  ListBoxItem,
  ListBoxSection,
} from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import { ListLayout, Virtualizer } from "react-aria-components/Virtualizer";
import { useFilter } from "react-aria-components";
import { ChevronDown, Crosshair } from "lucide-react";
import { useI18n } from "@/i18n";
import type { CatalogTargetOption } from "../../../catalogRuntime/interactions";
import { SearchField } from "../../../components/ui/SearchField";
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
  const options = useMemo<CatalogTargetOption[]>(
    () => (open ? readOptions() : []),
    // (Read when it opens: the page's places now.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );
  const labels = useMemo(() => catalogTargetLabels(options), [options]);
  const byKey = useMemo(
    () => new Map(options.map((option) => [option.key, option])),
    [options],
  );
  const { contains } = useFilter({ sensitivity: "base" });
  const virtualized = options.length > TARGET_PICKER_VIRTUALIZE_AT;
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) onHover(undefined);
  };
  const list = (
    <ListBox
      className="react-aria-ListBox interactions-target-list"
      data-virtualized={virtualized || undefined}
      aria-label={label}
      selectionMode="none"
      onAction={(key) => {
        const option = byKey.get(String(key));
        changeOpen(false);
        if (option) onPick(option);
      }}
    >
      {GROUPS.map((group) => {
        const items = options.filter((option) => option.group === group);
        return items.length ? (
          <ListBoxSection key={group} id={group}>
            <Header className="interactions-target-header">
              {t(GROUP_LABEL[group])}
            </Header>
            {items.map((option) => (
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
          </ListBoxSection>
        ) : null;
      })}
    </ListBox>
  );
  return (
    <fieldset
      className="properties-aria interactions-target-field"
      data-label-mode="legend"
    >
      <legend className="fieldset-legend">{label}</legend>
      <div className="react-aria-control react-aria-Group interactions-target-control">
        <DialogTrigger isOpen={open} onOpenChange={changeOpen}>
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
          <Popover
            className="react-aria-Popover property-select-popover interactions-target-popover"
            placement="bottom start"
          >
            <Dialog className="interactions-target-dialog" aria-label={label}>
              <Autocomplete filter={contains}>
                <SearchField
                  appearance="control"
                  autoFocus
                  placeholder={t("interactions.targetSearch")}
                  aria-label={t("interactions.targetSearch")}
                />
                {virtualized ? (
                  <Virtualizer
                    layout={ListLayout}
                    layoutOptions={{ rowHeight: 28, headingHeight: 24 }}
                  >
                    {list}
                  </Virtualizer>
                ) : (
                  list
                )}
              </Autocomplete>
            </Dialog>
          </Popover>
        </DialogTrigger>
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
