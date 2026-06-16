// ADR-912 6 registry collapse §2-5 #1 — ComponentList 파생 SSOT
//
// 목적: ComponentList 의 7 정적 배열(contentComp/layoutComp/buttonsComp/formsComp/
// collectionsComp/dateTimeComp/overlaysComp = 61 항목)을 catalog entry.panel 파생 +
// PALETTE_ONLY overlay 로 대체. 6 registry 중 #1(Component Panel)을 단일 source 파생으로 collapse.
//
// 구조:
//   - PALETTE_ORDER: palette UI 표시 순서(category 7 + 항목) + source(catalog/overlay) 정본.
//     노출 대상 선별 + 순서를 동시에 표현(catalog 78 중 sub-part 24 는 미포함 = 비노출).
//   - catalog 항목: shared `getPanelMeta(type)` 에서 category/label/icon/layoutOnly 파생.
//   - overlay 항목: catalog 미등록 7(palette O/catalog X) — 별도 catalog 전환은 §2-5-1a(별도 축).
//   - ICON_MAP: panel.icon(string) → lucide 컴포넌트(builder 의존).
//
// 검증: __tests__/paletteItems.test.ts — getPaletteItems() == PALETTE_ORACLE(현 palette 스냅샷)
// 1:1(category/label/icon/layoutOnly/순서). 회귀 0 이 collapse #1 kill criteria.

import {
  AlertTriangle,
  AppWindow,
  AppWindowMac,
  BarChart3,
  Calendar,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CircleDot,
  CircleUser,
  FileUp,
  Frame,
  Grid,
  GroupIcon,
  Hash,
  ImageIcon,
  InspectionPanel,
  Layers,
  Link,
  ListIcon,
  ListTree,
  Loader,
  Menu,
  MessageSquare,
  MousePointer,
  Paintbrush,
  RectangleEllipsis,
  Search,
  SeparatorHorizontal,
  Settings,
  SlidersHorizontal,
  Smile,
  Square,
  SquareCheck,
  Star,
  TableProperties,
  Tag,
  Text,
  ToggleLeft,
  ToggleRight,
  Upload,
  Users,
} from "lucide-react";
import { getPanelMeta, type PanelMeta } from "@composition/shared";

export interface PaletteItem {
  type: string;
  category: string;
  label: string;
  /** lucide 컴포넌트 — panel.icon(string) 매핑 결과. */
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Layout 모드에서만 노출(Slot). */
  layoutOnly?: boolean;
}

/**
 * panel.icon(string) → lucide 컴포넌트 매핑.
 * catalog entry.panel.icon 은 패키지 경계(shared 는 lucide 미의존)상 string 으로 저장 →
 * builder 가 lucide 컴포넌트로 해소. 미매핑 string 은 dev 에서 throw(누락 검출).
 */
export const ICON_MAP: Record<
  string,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  AlertTriangle,
  AppWindow,
  AppWindowMac,
  BarChart3,
  Calendar,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CircleDot,
  CircleUser,
  FileUp,
  Frame,
  Grid,
  GroupIcon,
  Hash,
  ImageIcon,
  InspectionPanel,
  Layers,
  Link,
  ListIcon,
  ListTree,
  Loader,
  Menu,
  MessageSquare,
  MousePointer,
  Paintbrush,
  RectangleEllipsis,
  Search,
  SeparatorHorizontal,
  Settings,
  SlidersHorizontal,
  Smile,
  Square,
  SquareCheck,
  Star,
  TableProperties,
  Tag,
  Text,
  ToggleLeft,
  ToggleRight,
  Upload,
  Users,
};

/**
 * catalog 미등록 7(palette O/catalog X) — builder 측 overlay.
 * §2-5-1a 에서 각 type 의 catalog 전환(C-shell 7 / Image escape / TailSwatch palette-only)은
 * 별도 축. 본 proof 는 ComponentList 파생 메커니즘 증명이 목적이라 7 을 palette-only 로 유지.
 */
const PALETTE_ONLY: Record<string, Omit<PanelMeta, "placeable">> = {
  AvatarGroup: { category: "content", label: "avatar group", icon: "Users" },
  Image: { category: "content", label: "image", icon: "ImageIcon" },
  // ADR-912 R6 (2026-06-15): Card 본체 catalog cutover → PALETTE_ONLY overlay 에서 제거,
  //   catalog entry.panel(category layout, AppWindowMac) 파생으로 전환. PALETTE_ORDER source=catalog.
  CardView: { category: "layout", label: "card view", icon: "Grid" },
  ButtonGroup: {
    category: "buttons",
    label: "button group",
    icon: "GroupIcon",
  },
  TailSwatch: { category: "forms", label: "color picker", icon: "Paintbrush" },
  TableView: {
    category: "collections",
    label: "table view",
    icon: "TableProperties",
  },
};

/**
 * palette UI 표시 순서 + source 정본. catalog 78 중 sub-part/leaf 24 는 미포함(비노출).
 * AUTO-CAPTURED: 현 ComponentList 정적 배열 순서(2026-06-11). 의도적 변경 시에만 재생성.
 */
const PALETTE_ORDER: ReadonlyArray<{
  type: string;
  source: "catalog" | "overlay";
}> = [
  { type: "Text", source: "catalog" },
  { type: "Icon", source: "catalog" },
  { type: "Separator", source: "catalog" },
  { type: "Badge", source: "catalog" },
  { type: "ProgressBar", source: "catalog" },
  { type: "Skeleton", source: "catalog" },
  { type: "Avatar", source: "catalog" },
  { type: "AvatarGroup", source: "overlay" },
  { type: "StatusLight", source: "catalog" },
  { type: "InlineAlert", source: "catalog" },
  { type: "ProgressCircle", source: "catalog" },
  { type: "Image", source: "overlay" },
  { type: "IllustratedMessage", source: "catalog" },
  { type: "Card", source: "catalog" },
  { type: "frame", source: "catalog" },
  { type: "Tabs", source: "catalog" },
  { type: "Breadcrumbs", source: "catalog" },
  { type: "Link", source: "catalog" },
  { type: "Nav", source: "catalog" },
  { type: "DisclosureGroup", source: "catalog" },
  { type: "Disclosure", source: "catalog" },
  { type: "CardView", source: "overlay" },
  { type: "Slot", source: "catalog" },
  { type: "Button", source: "catalog" },
  { type: "ToggleButton", source: "catalog" },
  { type: "ToggleButtonGroup", source: "catalog" },
  { type: "Toolbar", source: "catalog" },
  { type: "ButtonGroup", source: "overlay" },
  { type: "Menu", source: "catalog" },
  { type: "TextField", source: "catalog" },
  { type: "NumberField", source: "catalog" },
  { type: "SearchField", source: "catalog" },
  { type: "Checkbox", source: "catalog" },
  { type: "CheckboxGroup", source: "catalog" },
  { type: "RadioGroup", source: "catalog" },
  { type: "Select", source: "catalog" },
  { type: "ComboBox", source: "catalog" },
  { type: "Switch", source: "catalog" },
  { type: "Slider", source: "catalog" },
  { type: "TailSwatch", source: "overlay" },
  { type: "DropZone", source: "catalog" },
  { type: "FileTrigger", source: "catalog" },
  { type: "Form", source: "catalog" },
  { type: "Table", source: "catalog" },
  { type: "ListBox", source: "catalog" },
  { type: "GridList", source: "catalog" },
  { type: "Tree", source: "catalog" },
  { type: "TagGroup", source: "catalog" },
  { type: "Section", source: "catalog" },
  { type: "TableView", source: "overlay" },
  { type: "Calendar", source: "catalog" },
  { type: "DatePicker", source: "catalog" },
  { type: "DateRangePicker", source: "catalog" },
  { type: "DateField", source: "catalog" },
  { type: "TimeField", source: "catalog" },
  { type: "RangeCalendar", source: "catalog" },
  { type: "Dialog", source: "catalog" },
  { type: "Modal", source: "catalog" },
  { type: "Popover", source: "catalog" },
  { type: "Tooltip", source: "catalog" },
];

function resolveIcon(
  iconName: string,
): React.ComponentType<React.SVGProps<SVGSVGElement>> {
  const Icon = ICON_MAP[iconName];
  if (!Icon) {
    throw new Error(
      `[paletteItems] 미매핑 lucide icon: "${iconName}". ICON_MAP 에 추가 필요.`,
    );
  }
  return Icon;
}

/**
 * ComponentList palette 항목 파생. 6 registry collapse #1 의 단일 source.
 * - catalog 항목: getPanelMeta(type) 파생 (category/label/icon/layoutOnly).
 * - overlay 항목: PALETTE_ONLY 명시 메타.
 * 순서 = PALETTE_ORDER(palette UI 표시 순서).
 */
export function getPaletteItems(): PaletteItem[] {
  return PALETTE_ORDER.map(({ type, source }) => {
    const meta =
      source === "catalog"
        ? getPanelMeta(type)
        : { ...PALETTE_ONLY[type], placeable: true as const };
    if (!meta) {
      throw new Error(
        `[paletteItems] PALETTE_ORDER type "${type}" 의 panel 메타 없음 (catalog 미등록).`,
      );
    }
    const item: PaletteItem = {
      type,
      category: meta.category,
      label: meta.label,
      icon: resolveIcon(meta.icon),
    };
    if (meta.layoutOnly) item.layoutOnly = true;
    return item;
  });
}
