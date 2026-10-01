/**
 * 헤더 전용 동작 (ADR-249 §2-4) — 단축키 정의 밖의 전체 메뉴 항목.
 *
 * `ShortcutDefinition.key` 가 필수라 (`types/keyboard.ts`) 키 없는 동작을 정의에
 * 넣지 않고 여기 별도 타입으로 둔다. 파일 대화상자 · 내보내기처럼 헤더가 가진
 * 콜백은 `HeaderMenuHost` 로 받고, store 로 끝나는 동작 (스냅 · 모양 · 스냅샷) 은
 * 여기서 직접 부른다.
 */
import { useBuilderUiStore } from "../../stores/builderUiStore";
import type { ThemeMode } from "../../../stores/uiStore";
import {
  createUserSnapshot,
  resolveUserSnapshotTarget,
} from "../../panels/history/userSnapshotActions";
import type { HeaderMenuRuntime } from "./headerMenuRuntime";

/** 헤더 (`BuilderHeader`) 가 넘기는 콜백 — 메뉴 chunk 는 이것만 안다. */
export interface HeaderMenuHost {
  projectId?: string;
  onImportProject: () => void;
  onExportProject: () => void;
  onExportProjectJson: () => void;
  onConnectFolder: () => void;
  /** ADR-248 4e-6-32 — 열린 catalog 프로젝트의 스냅샷 (없으면 옛 store 의 스냅샷). */
  snapshotActions?: { canCreate: () => boolean; create: () => void };
  /** 확인 대화상자를 연다 — 삭제 자체는 대시보드가 한다. */
  onDeleteProject: () => void;
  onResetPanelLayout: () => void;
  /** initial 전용 모듈 접근 — lazy chunk 는 타입만 import 한다 (`headerMenuRuntime.ts`). */
  runtime: HeaderMenuRuntime;
}

export type HeaderMenuActionId =
  | "importProject"
  | "exportProject"
  | "exportProjectJson"
  | "connectFolder"
  | "createSnapshot"
  | "deleteProject"
  | "resetPanelLayout"
  | "snapToObjects"
  | "themeAuto"
  | "themeLight"
  | "themeDark";

export interface HeaderMenuActionSpec {
  labelKey: string;
  /** 대화상자를 연다 — 라벨 뒤에 `…` (Framer 어법 #10). */
  opensDialog?: true;
  /** 플랫폼 능력이 없으면 항목 자체를 숨긴다 (상태가 아니라 능력 부재). */
  isSupported?: () => boolean;
  isEnabled?: (host: HeaderMenuHost) => boolean;
  isChecked?: (host: HeaderMenuHost) => boolean;
  run: (host: HeaderMenuHost) => void;
}

const THEME_ACTION_MODES = {
  themeAuto: "auto",
  themeLight: "light",
  themeDark: "dark",
} as const satisfies Partial<Record<HeaderMenuActionId, ThemeMode>>;

const themeAction = (
  id: keyof typeof THEME_ACTION_MODES,
  labelKey: string,
): HeaderMenuActionSpec => ({
  labelKey,
  isChecked: (host) => host.runtime.getThemeMode() === THEME_ACTION_MODES[id],
  run: (host) => host.runtime.setThemeMode(THEME_ACTION_MODES[id]),
});

export const HEADER_MENU_ACTIONS: Readonly<
  Record<HeaderMenuActionId, HeaderMenuActionSpec>
> = {
  importProject: {
    labelKey: "header.importProject",
    opensDialog: true,
    run: (host) => host.onImportProject(),
  },
  exportProject: {
    labelKey: "header.exportProject",
    run: (host) => host.onExportProject(),
  },
  exportProjectJson: {
    labelKey: "header.exportProjectJson",
    run: (host) => host.onExportProjectJson(),
  },
  connectFolder: {
    // 라벨 원문이 이미 `…` 로 끝난다 ("폴더에 연결…")
    labelKey: "header.connectFolder",
    isSupported: () =>
      typeof window !== "undefined" && "showDirectoryPicker" in window,
    run: (host) => host.onConnectFolder(),
  },
  createSnapshot: {
    labelKey: "history.createSnapshot",
    isEnabled: (host) =>
      host.snapshotActions
        ? host.snapshotActions.canCreate()
        : resolveUserSnapshotTarget() !== null,
    run: (host) => {
      if (host.snapshotActions) {
        host.snapshotActions.create();
        return;
      }
      const projectId = resolveUserSnapshotTarget();
      if (projectId) void createUserSnapshot(projectId);
    },
  },
  deleteProject: {
    labelKey: "header.deleteProject",
    opensDialog: true,
    isEnabled: (host) => Boolean(host.projectId),
    run: (host) => host.onDeleteProject(),
  },
  resetPanelLayout: {
    labelKey: "header.resetPanelLayout",
    run: (host) => host.onResetPanelLayout(),
  },
  snapToObjects: {
    labelKey: "contextMenu.snapToObjects",
    isChecked: () => useBuilderUiStore.getState().snapToObjects,
    run: () => {
      const { snapToObjects, setSnapToObjects } = useBuilderUiStore.getState();
      setSnapToObjects(!snapToObjects);
    },
  },
  themeAuto: themeAction("themeAuto", "settings.themeModeAuto"),
  themeLight: themeAction("themeLight", "settings.themeModeLight"),
  themeDark: themeAction("themeDark", "settings.themeModeDark"),
};
