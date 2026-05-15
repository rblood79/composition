import { useMemo, useCallback, memo, useState, useEffect } from "react";
import { translations } from "../../../i18n";
import {
  AppWindowMac,
  SeparatorHorizontal,
  Square,
  Text,
  ToggleLeft,
  AppWindow,
  InspectionPanel,
  SlidersHorizontal,
  MousePointer,
  Tag,
  CalendarCheck,
  CalendarDays,
  RectangleEllipsis,
  Calendar,
  ListTree,
  Menu,
  GroupIcon,
  ListIcon,
  Grid,
  TableProperties,
  SquareCheck,
  ChevronDown,
  Search,
  ToggleRight,
  Hash,
  MessageSquare,
  Settings,
  BarChart3,
  ChevronRight,
  Star,
  Trash2,
  Link,
  Paintbrush,
  Layers,
  Box,
  Smile,
  Frame,
  Loader,
  Upload,
  FileUp,
  CircleUser,
  Users,
  CircleDot,
  AlertTriangle,
  CircleDashed,
  ImageIcon,
  ChevronsDownUp,
} from "lucide-react";
import { PanelHeader, Section } from "../../components";
import { ActionIconButton } from "../../components/ui/ActionIconButton";
import { useEditModeStore } from "../../stores/editMode";
import { iconProps } from "../../../utils/ui/uiConstants";
import { ComponentSearch } from "./ComponentSearch";
import { useRecentComponents } from "../../hooks/useRecentComponents";
import { useFavoriteComponents } from "../../hooks/useFavoriteComponents";
import { useSectionCollapse } from "../styles/hooks/useSectionCollapse";
import "@composition/shared/components/styles/ComponentList.css";
import { Badge } from "@composition/shared/components/Badge";
// import { ToggleButton, ToggleButtonGroup, Button, TextField, Label, Input, Description, FieldError, Checkbox, CheckboxGroup } from '../components/list';

interface ComponentListProps {
  handleAddElement: (type: string, parentId?: string) => void;
  selectedElementId?: string | null;
}

// 컴포넌트 정의 (React Aria / Spectrum 공식 분류 기준, 실용적 병합)
const contentComp = [
  { type: "Text", label: "text", icon: Text },
  { type: "Icon", label: "icon", icon: Smile },
  { type: "Separator", label: "separator", icon: SeparatorHorizontal },
  { type: "Badge", label: "badge", icon: Star },
  { type: "ProgressBar", label: "progress bar", icon: BarChart3 },
  { type: "Skeleton", label: "skeleton", icon: Loader },
  { type: "Avatar", label: "avatar", icon: CircleUser },
  { type: "AvatarGroup", label: "avatar group", icon: Users },
  { type: "StatusLight", label: "status light", icon: CircleDot },
  { type: "InlineAlert", label: "inline alert", icon: AlertTriangle },
  { type: "ProgressCircle", label: "progress circle", icon: CircleDashed },
  { type: "Image", label: "image", icon: ImageIcon },
  { type: "IllustratedMessage", label: "illustrated message", icon: ImageIcon },
] as const;

const layoutComp = [
  { type: "Card", label: "card", icon: AppWindowMac },
  { type: "frame", label: "frame", icon: GroupIcon },
  { type: "Tabs", label: "tabs", icon: AppWindow },
  { type: "Breadcrumbs", label: "breadcrumbs", icon: ChevronRight },
  { type: "Link", label: "link", icon: Link },
  { type: "Nav", label: "navigation", icon: Menu },
  { type: "MaskedFrame", label: "masked frame", icon: Frame },
  { type: "Accordion", label: "accordion", icon: ChevronDown },
  { type: "Disclosure", label: "disclosure", icon: ChevronDown },
  { type: "CardView", label: "card view", icon: Grid },
  { type: "Slot", label: "slot", icon: Layers, layoutOnly: true },
] as const;

const buttonsComp = [
  { type: "Button", label: "button", icon: MousePointer },
  { type: "ToggleButton", label: "toggle button", icon: ToggleLeft },
  { type: "ToggleButtonGroup", label: "toggle button group", icon: GroupIcon },
  { type: "Toolbar", label: "toolbar", icon: Settings },
  { type: "ButtonGroup", label: "button group", icon: GroupIcon },
  { type: "Menu", label: "menu", icon: Menu },
] as const;

const formsComp = [
  { type: "TextField", label: "text field", icon: RectangleEllipsis },
  { type: "NumberField", label: "number field", icon: Hash },
  { type: "SearchField", label: "search field", icon: Search },
  { type: "Checkbox", label: "checkbox", icon: SquareCheck },
  { type: "CheckboxGroup", label: "checkbox group", icon: GroupIcon },
  { type: "RadioGroup", label: "radio group", icon: GroupIcon },
  { type: "Select", label: "select", icon: ChevronDown },
  { type: "ComboBox", label: "combo box", icon: ChevronDown },
  { type: "Switch", label: "switch", icon: ToggleRight },
  { type: "Slider", label: "slider", icon: SlidersHorizontal },
  { type: "TailSwatch", label: "color picker", icon: Paintbrush },
  { type: "DropZone", label: "drop zone", icon: Upload },
  { type: "FileTrigger", label: "file trigger", icon: FileUp },
  { type: "Form", label: "form", icon: GroupIcon },
] as const;

const collectionsComp = [
  { type: "Table", label: "table", icon: TableProperties },
  { type: "ListBox", label: "list box", icon: ListIcon },
  { type: "GridList", label: "grid list", icon: Grid },
  { type: "Tree", label: "tree", icon: ListTree },
  { type: "TagGroup", label: "type group", icon: Tag },
  { type: "Section", label: "section", icon: Square },
  { type: "TableView", label: "table view", icon: TableProperties },
] as const;

const dateTimeComp = [
  { type: "Calendar", label: "calendar", icon: Calendar },
  { type: "DatePicker", label: "date picker", icon: CalendarCheck },
  { type: "DateRangePicker", label: "date range picker", icon: CalendarDays },
  { type: "DateField", label: "date field", icon: CalendarCheck },
  { type: "TimeField", label: "time field", icon: ChevronDown },
  { type: "RangeCalendar", label: "range calendar", icon: CalendarDays },
] as const;

const overlaysComp = [
  { type: "Dialog", label: "dialog", icon: AppWindowMac },
  { type: "Modal", label: "modal", icon: InspectionPanel },
  { type: "Popover", label: "popover", icon: AppWindowMac },
  { type: "Tooltip", label: "tooltip", icon: MessageSquare },
] as const;

// 카테고리 설정 (레이블 및 설명)
const categoryConfig = {
  content: { label: "Content", description: "Display and indicators" },
  layout: { label: "Layout", description: "Containers and navigation" },
  buttons: { label: "Buttons", description: "Actions and triggers" },
  forms: { label: "Forms", description: "Inputs and controls" },
  collections: { label: "Collections", description: "Lists and data display" },
  dateTime: { label: "Date & Time", description: "Date and time pickers" },
  overlays: { label: "Overlays", description: "Dialogs and popups" },
} as const;

// 개별 컴포넌트 아이템을 메모이제이션
const ComponentItem = ({
  component,
  onAdd,
  selectedElementId,
  isRecent = false,
  count = 0,
}: {
  component: {
    type: string;
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  };
  onAdd: (type: string, parentId?: string) => void;
  selectedElementId?: string | null;
  isRecent?: boolean;
  count?: number;
}) => {
  const handleClick = useCallback(() => {
    onAdd(component.type, selectedElementId || undefined);
  }, [component.type, onAdd, selectedElementId]);

  return (
    <button
      className="list-item"
      onClick={handleClick}
      title={`Add ${component.label} element`}
    >
      <div className="list-item-icon">
        <component.icon strokeWidth={1.5} width={16} height={16} />
      </div>
      {isRecent && count > 0 && <Badge>{count}</Badge>}
      <span className="list-item-name">{component.label}</span>
    </button>
  );
};

ComponentItem.displayName = "ComponentItem";

// 메인 컴포넌트
const ComponentList = memo(
  ({ handleAddElement, selectedElementId }: ComponentListProps) => {
    const {
      recentTags,
      addRecentComponent,
      clearRecentComponents,
      getComponentCount,
    } = useRecentComponents();
    const { favoriteTags } = useFavoriteComponents();
    const [searchQuery, setSearchQuery] = useState("");

    // Edit Mode 상태 가져오기 (Layout 모드에서만 Slot 컴포넌트 표시)
    const editMode = useEditModeStore((state) => state.mode);
    const isLayoutMode = editMode === "layout";

    // 검색 시 카테고리 자동 펼치기 (Section 컴포넌트가 collapse 상태 자체를 관리)
    const expandSections = useSectionCollapse((s) => s.expandSections);
    const collapseAll = useSectionCollapse((s) => s.collapseAll);

    const compSectionIds = useMemo(
      () => Object.keys(categoryConfig).map((key) => `comp-${key}`),
      [],
    );

    const handleCollapseAll = useCallback(() => {
      collapseAll(compSectionIds);
    }, [collapseAll, compSectionIds]);

    // 이벤트 핸들러를 메모이제이션
    const handleComponentAdd = useCallback(
      (type: string, parentId?: string) => {
        handleAddElement(type, parentId);
        addRecentComponent(type); // Recent에 추가
      },
      [handleAddElement, addRecentComponent],
    );

    // 컴포넌트 그룹을 메모이제이션 (7개 카테고리)
    // Layout 모드가 아닐 때는 layoutOnly 컴포넌트(Slot)를 필터링
    const componentGroups = useMemo(
      () => ({
        content: contentComp,
        layout: isLayoutMode
          ? layoutComp
          : layoutComp.filter(
              (comp) => !("layoutOnly" in comp && comp.layoutOnly),
            ),
        buttons: buttonsComp,
        forms: formsComp,
        collections: collectionsComp,
        dateTime: dateTimeComp,
        overlays: overlaysComp,
      }),
      [isLayoutMode],
    );

    // 검색용 모든 컴포넌트 배열 생성
    const allComponents = useMemo(() => {
      return Object.entries(componentGroups).flatMap(
        ([categoryKey, components]) => {
          const config =
            categoryConfig[categoryKey as keyof typeof categoryConfig];
          return components.map((comp) => ({
            ...comp,
            category: config.label,
            categoryKey,
          }));
        },
      );
    }, [componentGroups]);

    // Tag → i18n key 매핑 (모든 locale 번역으로 검색 가능)
    const i18nLabelsMap = useMemo(() => {
      const map = new Map<string, string[]>();
      const specialTagMap: Record<string, string> = {
        TailSwatch: "colorPicker",
      };
      const allLocales = Object.values(translations);

      for (const comp of allComponents) {
        const i18nKey =
          specialTagMap[comp.type] ??
          comp.type[0].toLowerCase() + comp.type.slice(1);
        const labels: string[] = [];
        for (const locale of allLocales) {
          const label = (
            locale.components as Record<string, string | undefined>
          )[i18nKey];
          if (label) labels.push(label.toLowerCase());
        }
        map.set(comp.type, labels);
      }
      return map;
    }, [allComponents]);

    // Fuzzy search results (다국어 지원)
    const searchResults = useMemo(() => {
      if (!searchQuery.trim()) return null;

      const lowerQuery = searchQuery.toLowerCase();

      const scored = allComponents.map((comp) => {
        const lowerLabel = comp.label.toLowerCase();
        const lowerTag = comp.type.toLowerCase();
        const lowerCategory = comp.category.toLowerCase();
        const i18nLabels = i18nLabelsMap.get(comp.type) ?? [];

        let score = 0;

        // Exact match (English)
        if (lowerLabel === lowerQuery || lowerTag === lowerQuery) {
          score += 100;
        }

        // Exact match (i18n)
        if (i18nLabels.some((l) => l === lowerQuery)) {
          score += 100;
        }

        // Starts with query (English)
        if (
          lowerLabel.startsWith(lowerQuery) ||
          lowerTag.startsWith(lowerQuery)
        ) {
          score += 50;
        }

        // Starts with query (i18n)
        if (i18nLabels.some((l) => l.startsWith(lowerQuery))) {
          score += 50;
        }

        // Contains query (English)
        if (lowerLabel.includes(lowerQuery)) {
          score += 30;
        }
        if (lowerTag.includes(lowerQuery)) {
          score += 25;
        }
        if (lowerCategory.includes(lowerQuery)) {
          score += 10;
        }

        // Contains query (i18n)
        if (i18nLabels.some((l) => l.includes(lowerQuery))) {
          score += 30;
        }

        // Multi-word matching
        const words = lowerQuery.split(" ").filter((w) => w.length > 0);
        const allWordsMatch = words.every(
          (word) =>
            lowerLabel.includes(word) ||
            lowerTag.includes(word) ||
            i18nLabels.some((l) => l.includes(word)),
        );
        if (allWordsMatch && words.length > 1) {
          score += 20;
        }

        return { ...comp, score };
      });

      return scored
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);
    }, [searchQuery, allComponents, i18nLabelsMap]);

    // Group search results by category
    const filteredGroups = useMemo(() => {
      if (!searchResults) return null;

      const groups: Record<string, typeof allComponents> = {};

      searchResults.forEach((comp) => {
        if (!groups[comp.categoryKey]) {
          groups[comp.categoryKey] = [];
        }
        groups[comp.categoryKey].push(comp);
      });

      return groups;
    }, [searchResults]);

    // Recent 컴포넌트 가져오기
    const recentComponents = useMemo(() => {
      return recentTags
        .map((type) => allComponents.find((comp) => comp.type === type))
        .filter((comp): comp is (typeof allComponents)[0] => comp !== undefined)
        .slice(0, 8);
    }, [recentTags, allComponents]);

    // Favorites 컴포넌트 가져오기
    const favoriteComponents = useMemo(() => {
      return favoriteTags
        .map((type) => allComponents.find((comp) => comp.type === type))
        .filter(
          (comp): comp is (typeof allComponents)[0] => comp !== undefined,
        );
    }, [favoriteTags, allComponents]);

    // 검색 시 검색 결과가 있는 카테고리 자동 펼치기
    useEffect(() => {
      if (searchQuery && filteredGroups) {
        const sectionIds = Object.keys(filteredGroups).map(
          (key) => `comp-${key}`,
        );
        expandSections(sectionIds);
      }
    }, [searchQuery, filteredGroups, expandSections]);

    return (
      <div className="panel">
        <PanelHeader
          icon={<Box size={16} />}
          title="Components"
          actions={
            <>
              <ActionIconButton
                tooltip="Collapse all sections"
                onPress={handleCollapseAll}
              >
                <ChevronsDownUp
                  color={iconProps.color}
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
              </ActionIconButton>
            </>
          }
        />

        {/* 검색바 */}
        <ComponentSearch onSearchChange={setSearchQuery} />

        <div className="panel-contents">
          {/* Recent 컴포넌트 - 검색 시 숨김 */}
          {!searchQuery && recentComponents.length > 0 && (
            <Section
              title="Recently Used"
              badge={
                <span className="category-count">
                  {recentComponents.length}
                </span>
              }
              actions={
                <button
                  className="iconButton"
                  aria-label="Clear Recent History"
                  onClick={clearRecentComponents}
                >
                  <Trash2
                    color={iconProps.color}
                    strokeWidth={iconProps.strokeWidth}
                    size={iconProps.size}
                  />
                </button>
              }
              collapsible={false}
            >
              <div className="list-group" role="list">
                {recentComponents.map((component) => (
                  <ComponentItem
                    key={component.type}
                    component={component}
                    onAdd={handleComponentAdd}
                    selectedElementId={selectedElementId}
                    isRecent={true}
                    count={getComponentCount(component.type)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Favorites 컴포넌트 - 항상 표시 */}
          {favoriteComponents.length > 0 && (
            <Section
              title="Favorites"
              badge={
                <span className="category-count">
                  {favoriteComponents.length}
                </span>
              }
              collapsible={false}
            >
              <div className="list-group" role="list">
                {favoriteComponents.map((component) => (
                  <ComponentItem
                    key={component.type}
                    component={component}
                    onAdd={handleComponentAdd}
                    selectedElementId={selectedElementId}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* 카테고리별 컴포넌트 */}
          {searchQuery && filteredGroups ? (
            // 검색 모드: 필터링된 카테고리만 표시
            Object.entries(filteredGroups).map(([groupName, components]) => {
              const categoryKey = groupName as keyof typeof categoryConfig;
              const config = categoryConfig[categoryKey];

              if (!components || components.length === 0) return null;

              return (
                <Section
                  key={groupName}
                  id={`comp-${categoryKey}`}
                  title={config.label}
                  badge={
                    <span className="category-count">{components.length}</span>
                  }
                >
                  <div className="list-group" role="list">
                    {components.map((component) => (
                      <ComponentItem
                        key={component.type}
                        component={component}
                        onAdd={handleComponentAdd}
                        selectedElementId={selectedElementId}
                      />
                    ))}
                  </div>
                </Section>
              );
            })
          ) : !searchQuery ? (
            // 일반 모드: 모든 카테고리 표시
            Object.entries(componentGroups).map(([groupName, components]) => {
              const categoryKey = groupName as keyof typeof categoryConfig;
              const config = categoryConfig[categoryKey];

              return (
                <Section
                  key={groupName}
                  id={`comp-${categoryKey}`}
                  title={config.label}
                  badge={
                    <span className="category-count">{components.length}</span>
                  }
                >
                  <div className="list-group" role="list">
                    {components.map((component) => (
                      <ComponentItem
                        key={component.type}
                        component={component}
                        onAdd={handleComponentAdd}
                        selectedElementId={selectedElementId}
                      />
                    ))}
                  </div>
                </Section>
              );
            })
          ) : (
            // 검색 결과 없음
            <div className="section">
              <div className="search-no-results">
                <Search size={24} color={iconProps.color} />
                <p className="no-results-title">No components found</p>
                <p className="no-results-hint">
                  Try 'button', 'input', or 'table'
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

ComponentList.displayName = "ComponentList";

export default ComponentList;
