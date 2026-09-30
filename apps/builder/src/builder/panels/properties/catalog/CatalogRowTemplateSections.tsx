import { memo, useCallback, useMemo, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n";
import type { EditTarget } from "../../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingValue } from "../../../catalogRuntime/dataBinding";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import {
  catalogCardFieldCommand,
  catalogCardFields,
  catalogRowTemplateOwner,
  type CatalogCardField,
} from "../../../catalogRuntime/rowTemplate";
import {
  PropertyFieldTemplateInput,
  PropertySection,
} from "../../../components";
import { useCollections } from "../../../stores/data";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import { fieldsFromOwner } from "../hooks/useOwnerCollectionColumns";
import "../ItemOriginNoticeSection.css";

function useStepValue<T>(read: () => T): T {
  const workspace = useCatalogWorkspace();
  const subscribe = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  const key = useSyncExternalStore(subscribe, () => JSON.stringify(read()));
  return useMemo(() => JSON.parse(key ?? "null") as T, [key]);
}

/**
 * ADR-248 Phase 4e-4e: the item origin notice over the catalog document (the old
 * ItemOriginNoticeSection) — the selection is a bound collection's row template (or inside it),
 * which every data row repeats: an edit reaches every row.
 */
export const CatalogItemOriginNotice = memo(function CatalogItemOriginNotice({
  target,
}: {
  target: EditTarget;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const owner = useStepValue(
    () => catalogRowTemplateOwner(workspace.runtime.graph, target) ?? null,
  );
  if (!owner) return null;
  return (
    <PropertySection title={t("propertiesPanel.itemOriginSection")}>
      <p className="item-origin-notice" data-item-origin-notice={owner}>
        {t("propertiesPanel.itemOriginNotice")}
      </p>
    </PropertySection>
  );
});

/**
 * ADR-248 Phase 4e-4e: a bound GridList's card fields (the old GridListCardFieldsSection) — each
 * content prop of its row template's descendants takes a `{field}` template of the bound
 * collection's columns; a write is the GridList's patch at that position (one step).
 */
export const CatalogCardFieldsSection = memo(function CatalogCardFieldsSection({
  identity,
}: {
  identity: string;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const collections = useCollections();
  const read = useStepValue(() => {
    const position = workspace.positionOfRecord(identity);
    try {
      return position
        ? (catalogCardFields(workspace.runtime.graph, position) ?? null)
        : null;
    } catch {
      return null;
    }
  });
  const fields = useMemo(
    () =>
      read
        ? fieldsFromOwner(
            { props: { dataBinding: catalogBindingValue(read.binding) } },
            collections,
          )
        : null,
    [collections, read],
  );
  if (!read || !fields?.length || !read.fields.length) return null;
  const columns = fields.map((field) => field.key);
  return (
    <PropertySection title={t("propertiesPanel.cardFieldsSection")}>
      {read.fields.map((field: CatalogCardField) => (
        <PropertyFieldTemplateInput
          key={`${JSON.stringify(field.target)}:${field.key}`}
          label={`${field.label} · ${field.key}`}
          value={field.value}
          columns={columns}
          fields={fields}
          onChange={(next) => {
            run(catalogCardFieldCommand(field, next));
          }}
        />
      ))}
    </PropertySection>
  );
});
