import { memo, useMemo } from "react";
import { useI18n } from "@/i18n";
import type { EditTarget } from "../../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingValue } from "../../../catalogRuntime/dataBinding";
import {
  useCatalogStepReading,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import {
  catalogCardFieldCommand,
  catalogCardFields,
  catalogRowTemplateOwner,
  type CatalogCardField,
} from "../../../catalogRuntime/rowTemplate";
import { PropertyFieldTemplateInput } from "../../../components/property/PropertyFieldTemplateInput";
import { Section as PropertySection } from "../../../components/panel/Section";
import { useCollections } from "../../../stores/data";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";
import { fieldsFromOwner } from "../hooks/useOwnerCollectionColumns";
import "../ItemOriginNoticeSection.css";

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
  const owner = useCatalogStepReading(
    workspace,
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
 * ADR-248 Phase 4e-4e: a bound collection's item fields (the old GridListCardFieldsSection —
 * every bound collection since 2026-10-24) — each content prop of its row template's descendants
 * (글자 · 그림 칸) takes a `{field}` template of the bound collection's columns; a write is the
 * collection's patch at that position (one step).
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
  const read = useCatalogStepReading(workspace, () => {
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
