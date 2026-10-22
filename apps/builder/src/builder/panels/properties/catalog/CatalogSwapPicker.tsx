import {
  memo,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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
import { SearchField } from "../../../components/ui/SearchField";
import { ACTION_ICONS } from "../../../config/actionIcons";
import "./CatalogSwapPicker.css";

const ComponentIcon = ACTION_ICONS.component;
const GROUPS = ["preferred", "related", "local", "library"] as const;
const GROUP_LABEL = {
  preferred: "componentAction.swapPreferred",
  related: "componentAction.swapRelated",
  local: "componentAction.swapLocal",
  library: "componentAction.swapLibrary",
} as const;

/**
 * A searchable list of components in groups (Swap instance's — ADR-261 Decision 2, an instance
 * swap property's — Phase 5, and a slot's insert list): the trigger is the caller's, the list is
 * read when it opens. The search is the Builder SearchField (the Command palette's · header menu's
 * `control` field) — Autocomplete links it to the ListBox.
 */
export const CatalogComponentPicker = memo(function CatalogComponentPicker({
  label,
  triggerClassName,
  children,
  candidates: readCandidates,
  onPick,
  open,
  onOpenChange,
  dataRole,
  triggerRef,
  popoverStyle,
}: {
  /** The trigger's accessible name and the list's. */
  label: string;
  triggerClassName: string;
  dataRole?: string;
  children: ReactNode;
  candidates: () => CatalogSwapCandidate[];
  onPick: (definitionId: DefinitionId) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A field trigger's popover lines up with its field box (`useControlPopoverMetrics`). */
  triggerRef?: (node: HTMLElement | null) => void;
  popoverStyle?: CSSProperties;
}) {
  const { t } = useI18n();
  const candidates = useMemo<CatalogSwapCandidate[]>(
    () => (open ? readCandidates() : []),
    // (Read when it opens: the list is the project's components and the palette's.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );
  const { contains } = useFilter({ sensitivity: "base" });
  return (
    <DialogTrigger isOpen={open} onOpenChange={onOpenChange}>
      <RACButton
        ref={triggerRef}
        className={triggerClassName}
        data-role={dataRole}
        aria-label={label}
      >
        {children}
      </RACButton>
      <Popover
        className="react-aria-Popover property-select-popover component-swap-popover"
        placement="bottom start"
        style={popoverStyle}
      >
        <Dialog className="component-swap-dialog" aria-label={label}>
          <Autocomplete filter={contains}>
            <SearchField
              appearance="control"
              autoFocus
              placeholder={t("componentAction.swapSearch")}
              aria-label={t("componentAction.swapSearch")}
            />
            <ListBox
              className="react-aria-ListBox component-swap-list"
              aria-label={label}
              selectionMode="none"
              onAction={(key) => {
                onOpenChange(false);
                onPick(String(key) as DefinitionId);
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
  return (
    <CatalogComponentPicker
      label={`${t("componentAction.swapInstance")}: ${name}`}
      triggerClassName="component-semantics-identity component-swap-trigger"
      dataRole="instance"
      candidates={() => catalogSwapCandidates(workspace.runtime.graph, nodeId)}
      onPick={onSwap}
      open={open}
      onOpenChange={setOpen}
    >
      <ComponentIcon aria-hidden="true" size={14} />
      <span className="component-semantics-identity-name" title={name}>
        {name}
      </span>
      <span className="component-semantics-identity-role">
        {t("properties.instance")}
      </span>
      <ChevronDown aria-hidden="true" size={12} />
    </CatalogComponentPicker>
  );
});
