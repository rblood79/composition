import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ArchiveRestore, Camera } from "lucide-react";
import { Button } from "@composition/shared/components";
import { useI18n } from "@/i18n";
import { iconProps, iconSmall } from "../../../utils/ui/uiConstants";
import { Section } from "../../components/panel/Section";
import { ActionIconButton } from "../../components/ui";
import { ConfirmDialog } from "../../components/overlay";
import { ACTION_ICONS } from "../../config/actionIcons";
import { useToastStore } from "../../stores/toast";
import {
  CATALOG_USER_SNAPSHOT_LIMIT,
  type CatalogSnapshot,
} from "../../catalogRuntime/snapshots";
import {
  catalogSnapshotName,
  catalogSnapshotRestoredFrom,
  type CatalogSnapshotHost,
} from "./catalogSnapshotHost";

const DeleteIcon = ACTION_ICONS.delete;
const NO_SNAPSHOTS: readonly CatalogSnapshot[] = [];
const noSubscribe = () => () => {};
// A second click inside this delay renames instead of restoring (a restore replaces the whole
// document, so a stray click is expensive) — the old panel's split.
const RESTORE_CLICK_DELAY_MS = 250;

function formatSize(chars: number): string {
  if (chars >= 1024 * 1024) return `${(chars / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(chars / 1024))}KB`;
}

/**
 * ADR-248 Phase 4e-6-32: the History panel's snapshot surface over the catalog snapshot host —
 * header buttons (create · delete the active snapshot), the Snapshots section (click restores,
 * double-click renames a user snapshot) and the confirmations. "Active" is the snapshot the open
 * document was restored from, until the next edit. A restore clears the history (the project
 * reopens), so it asks first when there is history to lose; the open document is kept as a
 * "Before restore" snapshot either way. Without a host (the old store) nothing is shown.
 */
export function useCatalogSnapshotUi(
  host: CatalogSnapshotHost | null,
  historyEmpty: boolean,
): { buttons: ReactNode; section: ReactNode; dialogs: ReactNode } {
  const { t, formatTime } = useI18n();
  const snapshots = host?.snapshots;
  const list = useSyncExternalStore(
    snapshots?.subscribe ?? noSubscribe,
    snapshots ? snapshots.getSnapshot : () => NO_SNAPSHOTS,
  );
  useEffect(() => {
    void snapshots?.load().catch((error: unknown) => {
      console.warn("[snapshots] load failed:", error);
    });
  }, [snapshots]);
  const [busy, setBusy] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const renameCancelled = useRef(false);
  const [pendingRestore, setPendingRestore] = useState<CatalogSnapshot | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<CatalogSnapshot | null>(
    null,
  );
  const restoreTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (restoreTimer.current !== null)
        window.clearTimeout(restoreTimer.current);
    },
    [],
  );

  const nameOf = useCallback(
    (snapshot: CatalogSnapshot) => catalogSnapshotName(snapshot, t),
    [t],
  );
  const users = list.filter((item) => item.kind === "user");
  const canCreate = users.length < CATALOG_USER_SNAPSHOT_LIMIT;
  const restoredId = snapshots?.restoredId() ?? null;
  const active = historyEmpty
    ? (list.find((item) => item.id === restoredId) ?? null)
    : null;

  const restore = useCallback(
    async (snapshot: CatalogSnapshot) => {
      if (!host) return;
      setBusy(true);
      try {
        await host.restore(
          snapshot.id,
          catalogSnapshotRestoredFrom(snapshot, t),
        );
      } catch (error) {
        console.error("[snapshots] restore failed:", error);
        useToastStore.getState().showToast(
          "error",
          t("history.restoreSnapshotFailed", {
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      } finally {
        setBusy(false);
      }
    },
    [host, t],
  );
  const requestRestore = useCallback(
    (snapshot: CatalogSnapshot) => {
      if (restoreTimer.current !== null)
        window.clearTimeout(restoreTimer.current);
      restoreTimer.current = window.setTimeout(() => {
        restoreTimer.current = null;
        if (historyEmpty) void restore(snapshot);
        else setPendingRestore(snapshot);
      }, RESTORE_CLICK_DELAY_MS);
    },
    [historyEmpty, restore],
  );
  const beginRename = useCallback((snapshot: CatalogSnapshot) => {
    if (restoreTimer.current !== null) {
      window.clearTimeout(restoreTimer.current);
      restoreTimer.current = null;
    }
    if (snapshot.kind !== "user") return;
    renameCancelled.current = false;
    setRenamingId(snapshot.id);
  }, []);
  const commitRename = useCallback(
    (id: string, value: string) => {
      setRenamingId(null);
      if (renameCancelled.current) {
        renameCancelled.current = false;
        return;
      }
      void snapshots?.rename(id, value);
    },
    [snapshots],
  );

  if (!host || !snapshots)
    return { buttons: null, section: null, dialogs: null };

  const buttons = (
    <>
      <ActionIconButton
        onPress={() => {
          void host.create().catch((error: unknown) => {
            console.warn("[snapshots] create refused:", error);
          });
        }}
        isDisabled={!canCreate || busy}
        aria-label={t("history.createSnapshot")}
        tooltip={
          canCreate
            ? t("history.createSnapshotHint")
            : t("history.createSnapshotLimit")
        }
      >
        <Camera size={iconProps.size} />
      </ActionIconButton>
      <ActionIconButton
        onPress={() => active && setPendingDelete(active)}
        isDisabled={!active || busy}
        aria-label={t("history.deleteActiveSnapshot")}
        tooltip={t("history.deleteActiveSnapshot")}
      >
        <DeleteIcon size={iconProps.size} />
      </ActionIconButton>
    </>
  );

  const section = (
    <Section
      title={t("history.snapshotsSection")}
      badge={
        <span className="history-count">
          {users.length}/{CATALOG_USER_SNAPSHOT_LIMIT}
        </span>
      }
      collapsible={false}
      className="history-section history-snapshot-section"
    >
      {list.length > 0 && (
        <div className="history-snapshot-list">
          {list.map((snapshot) => {
            const time = formatTime(new Date(snapshot.createdAt));
            // Restoring back and forth makes several "Before restore — X": their time tells them apart.
            const name =
              snapshot.kind === "system"
                ? `${nameOf(snapshot)} · ${time}`
                : nameOf(snapshot);
            const details =
              snapshot.kind === "system"
                ? formatSize(snapshot.size)
                : `${time} · ${formatSize(snapshot.size)}`;
            const Icon = snapshot.kind === "system" ? ArchiveRestore : Camera;
            return (
              <div
                key={snapshot.id}
                className="history-snapshot-item"
                data-active={snapshot.id === active?.id}
                data-kind={snapshot.kind}
                onDoubleClick={() => beginRename(snapshot)}
              >
                {renamingId === snapshot.id ? (
                  <input
                    className="history-snapshot-rename"
                    aria-label={t("common.rename")}
                    defaultValue={name}
                    autoFocus
                    onFocus={(event) => event.currentTarget.select()}
                    onBlur={(event) =>
                      commitRename(snapshot.id, event.currentTarget.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      else if (event.key === "Escape") {
                        renameCancelled.current = true;
                        event.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => requestRestore(snapshot)}
                    isDisabled={busy}
                    className="history-item-btn history-snapshot-btn"
                    aria-label={`${name}, ${details}`}
                  >
                    <span className="history-item-icon">
                      <Icon size={iconSmall.size} />
                    </span>
                    <span className="history-item-main">
                      <span className="history-label">{name}</span>
                    </span>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );

  const dialogs = (
    <>
      <ConfirmDialog
        isOpen={pendingRestore !== null}
        title={t("history.restoreSnapshotTitle")}
        message={
          pendingRestore
            ? t("history.confirmRestoreSnapshot", {
                name: nameOf(pendingRestore),
              })
            : ""
        }
        confirmLabel={t("history.restoreSnapshotConfirm")}
        tone="default"
        onConfirm={() => {
          const snapshot = pendingRestore;
          setPendingRestore(null);
          if (snapshot) void restore(snapshot);
        }}
        onCancel={() => setPendingRestore(null)}
      />
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={t("history.deleteSnapshotTitle")}
        message={
          pendingDelete
            ? t("history.confirmDeleteSnapshot", {
                name: nameOf(pendingDelete),
              })
            : ""
        }
        onConfirm={() => {
          const snapshot = pendingDelete;
          setPendingDelete(null);
          if (snapshot) void snapshots.remove(snapshot.id);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );

  return { buttons, section, dialogs };
}
