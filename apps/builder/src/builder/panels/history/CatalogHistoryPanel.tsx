import { useContext, useState, useSyncExternalStore } from "react";
import { Ellipsis, File, History, Redo, Undo } from "lucide-react";
import { Menu, MenuItem, MenuTrigger } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { Button, Toolbar } from "@composition/shared/components";
import { useI18n } from "@/i18n";
import { iconProps, iconSmall } from "../../../utils/ui/uiConstants";
import {
  CatalogWorkspaceGate,
  useCatalogWorkspace,
} from "../../catalogRuntime/react";
import { EmptyState } from "../../components/feedback/EmptyState";
import { PanelContents } from "../../components/panel/PanelContents";
import { PanelHeader } from "../../components/panel/PanelHeader";
import { Section } from "../../components/panel/Section";
import { ActionIconButton } from "../../components/ui";
import { ConfirmDialog } from "../../components/overlay";
import { ACTION_ICONS } from "../../config/actionIcons";
import { catalogHistoryEntryView } from "./catalogHistoryLabels";
import { CatalogSnapshotHostContext } from "./catalogSnapshotHost";
import { useCatalogSnapshotUi } from "./useCatalogSnapshotUi";
import "./HistoryPanel.css";

const DeleteIcon = ACTION_ICONS.delete;

/**
 * ADR-248 Phase 4e-4: History of the open catalog project — the single project history (one entry
 * per command, localized with its family icon and its time for assistive tech). Undo · redo, jump
 * to an entry (undo/redo up to it) and clear after a confirmation; snapshots through the catalog
 * snapshot host (`useCatalogSnapshotUi`, 4e-6-32).
 */
export function CatalogHistoryPanel() {
  return (
    <div className="panel history-panel">
      <CatalogWorkspaceGate>
        <CatalogHistoryContent />
      </CatalogWorkspaceGate>
    </div>
  );
}

function CatalogHistoryContent() {
  const { t, formatTime } = useI18n();
  const workspace = useCatalogWorkspace();
  const { history } = workspace;
  const [confirmClear, setConfirmClear] = useState(false);
  const { labels, applied, times, subjects } = useSyncExternalStore(
    history.subscribe,
    history.getSnapshot,
  );
  // Row 0 = the opened state; row i = after entry i (localized label and its family icon).
  const snapshotUi = useCatalogSnapshotUi(
    useContext(CatalogSnapshotHostContext),
    labels.length === 0,
  );
  const rows = [
    { text: t("history.initialState"), Icon: File },
    // The element the entry acted on follows its label (the old panel's "Add Button").
    ...labels.map((label, index) => {
      const view = catalogHistoryEntryView(label, t);
      const subject = subjects[index];
      // A label that already names it (the AI host's "AI: add Button") stays as it is.
      return subject && !view.text.includes(subject)
        ? { ...view, text: `${view.text} ${subject}` }
        : view;
    }),
  ];
  return (
    <>
      <PanelHeader
        icon={<History size={iconProps.size} />}
        title={t("history.title")}
        panelId="history"
        actions={
          <Toolbar
            className="history-actions"
            aria-label={t("history.toolbarLabel")}
          >
            <ActionIconButton
              onPress={() => workspace.undo()}
              isDisabled={applied === 0}
              aria-label={t("command.undo")}
              shortcutId="undo"
            >
              <Undo size={iconProps.size} />
            </ActionIconButton>
            <ActionIconButton
              onPress={() => workspace.redo()}
              isDisabled={applied === labels.length}
              aria-label={t("command.redo")}
              shortcutId="redo"
            >
              <Redo size={iconProps.size} />
            </ActionIconButton>
            {snapshotUi.buttons}
            <MenuTrigger>
              <ActionIconButton
                aria-label={t("history.menuLabel")}
                isDisabled={labels.length === 0}
              >
                <Ellipsis size={iconProps.size} />
              </ActionIconButton>
              <Popover
                className="history-menu-popover"
                placement="bottom end"
                offset={4}
              >
                <Menu
                  className="history-menu"
                  aria-label={t("history.menuLabel")}
                  onAction={(key) => {
                    if (key === "clear-history") setConfirmClear(true);
                  }}
                >
                  <MenuItem
                    id="clear-history"
                    className="history-menu-item"
                    data-destructive="true"
                    textValue={t("history.clearAll")}
                  >
                    <DeleteIcon size={iconSmall.size} />
                    <span>{t("history.clearAll")}</span>
                  </MenuItem>
                </Menu>
              </Popover>
            </MenuTrigger>
          </Toolbar>
        }
      />
      <PanelContents>
        {snapshotUi.section}
        <Section
          id="history-edits"
          title={t("history.editsSection")}
          badge={
            <span className="history-count">
              {applied}/{labels.length}
            </span>
          }
          className="history-section history-edit-section"
        >
          {labels.length === 0 ? (
            <EmptyState
              icon={<History size={32} />}
              message={t("history.emptyMessage")}
              description={t("history.emptyDescription")}
            />
          ) : (
            <div className="history-list">
              {rows.map(({ text: label, Icon }, index) => {
                const isActive = index === applied;
                // Time and ordinal for assistive tech, as the old panel did (not drawn).
                const details =
                  index > 0
                    ? `${formatTime(new Date(times[index - 1]))} · ${t("history.entryOrdinal", { index })}`
                    : undefined;
                return (
                  <div
                    key={index}
                    className="history-item"
                    data-active={isActive}
                    data-start={index === 0}
                    data-future={index > applied}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => history.goTo(index)}
                      className="history-item-btn"
                      aria-current={isActive ? "step" : undefined}
                      aria-label={[
                        label,
                        details,
                        isActive ? t("history.currentState") : undefined,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    >
                      <span className="history-item-icon">
                        <Icon size={iconSmall.size} />
                      </span>
                      <span className="history-item-main">
                        <span className="history-label">{label}</span>
                      </span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </PanelContents>
      <ConfirmDialog
        isOpen={confirmClear}
        title={t("history.confirmClearAllTitle")}
        message={t("history.confirmClearAll")}
        onConfirm={() => {
          setConfirmClear(false);
          history.clear();
        }}
        onCancel={() => setConfirmClear(false)}
      />
      {snapshotUi.dialogs}
    </>
  );
}
