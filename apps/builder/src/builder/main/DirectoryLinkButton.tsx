/**
 * ADR-235 Phase 6 — 연결 폴더 상태 (헤더, 연결된 프로젝트에서만 lazy 로 싣는다).
 * 권한 필요 · 충돌 · 실패를 표시하고 해소 동작 (권한 허용 · 폴더 내용으로 열기 · 덮어쓰기 · 연결 해제)
 * 을 메뉴로 준다.
 */
import { AlertTriangle, FolderSync } from "lucide-react";
import { MenuTrigger, Menu, MenuItem } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { Button } from "react-aria-components/Button";
import type { Key } from "react-aria-components/Collection";
import { useEffect, useState } from "react";
import { iconProps } from "../../utils/ui/uiConstants";
import { useI18n } from "../../i18n";
// 타입만 — 값 import 는 lazy 연결 모듈 전체를 initial 로 끌어온다 (ADR-235 HC2)
import type { DirectoryLinkState } from "../../lib/assets/projectDirectoryLink";

/** `projectDirectoryLink.DIRECTORY_LINK_EVENT` 와 같은 값 */
const DIRECTORY_LINK_EVENT = "composition:directory-link";

export type DirectoryLinkAction =
  "permission" | "open" | "overwrite" | "restore" | "disconnect";

export default function DirectoryLinkButton({
  projectId,
  onAction,
}: {
  projectId: string;
  onAction: (action: DirectoryLinkAction) => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<DirectoryLinkState | null>(null);
  useEffect(() => {
    const onState = (event: Event) => {
      const detail = (event as CustomEvent<DirectoryLinkState>).detail;
      if (detail.projectId === projectId) setState(detail);
    };
    window.addEventListener(DIRECTORY_LINK_EVENT, onState);
    return () => window.removeEventListener(DIRECTORY_LINK_EVENT, onState);
  }, [projectId]);

  const status = state?.status ?? "idle";
  const problem =
    status === "needs-permission" ||
    status === "conflict" ||
    status === "cleared" ||
    status === "error";
  const label =
    status === "needs-permission"
      ? t("header.folderNeedsPermission")
      : status === "conflict"
        ? t("header.folderConflict")
        : status === "cleared"
          ? t("header.folderCleared")
          : status === "error"
            ? `${t("header.folderError")}: ${state?.error ?? ""}`
            : status === "writing"
              ? t("header.folderWriting")
              : `${t("header.folderSynced")} · ${state?.directoryName ?? ""}`;
  const Icon = problem ? AlertTriangle : FolderSync;
  return (
    <MenuTrigger>
      <Button
        className={`react-aria-Button directory-link${problem ? " directory-link--problem" : ""}`}
        aria-label={label}
        data-status={status}
      >
        <Icon strokeWidth={iconProps.strokeWidth} size={iconProps.size} />
      </Button>
      <Popover
        className="header-menu-popover"
        placement="bottom end"
        offset={8}
      >
        <Menu
          className="header-menu"
          onAction={(key: Key) => onAction(key as DirectoryLinkAction)}
        >
          <MenuItem id="status" className="header-menu-item" isDisabled>
            {label}
          </MenuItem>
          {status === "needs-permission" && (
            <MenuItem id="permission" className="header-menu-item">
              {t("header.folderAllow")}
            </MenuItem>
          )}
          {status === "cleared" && (
            <MenuItem id="restore" className="header-menu-item">
              {t("header.folderOpen")}
            </MenuItem>
          )}
          {status === "conflict" && (
            <MenuItem id="open" className="header-menu-item">
              {t("header.folderOpen")}
            </MenuItem>
          )}
          {(status === "conflict" || status === "error") && (
            <MenuItem id="overwrite" className="header-menu-item">
              {t("header.folderOverwrite")}
            </MenuItem>
          )}
          <MenuItem id="disconnect" className="header-menu-item">
            {t("header.folderDisconnect")}
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
