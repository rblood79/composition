/**
 * ADR-235 Phase 6 — 연결 폴더 상태 (헤더, 연결된 프로젝트에서만 lazy 로 싣는다).
 * 권한 필요 · 충돌 · 실패를 표시하고 해소 동작 (권한 허용 · 폴더 내용으로 열기 · 덮어쓰기 · 연결 해제)
 * 을 메뉴로 준다. 권한 필요는 허용 버튼을 헤더에 바로 둔다.
 */
import { AlertTriangle, FolderSync } from "lucide-react";
import { MenuTrigger, Menu, MenuItem } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { Button } from "react-aria-components/Button";
import type { Key } from "react-aria-components/Collection";
import { useEffect, useState } from "react";
import { iconProps } from "../../utils/ui/uiConstants";
import { ActionTooltipTrigger } from "../components/ui/ActionTooltip";
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
  const denied = status === "needs-permission" && state?.permissionDenied;
  const label =
    status === "needs-permission"
      ? t(
          denied
            ? "header.folderPermissionDenied"
            : "header.folderNeedsPermission",
        )
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
  const menu = (
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
  if (status !== "needs-permission") return menu;
  // 권한 허용은 메뉴 안쪽이 아니라 헤더에 바로 둔다 — 폴더 쓰기가 멈춘 이유와 해소 동작을 한 번에
  //   보인다 (Chrome case study <permission> element: 맥락 안의 CTA · 거부 뒤 복구 경로).
  return (
    <span className="directory-link-group" data-status={status}>
      {menu}
      {/* 멈춘 이유 (편집은 브라우저에 보존 · 거부됨) 를 버튼 위에서도 읽는다 */}
      <ActionTooltipTrigger tooltip={label}>
        <Button
          className="react-aria-Button directory-link-allow"
          onPress={() => onAction("permission")}
        >
          {t(denied ? "header.folderAllowAgain" : "header.folderAllow")}
        </Button>
      </ActionTooltipTrigger>
    </span>
  );
}
