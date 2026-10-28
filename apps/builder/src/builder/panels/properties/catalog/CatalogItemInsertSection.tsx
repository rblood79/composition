import { memo, useMemo, useReducer, useEffect } from "react";
import { useI18n } from "@/i18n";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { catalogItemInsertChoices } from "../../../catalogRuntime/itemInsert";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";

const AddIcon = ACTION_ICONS.add;

/**
 * ADR-248 4e: the old slot section's item "+" (same rows and classes) — a list frame, a group, a
 * TableHeader or a Table's TableBody lists the item types it takes; "+" adds one (one history
 * step, the new item selected). Elements that hold no items show nothing. More than one type is
 * one select — picking a type adds it (user 2026-10-25 「추가 가능한 item 이 한 개 이상일 때 select
 * 방식」: a Card's Preview took four "+" rows).
 */
export const CatalogItemInsertSection = memo(function CatalogItemInsertSection({
  identity,
}: {
  identity: string;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const position = useMemo(
    () => workspace.positionOfRecord(identity),
    [identity, workspace],
  );
  // The choices follow the host's rows (a Table's row alignment, a sibling's shape).
  const [revision, refresh] = useReducer((value: number) => value + 1, 0);
  useEffect(
    () =>
      position
        ? workspace.readModel.subscribeRows({ position }, refresh)
        : undefined,
    [position, workspace],
  );
  const choices = useMemo(
    () =>
      position
        ? catalogItemInsertChoices(
            {
              graph: workspace.runtime.graph,
              readModel: workspace.readModel,
              newId: workspace.newId,
            },
            position,
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `revision` re-reads the rows
    [position, revision, workspace],
  );
  if (!choices.length) return null;
  if (choices.length > 1)
    return (
      <PropertySection title={t("propertiesPanel.slotSection")}>
        <div className="fieldset-row" data-wide="true">
          <PropertySelect
            label={t("propertiesPanel.slotAddContent")}
            value=""
            options={[
              { value: "", label: `${t("propertiesPanel.slotAddContent")}…` },
              ...choices.map((choice) => ({
                value: choice.type,
                label: choice.type,
              })),
            ]}
            translateOptions={false}
            onChange={(value) => {
              const choice = choices.find((item) => item.type === value);
              if (choice) run(choice.build());
            }}
          />
        </div>
      </PropertySection>
    );
  return (
    <PropertySection title={t("propertiesPanel.slotSection")}>
      <div aria-label="Items" className="frame-slot-list">
        {choices.map((choice) => (
          <div className="list-row frame-slot-item" key={choice.type}>
            <div className="list-row__body">
              <span className="list-row__label frame-slot-item-label">
                {choice.type}
              </span>
            </div>
            <div className="list-row__actions">
              <button
                aria-label={`Insert ${choice.type}`}
                className="list-row__action frame-slot-insert"
                onClick={() => run(choice.build())}
                type="button"
              >
                <AddIcon aria-hidden="true" size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </PropertySection>
  );
});
