import { useSyncExternalStore } from "react";
import { Ellipsis, File, History, Pencil, Redo, Undo } from "lucide-react";
import { Menu, MenuItem, MenuTrigger } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { Button, Toolbar } from "@composition/shared/components";
import { useI18n } from "@/i18n";
import { iconProps, iconSmall } from "../../../utils/ui/uiConstants";
import {
  CatalogWorkspaceGate,
  useCatalogWorkspace,
} from "../../catalogRuntime/react";
import {
  EmptyState,
  PanelContents,
  PanelHeader,
  Section,
} from "../../components";
import { ActionIconButton } from "../../components/ui";
import { ACTION_ICONS } from "../../config/actionIcons";
import "./HistoryPanel.css";

const DeleteIcon = ACTION_ICONS.delete;

/**
 * ADR-248 Phase 4e-4: History of the open catalog project — the single project history (one entry
 * per command). Undo · redo, jump to an entry (undo/redo up to it) and clear. Snapshots have no
 * counterpart in the new runtime yet, so they are not shown.
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
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const { history } = workspace;
  const { labels, applied } = useSyncExternalStore(
    history.subscribe,
    history.getSnapshot,
  );
  // Row 0 = the opened state; row i = after entry i.
  const rows = [t("history.initialState"), ...labels];
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
                    if (key === "clear-history") history.clear();
                  }}
                >
                  <MenuItem
                    id="clear-history"
                    className="history-menu-item"
                    data-destructive="true"
                    textValue={t("history.clearPage")}
                  >
                    <DeleteIcon size={iconSmall.size} />
                    <span>{t("history.clearPage")}</span>
                  </MenuItem>
                </Menu>
              </Popover>
            </MenuTrigger>
          </Toolbar>
        }
      />
      <PanelContents>
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
              {rows.map((label, index) => {
                const isActive = index === applied;
                const Icon = index === 0 ? File : Pencil;
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
                      aria-label={
                        isActive
                          ? `${label}, ${t("history.currentState")}`
                          : label
                      }
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
    </>
  );
}
