import { memo, useMemo, useReducer, useEffect } from "react";
import { useI18n } from "@/i18n";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { catalogItemInsertChoices } from "../../../catalogRuntime/itemInsert";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { PropertySection } from "../../../components";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";

const AddIcon = ACTION_ICONS.add;

/**
 * ADR-248 4e: the old slot section's item "+" (same rows and classes) — a list frame, a group, a
 * TableHeader or a TableView's TableBody lists the item types it takes; "+" adds one (one history
 * step, the new item selected). Elements that hold no items show nothing.
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
  // The choices follow the host's rows (a TableView's row alignment, a sibling's shape).
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
