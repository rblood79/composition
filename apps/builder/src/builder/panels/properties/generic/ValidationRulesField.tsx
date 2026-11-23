import { useState } from "react";
import { Button } from "react-aria-components/Button";
import { useI18n } from "@/i18n";
import type {
  ViewComparison,
  ViewCondition,
  ViewConditionGroup,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  CATALOG_VALIDATION_END,
  CATALOG_VALIDATION_FORM_REF,
  CATALOG_VALIDATION_SELF,
  catalogValidationOwnSubjects,
  catalogValidationPath,
  catalogValidationRulesFit,
  catalogValidationSubjectOf,
  catalogValidationValueType,
  type CatalogValidationRule,
} from "../../../../../../../packages/shared/src/catalog/document/validationRules";
import {
  catalogFormFieldsOf,
  catalogFormOf,
} from "../../../../../../../packages/shared/src/catalog/runtime/fieldValidation";
import {
  VIEW_COMPARISONS_BY_KIND,
  viewFieldKind,
} from "../../../../../../../packages/shared/src/collections/view/comparison";
import {
  useCatalogStepReading,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react.runtime";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { PropertyFieldset } from "../../../components/property/PropertyFieldset";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertyRowMenu } from "../../../components/property/PropertyRowMenu";
import { PropertySelect } from "../../../components/property/PropertySelect";
import "./ValidationRulesField.css";

const AddIcon = ACTION_ICONS.add;
/** 「Compare with」's fixed value (a select key — no field `name` starts with `$`). */
const FIXED = "$fixed";

/**
 * S2 `validate` as condition rules (S2 체크리스트 부록 D.3 2단계, 2026-11-23 — 사용자 결정: 데이터 보기의
 * 조건 트리): each rule is a condition the field's value must meet (on its own value, or another field
 * of the same Form by `name`) and the message shown when it does not. A rule's conditions are one
 * condition or an 「또는」 group (the filter section's 「또는 조건 추가」).
 */

/** A condition's subject: the own value (`$value` · `$end`) or a named field of the same Form. */
interface Subject {
  id: string;
  label: string;
  type: "string" | "number" | "date" | "array" | "boolean";
}

/** The subjects of the selected field: its own value, then its Form's other named fields. */
function useSubjects(elementId: string | undefined): Subject[] {
  const workspace = useCatalogWorkspace();
  return useCatalogStepReading(workspace, () => {
    if (!elementId) return [];
    const root = workspace.root;
    const get = (id: string) => root.canvasInputs.get(id);
    // (The panel's element is the selected record — its identity; a node id reads its records.)
    const record =
      get(elementId) ??
      (() => {
        const [recordId] = workspace.recordsOfNode(elementId);
        return recordId ? get(recordId) : undefined;
      })();
    if (!record) return [];
    const lookup = {
      get,
      typeOf: (entry: typeof record) => root.typeOf(entry),
    };
    const type = lookup.typeOf(record);
    const ownType = catalogValidationValueType(type, record.props);
    const subjects: Subject[] = catalogValidationOwnSubjects(type).map(
      (id) => ({ id, label: id, type: ownType }),
    );
    const form = catalogFormOf(record, lookup);
    if (form)
      for (const field of catalogFormFieldsOf(form, lookup))
        if (field.record.id !== record.id)
          subjects.push({
            id: field.name,
            label: field.name,
            type: catalogValidationValueType(field.type, field.record.props),
          });
    return subjects;
  });
}

const conditionsOf = (rule: CatalogValidationRule): ViewCondition[] =>
  "items" in rule.when
    ? rule.when.items.filter(
        (item): item is ViewCondition => !("items" in item),
      )
    : [rule.when];

/** A rule's conditions back: one condition, or an 「또는」 group of them. */
const withConditions = (
  rule: CatalogValidationRule,
  conditions: readonly ViewCondition[],
): CatalogValidationRule => ({
  ...rule,
  when:
    conditions.length === 1
      ? conditions[0]!
      : ({
          id: "items" in rule.when ? rule.when.id : `${rule.id}-or`,
          op: "or",
          items: conditions,
        } satisfies ViewConditionGroup),
});

const newId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

/** A typed value as the comparison takes it (a number field's number · a list's items). */
function valueFromText(
  text: string,
  kind: ReturnType<typeof viewFieldKind>,
  op: ViewComparison,
): ViewCondition["value"] {
  if (
    op === "oneOf" ||
    op === "between" ||
    op === "containsAny" ||
    op === "containsAll"
  ) {
    const cells = text
      .split(",")
      .map((cell) => cell.trim())
      .filter(Boolean);
    return kind === "number" &&
      cells.every((cell) => Number.isFinite(Number(cell)))
      ? cells.map(Number)
      : cells;
  }
  if (kind === "number" && text.trim() !== "" && Number.isFinite(Number(text)))
    return Number(text);
  if (kind === "boolean") return text === "true";
  return text;
}

const valueText = (value: ViewCondition["value"]) =>
  value === undefined
    ? ""
    : Array.isArray(value)
      ? value.join(", ")
      : String(value);

export function ValidationRulesField({
  label,
  value,
  elementId,
  onChange,
}: {
  label: string;
  value: unknown;
  elementId: string | undefined;
  onChange: (value: unknown) => void;
}) {
  const { t } = useI18n();
  const subjects = useSubjects(elementId);
  const rules = catalogValidationRulesFit(value) ? value : [];
  const [open, setOpen] = useState<string | null>(null);
  const write = (next: readonly CatalogValidationRule[]) =>
    onChange(next.length ? next : undefined);
  const subjectOf = (id: string | undefined) =>
    subjects.find((subject) => subject.id === id) ?? subjects[0];
  const subjectLabel = (id: string | undefined) =>
    id === CATALOG_VALIDATION_SELF
      ? t("validationRules.self")
      : id === CATALOG_VALIDATION_END
        ? t("validationRules.end")
        : (id ?? "?");
  const opLabel = (op: ViewComparison) => t(`dataView.op_${op}`);
  const newCondition = (subjectId = CATALOG_VALIDATION_SELF): ViewCondition => {
    const kind = viewFieldKind(subjectOf(subjectId)?.type);
    return {
      id: newId("c"),
      fields: [catalogValidationPath(subjectId)],
      op: kind === "text" ? "exists" : VIEW_COMPARISONS_BY_KIND[kind][0]!,
    };
  };
  const add = () => {
    const rule: CatalogValidationRule = {
      id: newId("rule"),
      when: newCondition(),
      message: "",
    };
    write([...rules, rule]);
    setOpen(rule.id);
  };
  const replace = (next: CatalogValidationRule) =>
    write(rules.map((rule) => (rule.id === next.id ? next : rule)));

  return (
    <PropertyFieldset legend={label} className="validation-rules-field">
      <div className="validation-rules-list" data-validation-rules="">
        {rules.map((rule) => {
          const conditions = conditionsOf(rule);
          const summary = [
            conditions
              .map((condition) => {
                const valueRef =
                  typeof condition.value === "string" &&
                  condition.value.startsWith(CATALOG_VALIDATION_FORM_REF)
                    ? condition.value.slice(CATALOG_VALIDATION_FORM_REF.length)
                    : valueText(condition.value);
                return [
                  subjectLabel(catalogValidationSubjectOf(condition)),
                  opLabel(condition.op),
                  condition.op === "exists" || condition.op === "notExists"
                    ? ""
                    : valueRef,
                ]
                  .filter(Boolean)
                  .join(" ");
              })
              .join(` ${t("validationRules.or")} `),
            rule.message || t("validationRules.noMessage"),
          ].join(" → ");
          const isOpen = open === rule.id;
          return (
            <div
              key={rule.id}
              className="validation-rule"
              data-open={isOpen || undefined}
            >
              <div className="validation-rule-row">
                <Button
                  className="validation-rule-summary"
                  aria-expanded={isOpen}
                  onPress={() => setOpen(isOpen ? null : rule.id)}
                >
                  {summary}
                </Button>
                <PropertyRowMenu
                  label={t("validationRules.actions", { name: summary })}
                  items={[
                    { id: "edit", label: t("validationRules.edit") },
                    { id: "or", label: t("validationRules.orAdd") },
                    { id: "remove", label: t("validationRules.remove") },
                  ]}
                  onAction={(id) => {
                    if (id === "edit") setOpen(isOpen ? null : rule.id);
                    if (id === "or") {
                      replace(
                        withConditions(rule, [...conditions, newCondition()]),
                      );
                      setOpen(rule.id);
                    }
                    if (id === "remove")
                      write(rules.filter((item) => item.id !== rule.id));
                  }}
                />
              </div>
              {isOpen ? (
                <div className="validation-rule-detail">
                  {conditions.map((condition, index) => {
                    const subjectId = catalogValidationSubjectOf(condition);
                    const kind = viewFieldKind(subjectOf(subjectId)?.type);
                    const ops = VIEW_COMPARISONS_BY_KIND[kind];
                    const edit = (patch: Partial<ViewCondition>) =>
                      replace(
                        withConditions(
                          rule,
                          conditions.map((item) =>
                            item.id === condition.id
                              ? (Object.fromEntries(
                                  Object.entries({ ...item, ...patch }).filter(
                                    ([, cell]) => cell !== undefined,
                                  ),
                                ) as unknown as ViewCondition)
                              : item,
                          ),
                        ),
                      );
                    const reference =
                      typeof condition.value === "string" &&
                      condition.value.startsWith(CATALOG_VALIDATION_FORM_REF)
                        ? condition.value.slice(
                            CATALOG_VALIDATION_FORM_REF.length,
                          )
                        : "";
                    const takesValue =
                      condition.op !== "exists" && condition.op !== "notExists";
                    return (
                      <div
                        key={condition.id}
                        className="validation-rule-condition"
                        data-or={index > 0 || undefined}
                      >
                        {index > 0 ? (
                          <p className="validation-rule-or">
                            {t("validationRules.or")}
                          </p>
                        ) : null}
                        <PropertySelect
                          label={t("validationRules.subject")}
                          value={subjectId ?? CATALOG_VALIDATION_SELF}
                          options={subjects.map((subject) => ({
                            value: subject.id,
                            label: subjectLabel(subject.id),
                          }))}
                          translateOptions={false}
                          onChange={(next) => {
                            const nextKind = viewFieldKind(
                              subjectOf(next)?.type,
                            );
                            edit({
                              fields: [catalogValidationPath(next)],
                              ...(VIEW_COMPARISONS_BY_KIND[nextKind].includes(
                                condition.op,
                              )
                                ? {}
                                : {
                                    op: VIEW_COMPARISONS_BY_KIND[nextKind][0]!,
                                    value: undefined,
                                  }),
                            });
                          }}
                        />
                        <PropertySelect
                          label={t("validationRules.comparison")}
                          value={condition.op}
                          options={ops.map((op) => ({
                            value: op,
                            label: opLabel(op),
                          }))}
                          translateOptions={false}
                          onChange={(next) =>
                            edit({
                              op: next as ViewComparison,
                              ...(next === "exists" || next === "notExists"
                                ? { value: undefined }
                                : {}),
                            })
                          }
                        />
                        {takesValue ? (
                          <PropertySelect
                            label={t("validationRules.compareWith")}
                            value={reference || FIXED}
                            options={[
                              { value: FIXED, label: t("validationRules.fixed") },
                              ...subjects
                                .filter((subject) => subject.id !== subjectId)
                                .map((subject) => ({
                                  value: subject.id,
                                  label: subjectLabel(subject.id),
                                })),
                            ]}
                            translateOptions={false}
                            onChange={(next) =>
                              edit({
                                value:
                                  next && next !== FIXED
                                    ? `${CATALOG_VALIDATION_FORM_REF}${next}`
                                    : undefined,
                              })
                            }
                          />
                        ) : null}
                        {takesValue && !reference ? (
                          <PropertyInput
                            label={t("validationRules.value")}
                            value={valueText(condition.value)}
                            onChange={(text) =>
                              edit({
                                value: valueFromText(text, kind, condition.op),
                              })
                            }
                          />
                        ) : null}
                        {conditions.length > 1 ? (
                          <Button
                            className="control-button"
                            onPress={() =>
                              replace(
                                withConditions(
                                  rule,
                                  conditions.filter(
                                    (item) => item.id !== condition.id,
                                  ),
                                ),
                              )
                            }
                          >
                            {t("validationRules.removeCondition")}
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                  <PropertyInput
                    label={t("validationRules.message")}
                    value={rule.message}
                    placeholder={t("validationRules.messagePlaceholder")}
                    onChange={(message) => replace({ ...rule, message })}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
        <Button className="control-button" data-variant="add" onPress={add}>
          <AddIcon size={14} aria-hidden />
          {t("validationRules.add")}
        </Button>
      </div>
    </PropertyFieldset>
  );
}
