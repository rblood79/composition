import { memo, useEffect, useMemo, useState } from "react";
import { Autocomplete } from "react-aria-components/Autocomplete";
import { Button as RACButton } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Header } from "react-aria-components/Header";
import { Input } from "react-aria-components/Input";
import {
  ListBox,
  ListBoxItem,
  ListBoxSection,
} from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import { SearchField } from "react-aria-components/SearchField";
import { useFilter } from "react-aria-components";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/i18n";
import type {
  DefinitionId,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogSwapCandidates,
  subscribeCatalogSwapRequest,
  takeCatalogSwapRequest,
  type CatalogSwapCandidate,
} from "../../../catalogRuntime/swapInstance";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { ACTION_ICONS } from "../../../config/actionIcons";
import "./CatalogSwapPicker.css";

const ComponentIcon = ACTION_ICONS.component;
const GROUPS = ["related", "local", "library"] as const;
const GROUP_LABEL = {
  related: "componentAction.swapRelated",
  local: "componentAction.swapLocal",
  library: "componentAction.swapLibrary",
} as const;

/**
 * ADR-261 Decision 2 — the instance's component name opens Swap instance (Figma's Instance menu):
 * a searchable list of every component, the related ones (same root type) first — user decision 3.
 * The Canvas menu's 「Swap instance…」 opens the same list (`requestCatalogSwap`).
 */
export const CatalogSwapPicker = memo(function CatalogSwapPicker({
  nodeId,
  name,
  onSwap,
}: {
  nodeId: NodeId;
  name: string;
  onSwap: (definitionId: DefinitionId) => void;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const [open, setOpen] = useState(() => takeCatalogSwapRequest(nodeId));
  useEffect(
    () =>
      subscribeCatalogSwapRequest((requested) => {
        if (requested === nodeId && takeCatalogSwapRequest(nodeId))
          setOpen(true);
      }),
    [nodeId],
  );
  // Read when it opens (the list is the project's components and the palette's).
  const candidates = useMemo<CatalogSwapCandidate[]>(
    () => (open ? catalogSwapCandidates(workspace.runtime.graph, nodeId) : []),
    [open, workspace, nodeId],
  );
  const { contains } = useFilter({ sensitivity: "base" });
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <RACButton
        className="component-semantics-identity component-swap-trigger"
        data-role="instance"
        aria-label={`${t("componentAction.swapInstance")}: ${name}`}
      >
        <ComponentIcon aria-hidden="true" size={14} />
        <span className="component-semantics-identity-name" title={name}>
          {name}
        </span>
        <span className="component-semantics-identity-role">
          {t("properties.instance")}
        </span>
        <ChevronDown aria-hidden="true" size={12} />
      </RACButton>
      <Popover
        className="react-aria-Popover property-select-popover component-swap-popover"
        placement="bottom start"
      >
        <Dialog
          className="component-swap-dialog"
          aria-label={t("componentAction.swapInstance")}
        >
          <Autocomplete filter={contains}>
            <SearchField
              className="react-aria-SearchField component-swap-search"
              aria-label={t("componentAction.swapSearch")}
              autoFocus
            >
              <Input placeholder={t("componentAction.swapSearch")} />
            </SearchField>
            <ListBox
              className="react-aria-ListBox component-swap-list"
              aria-label={t("componentAction.swapInstance")}
              selectionMode="none"
              onAction={(key) => {
                setOpen(false);
                onSwap(String(key) as DefinitionId);
              }}
            >
              {GROUPS.map((group) => {
                const items = candidates.filter(
                  (candidate) => candidate.group === group,
                );
                return items.length ? (
                  <ListBoxSection key={group} id={group}>
                    <Header className="component-swap-header">
                      {t(GROUP_LABEL[group])}
                    </Header>
                    {items.map((candidate) => (
                      <ListBoxItem
                        key={candidate.definitionId}
                        id={candidate.definitionId}
                        textValue={candidate.label}
                        className="react-aria-ListBoxItem"
                      >
                        {candidate.label}
                      </ListBoxItem>
                    ))}
                  </ListBoxSection>
                ) : null;
              })}
            </ListBox>
          </Autocomplete>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
});
