/**
 * 전체 메뉴 lazy chunk 가 부르는 initial 전용 모듈의 함수 묶음 (ADR-249 §4-3 · G2).
 *
 * `BuilderHeader` (initial) 가 정적으로 import 해 `HeaderMenuHost.runtime` 으로 넘기고,
 * lazy 쪽 (`HeaderMainMenu` · `menuModel` · `headerMenuActions` · `resolveMenuItemState`)
 * 은 타입만 본다. Rolldown 은 main entry 전용 모듈을 dynamic chunk 가 직접 import 하면
 * main 에서 떼어 작은 청크로 나눈다 — 2026-09-29 A/B 실측에서 아래 네 모듈이 각각
 * 청크로 쪼개져 initial raw +353 B 가 gzip +2,680 B 가 됐다 (압축 문맥이 끊긴다).
 * 공유 청크의 **일부** 모듈만 닿아도 같은 일이 난다 (i18n · formatShortcut · 아이콘 ·
 * 팔레트 검색 필터 · commandRegistry · 검색창). 새 lazy 소비가 initial 모듈을 부르려면 여기로 옮기고 G2 를 다시 잰다.
 */
import { Check, ChevronRight } from "lucide-react";
import { useI18n } from "../../../i18n";
import { useUiStore, type ThemeMode } from "../../../stores/uiStore";
import { formatShortcut } from "../../hooks/useKeyboardShortcutsRegistry";
import { matchesCommandSearch } from "../../components/overlay/commandSearch";
import { getPanelLabel } from "../../layout/panelLabels";
import { SearchField } from "../../components/ui/SearchField";
import {
  getCommandRegistrySnapshot,
  resolveCommand,
  subscribeCommandRegistry,
} from "../../stores/commandRegistry";
import { iconProps } from "../../../utils/ui/uiConstants";
import { panelIdForScope } from "../../hooks/useActiveScope";

export const HEADER_MENU_RUNTIME = {
  SearchField,
  resolveCommand,
  subscribeCommandRegistry,
  getCommandRegistrySnapshot,
  useI18n,
  formatShortcut,
  matchesCommandSearch,
  icons: { Check, ChevronRight },
  /** 메뉴 아이콘 크기 · 선 굵기 — 레일 · 패널과 같은 빌더 표준 (`iconProps`, 16) */
  iconSize: iconProps.size,
  iconStrokeWidth: iconProps.strokeWidth,
  useThemeMode: (): ThemeMode => useUiStore((state) => state.themeMode),
  getThemeMode: (): ThemeMode => useUiStore.getState().themeMode,
  setThemeMode: (mode: ThemeMode) => useUiStore.getState().setThemeMode(mode),
  panelLabel: getPanelLabel,
  panelIdForScope,
};

export type HeaderMenuRuntime = typeof HEADER_MENU_RUNTIME;
