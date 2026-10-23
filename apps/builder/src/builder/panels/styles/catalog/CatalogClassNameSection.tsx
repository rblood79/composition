import { memo, useCallback } from "react";
import { useI18n } from "@/i18n";
import type { NodeId } from "../../../../../../../packages/shared/src/catalog/document/types";
import { setNodeAttribute } from "../../../../../../../packages/shared/src/catalog/commands";
import {
  useCatalogNodeMetadata,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { ORIGIN_VIEW_NODE } from "../../../catalogRuntime/originView";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { Section as PropertySection } from "../../../components/panel/Section";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";
import { useStylesSelectedId } from "../stylesHost";

/**
 * Style 탭 Class 절 — the node's `metadata.className` (every element, whatever its definition
 * accepts). 2026-10-24 (사용자 — RAC API 표의 묶음): `className` 은 레퍼런스의 Styling 묶음이라
 * Property 탭 Accessibility 절 (`id` · `aria-label`) 에서 이리로 옮겼다. A template position (inside
 * an instance) and a Components page sample have no DOM attributes of their own.
 */
export const CatalogClassNameSection = memo(function CatalogClassNameSection() {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const identity = useStylesSelectedId();
  const target = identity
    ? workspace.positionOfRecord(identity)?.target
    : undefined;
  const nodeId =
    target?.kind === "node" && !target.id.startsWith(ORIGIN_VIEW_NODE)
      ? target.id
      : undefined;
  const className = useCatalogNodeMetadata(nodeId, "className");
  const writeClassName = useCallback(
    (value: string) => {
      if (!nodeId || value.trim() === className) return;
      run(
        setNodeAttribute({ id: nodeId as NodeId, field: "className", value }),
      );
    },
    [className, nodeId, run],
  );
  if (!nodeId) return null;
  return (
    <PropertySection id="class-name" title="Class">
      <div className="fieldset-row" data-wide="true">
        <PropertyInput
          key={nodeId}
          label="Class Name"
          value={className}
          onChange={writeClassName}
          placeholder={t("propertiesPanel.classNamePlaceholder")}
        />
      </div>
    </PropertySection>
  );
});
