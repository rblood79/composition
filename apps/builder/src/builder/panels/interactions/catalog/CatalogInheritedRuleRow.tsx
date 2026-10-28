import { Power } from "lucide-react";
import { memo } from "react";
import type { InteractionEntry } from "../../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogInteractionStatus } from "../../../../../../../packages/shared/src/catalog/resolution/effectiveInteractions";
import { PropertySwitch } from "../../../components/property/PropertySwitch";
import { useI18n } from "@/i18n";
import { triggerLabel } from "../labels";
import { ACTION_CHOICE_LABEL_KEYS } from "../labels";

interface CatalogInheritedRuleRowProps {
  rule: InteractionEntry;
  status: CatalogInteractionStatus;
  /** The origin node's type (its When labels). */
  componentType: string;
  onEnabledChange: (enabled: boolean) => void;
  onReplace: () => void;
}

/**
 * ADR-281 Decision 4: a rule this instance inherits from its component — a read-only summary, an
 * on/off switch (off = it does not run in this instance) and 「Replace in this instance」 (a copy
 * as this instance's own rule, edited below). A replaced rule shows that its own rule runs instead.
 */
export const CatalogInheritedRuleRow = memo(function CatalogInheritedRuleRow({
  rule,
  status,
  componentType,
  onEnabledChange,
  onReplace,
}: CatalogInheritedRuleRowProps) {
  const { t } = useI18n();
  const doLabel = rule.actions
    .map((action) =>
      action.opcode in ACTION_CHOICE_LABEL_KEYS
        ? t(
            ACTION_CHOICE_LABEL_KEYS[
              action.opcode as keyof typeof ACTION_CHOICE_LABEL_KEYS
            ],
          )
        : action.opcode,
    )
    .join(" · ");
  const summary = `${triggerLabel(componentType, rule.trigger, t)} → ${doLabel}`;
  const replaced = typeof status === "object";
  return (
    <div className="interaction-rule interaction-rule-inherited">
      <div className="interaction-rule-summary interaction-rule-inherited-summary">
        <span className="interaction-rule-text">{summary}</span>
      </div>
      {replaced ? (
        <p className="interaction-rule-refusal">
          {t("interactions.inheritedReplaced")}
        </p>
      ) : (
        <div className="interaction-rule-editor">
          <PropertySwitch
            label={t("interactions.inheritedEnabled")}
            icon={Power}
            isSelected={status === "on"}
            onChange={onEnabledChange}
          />
          <button type="button" className="control-button" onClick={onReplace}>
            {t("interactions.inheritedReplace")}
          </button>
        </div>
      )}
    </div>
  );
});
