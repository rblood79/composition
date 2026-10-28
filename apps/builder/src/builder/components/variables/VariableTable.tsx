/**
 * VariableTable — ADR-288 Decision 3: the one table every variable owner edits in. The Data panel
 * (project variables, plus the page · element index as read-only rows — 사용자 결정 2) and the
 * Design panel's State section (a page's or an element's variables — 사용자 결정 4: name · type ·
 * default + ⋮) render the same component; the owner decides what a cell may do:
 *
 * - name: an input that commits on Enter · blur (Escape restores); a RAC state row (`source`) and
 *   an index row (`readOnly`) are name-only / text.
 * - type: a compact RAC Select (the State section's type picker); text on a source · index row.
 * - default: by the row's type — Switch (boolean), input (string · number — the owner parses and
 *   reports an error), JSON popover (object · array — the project's only); a page · element
 *   structured default is "set by a rule" (contract 51 — `""`), a source row follows its state.
 * - persist (project only), usage (hidden when `dense` — it moves into ⋮), ⋮ (`PropertyRowMenu`).
 *
 * Builder chrome RAC: no virtualization — a row per variable. The rows · cells · columns carry only
 * `variable-table__*` classes — the Builder's global `.react-aria-Row { display: flex }` (the
 * catalog Table's row grid, ADR-257) would otherwise break the table layout (live 2026-10-28).
 */
import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import {
  Select as AriaSelect,
  SelectValue,
} from "react-aria-components/Select";
import { Switch as AriaSwitch } from "react-aria-components/Switch";
import {
  Cell,
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
} from "react-aria-components/Table";
import { ArrowUpRight, Braces } from "lucide-react";
import { useI18n } from "@/i18n";
import { iconSmall } from "../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../config/actionIcons";
import { PropertyRowMenu } from "../property/PropertyRowMenu";
import "./VariableTable.css";

export type VariableTableOwner = "project" | "page" | "element";

export interface VariableTableRow {
  id: string;
  name: string;
  /** `string` · `number` · `boolean` · `object` · `array` (· `string[]` for a keys state). */
  type: string;
  defaultValue: unknown;
  usage: number;
  /** Project variables only — kept in localStorage at run time. */
  persist?: boolean;
  /** A page variable that names a node's RAC state: name only, the value follows the state. */
  source?: { prop: string };
  /** Another owner's variable (the Data panel's index): read-only, the row goes to its owner. */
  readOnly?: { owner: string };
  /** The owner's message for this row (an invalid default · a taken name). */
  error?: string | null;
}

export interface VariableTableProps {
  owner: VariableTableOwner;
  rows: readonly VariableTableRow[];
  /** The table's accessible name. */
  label: string;
  /** The Design panel (233 ~ 387 px): no usage column — the count goes into ⋮. */
  dense?: boolean;
  typeOptions: ReadonlyArray<{ value: string; label: string }>;
  onRename: (id: string, name: string) => void;
  onType: (id: string, type: string) => void;
  /** A scalar default as typed (`"true"` · `"42"` · text) — the owner parses it for the type. */
  onDefault: (id: string, raw: string) => void;
  /** A project variable's object · array default (parsed JSON; `undefined` = none). */
  onJsonDefault?: (id: string, value: unknown) => void;
  onPersist?: (id: string, persist: boolean) => void;
  onRemove: (id: string) => void;
  onGoToOwner?: (id: string) => void;
  /** Rendered under the table (an add button · hints). */
  children?: ReactNode;
}

const DeleteIcon = ACTION_ICONS.delete;

const structured = (type: string) => type === "object" || type === "array";

function formatDefault(value: unknown, type: string): string {
  if (value === undefined || value === null || value === "") return "";
  if (structured(type)) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** A text that commits on Enter · blur and restores on Escape (the State section's input). */
function CommitInput({
  value,
  label,
  invalid,
  placeholder,
  onCommit,
}: {
  value: string;
  label: string;
  invalid?: boolean;
  placeholder?: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const cancel = useRef(false);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const commit = () => {
    if (cancel.current) {
      cancel.current = false;
      return;
    }
    if (draft !== value) onCommit(draft);
  };
  return (
    <input
      className="react-aria-Input variable-table__input"
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancel.current = true;
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function TypeSelect({
  value,
  label,
  options,
  onChange,
}: {
  value: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <AriaSelect
      className="react-aria-Select variable-table__type"
      aria-label={label}
      selectedKey={value}
      onSelectionChange={(key) => key !== null && onChange(String(key))}
    >
      <Button className="react-aria-Button">
        <SelectValue />
      </Button>
      <Popover className="react-aria-Popover property-select-popover">
        <ListBox className="react-aria-ListBox">
          {options.map((option) => (
            <ListBoxItem
              key={option.value}
              id={option.value}
              textValue={option.label}
              className="react-aria-ListBoxItem"
            >
              {option.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}

/**
 * A project variable's object · array default: a popover textarea written on close when it is
 * valid JSON of the type (a half-typed value is marked invalid, never saved — the old editor's
 * rule, `variableJsonDefault.test`).
 */
function JsonDefaultPopover({
  value,
  type,
  label,
  onCommit,
}: {
  value: unknown;
  type: string;
  label: string;
  onCommit: (parsed: unknown) => void;
}) {
  const { t } = useI18n();
  const text = formatDefault(value, type);
  const [draft, setDraft] = useState(text);
  const [invalid, setInvalid] = useState(false);
  const describedBy = useId();
  useEffect(() => {
    setDraft(text);
  }, [text]);
  const commit = () => {
    if (draft.trim() === "") {
      setInvalid(false);
      if (text !== "") onCommit(undefined);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setInvalid(true);
      return;
    }
    if (
      Array.isArray(parsed) !== (type === "array") ||
      typeof parsed !== "object" ||
      parsed === null
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (JSON.stringify(parsed) !== (text || undefined)) onCommit(parsed);
  };
  return (
    <DialogTrigger>
      <Button
        className="react-aria-Button variable-table__json-trigger"
        aria-label={label}
      >
        <Braces size={iconSmall.size} />
        <span className="variable-table__json-preview">
          {text || (type === "array" ? "[]" : "{}")}
        </span>
      </Button>
      <Popover className="react-aria-Popover variable-table__json-popover">
        <Dialog className="react-aria-Dialog variable-table__json-dialog">
          <textarea
            className="variable-table__json-input"
            aria-label={label}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? describedBy : undefined}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            placeholder={type === "array" ? "[]" : "{}"}
            rows={6}
          />
          {invalid && (
            <p id={describedBy} className="variable-table__error" role="alert">
              {t("propertiesPanel.stateJsonInvalid", { type })}
            </p>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

export const VariableTable = memo(function VariableTable({
  owner,
  rows,
  label,
  dense,
  typeOptions,
  onRename,
  onType,
  onDefault,
  onJsonDefault,
  onPersist,
  onRemove,
  onGoToOwner,
  children,
}: VariableTableProps) {
  const { t } = useI18n();
  const showPersist = owner === "project" && onPersist !== undefined;
  const showUsage = !dense;
  const usageLabel = (count: number) =>
    t("propertiesPanel.stateUsageCount", { count });

  const defaultCell = (row: VariableTableRow): ReactNode => {
    if (row.source)
      return (
        <span className="variable-table__muted">
          {t("propertiesPanel.stateFollowsSource", { prop: row.source.prop })}
        </span>
      );
    if (row.readOnly)
      return (
        <span className="variable-table__text">
          {formatDefault(row.defaultValue, row.type)}
        </span>
      );
    if (structured(row.type)) {
      if (owner !== "project" || !onJsonDefault)
        return (
          <span className="variable-table__muted">
            {t("propertiesPanel.stateRuleSets")}
          </span>
        );
      return (
        <JsonDefaultPopover
          value={row.defaultValue}
          type={row.type}
          label={`${row.name} ${t("propertiesPanel.stateDefault")}`}
          onCommit={(parsed) => onJsonDefault(row.id, parsed)}
        />
      );
    }
    if (row.type === "boolean")
      return (
        <AriaSwitch
          className="react-aria-Switch variable-table__switch"
          aria-label={`${row.name} ${t("propertiesPanel.stateDefault")}`}
          isSelected={row.defaultValue === true}
          onChange={(on) => onDefault(row.id, String(on))}
        >
          <div className="indicator" />
        </AriaSwitch>
      );
    return (
      <CommitInput
        value={formatDefault(row.defaultValue, row.type)}
        label={`${row.name} ${t("propertiesPanel.stateDefault")}`}
        invalid={!!row.error}
        placeholder={row.type === "number" ? "0" : undefined}
        onCommit={(raw) => onDefault(row.id, raw)}
      />
    );
  };

  const menuFor = (row: VariableTableRow) => {
    if (row.readOnly)
      return onGoToOwner ? (
        <Button
          className="react-aria-Button variable-table__goto"
          aria-label={t("propertiesPanel.stateGoToOwner")}
          onPress={() => onGoToOwner(row.id)}
        >
          <ArrowUpRight size={iconSmall.size} />
        </Button>
      ) : null;
    const items = [
      ...(dense
        ? [{ id: "usage", label: usageLabel(row.usage), isDisabled: true }]
        : []),
      { id: "remove", label: t("common.delete"), icon: DeleteIcon },
    ];
    return (
      <PropertyRowMenu
        label={t("propertiesPanel.stateRowActions", { name: row.name })}
        items={items}
        onAction={(id) => {
          if (id === "remove") onRemove(row.id);
        }}
      />
    );
  };

  const errors = rows.filter((row) => row.error);

  return (
    <div
      className="variable-table-wrap"
      data-owner={owner}
      data-dense={dense ? "true" : undefined}
    >
      <Table aria-label={label} className="variable-table">
        <TableHeader className="variable-table__head">
          <Column
            id="name"
            isRowHeader
            className="variable-table__col variable-table__col-name"
          >
            {t("propertiesPanel.stateName")}
          </Column>
          <Column
            id="type"
            className="variable-table__col variable-table__col-type"
          >
            {t("propertiesPanel.stateType")}
          </Column>
          <Column
            id="default"
            className="variable-table__col variable-table__col-default"
          >
            {t("propertiesPanel.stateDefault")}
          </Column>
          {showPersist && (
            <Column
              id="persist"
              className="variable-table__col variable-table__col-persist"
            >
              {t("propertiesPanel.statePersist")}
            </Column>
          )}
          {showUsage && (
            <Column
              id="usage"
              className="variable-table__col variable-table__col-usage"
            >
              {t("propertiesPanel.stateUsage")}
            </Column>
          )}
          <Column
            id="actions"
            className="variable-table__col variable-table__col-actions"
          >
            <span className="variable-table__sr">
              {t("propertiesPanel.stateActions")}
            </span>
          </Column>
        </TableHeader>
        <TableBody
          className="variable-table__body"
          items={rows}
          renderEmptyState={() => (
            <span className="variable-table__muted">
              {t("propertiesPanel.stateEmpty")}
            </span>
          )}
        >
          {(row) => (
            <Row
              id={row.id}
              className="variable-table__row"
              data-variable-id={row.id}
              data-source={row.source ? "true" : undefined}
              data-read-only={row.readOnly ? "true" : undefined}
              {...(row.readOnly && onGoToOwner
                ? { onAction: () => onGoToOwner(row.id) }
                : {})}
            >
              <Cell className="variable-table__cell variable-table__cell-name">
                {row.readOnly ? (
                  <span className="variable-table__text" title={row.name}>
                    {row.name}
                    <span className="variable-table__owner">
                      {row.readOnly.owner}
                    </span>
                  </span>
                ) : (
                  <CommitInput
                    value={row.name}
                    label={t("propertiesPanel.stateName")}
                    invalid={!!row.error}
                    onCommit={(name) => onRename(row.id, name)}
                  />
                )}
              </Cell>
              <Cell className="variable-table__cell variable-table__cell-type">
                {row.source || row.readOnly ? (
                  <span className="variable-table__muted">{row.type}</span>
                ) : (
                  <TypeSelect
                    value={row.type}
                    label={t("propertiesPanel.stateType")}
                    options={typeOptions}
                    onChange={(type) => onType(row.id, type)}
                  />
                )}
              </Cell>
              <Cell className="variable-table__cell variable-table__cell-default">
                {defaultCell(row)}
              </Cell>
              {showPersist && (
                <Cell className="variable-table__cell variable-table__cell-persist">
                  {row.readOnly || row.source ? null : (
                    <AriaSwitch
                      className="react-aria-Switch variable-table__switch"
                      aria-label={`${row.name} ${t("propertiesPanel.statePersist")}`}
                      isSelected={row.persist === true}
                      onChange={(on) => onPersist!(row.id, on)}
                    >
                      <div className="indicator" />
                    </AriaSwitch>
                  )}
                </Cell>
              )}
              {showUsage && (
                <Cell className="variable-table__cell variable-table__cell-usage">
                  <span className="variable-table__count">{row.usage}</span>
                </Cell>
              )}
              <Cell className="variable-table__cell variable-table__cell-actions">
                {menuFor(row)}
              </Cell>
            </Row>
          )}
        </TableBody>
      </Table>
      {errors.map((row) => (
        <p
          key={row.id}
          className="variable-table__error"
          role="alert"
          data-variable-id={row.id}
        >
          {row.name}: {row.error}
        </p>
      ))}
      {children}
    </div>
  );
});
