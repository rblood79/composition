/**
 * FontFamilyPicker - Font Family 선택 + 폰트 관리 진입점
 *
 * Typography 섹션의 Font Family 필드. 생김새는 다른 select 필드와 같지만 내용은
 * 팝오버라 **목록 안에 관리 진입점**을 둘 수 있다.
 *
 * ## Why 여기에 관리 진입점이 있나 (Figma / Pen 실측, 2026-08-24)
 *
 * - **Figma**: 파일 우측 패널에는 피커만 있고, 업로드는 Admin → Resources → Fonts.
 *   인스펙터에 폰트 관리 UI 가 없다.
 * - **Pen**: 피커 안에 검색 + "All Fonts / Custom Fonts" 필터 + `Add`/`Manage`
 *   버튼이 있고, 그 버튼이 문서 스코프 "Custom Fonts" **모달**을 연다.
 *
 * 두 앱 다 **선택(고빈도)은 피커 안 / 관리(저빈도)는 다른 표면**이고, 관리 표면이
 * 인스펙터 레일을 상주로 차지하는 도킹 패널인 경우는 없다. composition 은 종전에
 * 두 축 다 어긋나 있었다 — 진입점이 속성 그리드의 별도 아이콘 칸, 대상이
 * Styles/Properties 와 자리를 다투는 도킹 패널이라 "고르다가 없으면 패널 열고 →
 * 올리고 → 스타일 패널로 돌아오는" 왕복이 생겼다.
 *
 * ## 채택하지 않은 것 — "전체 / 내 폰트" 필터
 *
 * Pen 의 필터는 빌트인 폰트가 많아서 성립한다. 여기 빌트인은 2개(Pretendard,
 * Inter)라 토글이 2개와 N개를 가르는 컨트롤이 된다. 같은 구분은 목록의 그룹
 * 헤더("기본" / "내 폰트")로 컨트롤 없이 읽힌다.
 */

import {
  memo,
  useCallback,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Header } from "react-aria-components/Header";
import { Input } from "react-aria-components/Input";
import {
  ListBox,
  ListBoxItem,
  ListBoxSection,
} from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import type { Key } from "react-aria-components/Collection";
import { ChevronDown, Settings2 } from "lucide-react";
import { ACTION_ICONS } from "../../config/actionIcons";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useControlPopoverMetrics } from "../../components/property/useControlPopoverMetrics";
import { DEFAULT_FONT_OPTIONS } from "../../fonts/customFonts";
import { useFontRegistry } from "./useFontRegistry";
import type { FontManagerDialogProps } from "./FontManagerDialog";
import "./FontFamilyPicker.css";
import { useI18n } from "@/i18n";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

/** inline style 제거를 뜻하는 항목 key — PropertySelect 의 "reset" 규약과 같다. */
const RESET_KEY = "reset";

/**
 * 검색창을 띄우는 최소 패밀리 수. 3~4개짜리 목록 위의 검색창은 훑는 것보다 느리다.
 * 커스텀 폰트가 쌓이면(상한 FONT_LIMITS.MAX_FACES) 넘어간다.
 */
const SEARCH_MIN_FAMILIES = 7;

const BUILTIN_FAMILIES = DEFAULT_FONT_OPTIONS.filter(
  (option) => option.value !== RESET_KEY,
).map((option) => option.value);

interface FontFamilyPickerProps {
  /** 현재 fontFamily. 빈 문자열 = 상속(기본값) */
  value: string;
  onChange: (value: string) => void;
}

export const FontFamilyPicker = memo(function FontFamilyPicker({
  value,
  onChange,
}: FontFamilyPickerProps) {
  const { t } = useI18n();
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [isManagerOpen, setManagerOpen] = useState(false);
  // ADR-242 — 폰트 관리 대화상자는 처음 열 때 chunk 를 받는다 (저빈도 · Styles 패널이 정적으로 끌던
  //   7.7 KB raw). 로드 실패는 대화상자를 닫는 것으로 끝나고 다음 클릭이 다시 시도한다.
  const [ManagerDialog, setManagerDialog] =
    useState<ComponentType<FontManagerDialogProps> | null>(null);
  const [query, setQuery] = useState("");
  const { familyGroups, faceCount } = useFontRegistry();
  // 좌측 정렬은 패널 공통 규약 (PropertySelect 와 같은 소스). 폭은 CSS 233 (색 · 아이콘
  //   팝오버와 같은 폭) — "fit-content" 는 inline width 를 써서 CSS 폭을 이긴다.
  const { anchorRef, controlRef, popoverStyle } = useControlPopoverMetrics({
    widthMode: "min-width",
  });

  const customFamilies = useMemo(
    () => Array.from(familyGroups.keys()),
    [familyGroups],
  );

  const showSearch =
    BUILTIN_FAMILIES.length + customFamilies.length >= SEARCH_MIN_FAMILIES;

  const filter = useCallback(
    (families: string[]) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return families;
      return families.filter((family) => family.toLowerCase().includes(needle));
    },
    [query],
  );

  const visibleBuiltins = useMemo(() => filter(BUILTIN_FAMILIES), [filter]);
  const visibleCustoms = useMemo(
    () => filter(customFamilies),
    [filter, customFamilies],
  );

  const handleOpenChange = useCallback((open: boolean) => {
    setPickerOpen(open);
    if (!open) setQuery("");
  }, []);

  const handleSelectionChange = useCallback(
    (keys: "all" | Set<Key>) => {
      if (keys === "all") return;
      const selected = Array.from(keys)[0];
      if (selected == null) return;
      onChange(selected === RESET_KEY ? "" : String(selected));
      setPickerOpen(false);
      setQuery("");
    },
    [onChange],
  );

  const handleOpenManager = useCallback(() => {
    // 팝오버를 먼저 닫는다 — 오버레이 두 겹이 겹치면 dismiss 대상이 모호해진다.
    setPickerOpen(false);
    setManagerOpen(true);
    if (ManagerDialog) return;
    import("./FontManagerDialog").then(
      (m) => setManagerDialog(() => m.FontManagerDialog),
      (error) => {
        console.warn("[fonts] 폰트 관리 대화상자 로드 실패", error);
        setManagerOpen(false);
      },
    );
  }, [ManagerDialog]);

  const ManageIcon = faceCount === 0 ? AddIcon : Settings2;

  return (
    // 글꼴 이름이 곧 라벨 — legend·아이콘 없이 28 상자 (panel-ui 03, 2026-09-14). 접근 이름은 유지.
    <fieldset className="properties-aria font-family" aria-label="Font Family">
      <div className="react-aria-control react-aria-Group" ref={anchorRef}>
        <DialogTrigger isOpen={isPickerOpen} onOpenChange={handleOpenChange}>
          <Button
            className="react-aria-Button font-picker-trigger"
            ref={controlRef}
            aria-label="Font Family"
          >
            {/* 이름을 그 폰트로 그린다 — 고르기 전에 생김새가 보이는 것이 피커의 값 */}
            <span
              className="font-picker-value"
              style={value ? { fontFamily: value } : undefined}
            >
              {value || t("fonts.defaultValue")}
            </span>
            <span aria-hidden="true" className="select-chevron">
              <ChevronDown size={iconProps.size} />
            </span>
          </Button>

          <Popover
            className="react-aria-Popover font-picker-popover"
            style={popoverStyle}
          >
            <Dialog className="font-picker-dialog" aria-label="Font Family">
              {showSearch && (
                <div className="font-picker-search">
                  <Input
                    autoFocus
                    className="font-picker-search-input"
                    aria-label={t("fonts.searchLabel")}
                    placeholder={t("fonts.searchPlaceholder")}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
              )}

              <ListBox
                className="react-aria-ListBox font-picker-list"
                aria-label="Font Family"
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[value === "" ? RESET_KEY : value]}
                onSelectionChange={handleSelectionChange}
              >
                <ListBoxSection className="font-picker-section">
                  <Header className="font-picker-section-header">
                    {t("fonts.sectionDefault")}
                  </Header>
                  <ListBoxItem
                    id={RESET_KEY}
                    className="react-aria-ListBoxItem font-picker-item"
                    textValue={t("fonts.defaultValue")}
                  >
                    {t("fonts.defaultValue")}
                  </ListBoxItem>
                  {visibleBuiltins.map((family) => (
                    <ListBoxItem
                      key={family}
                      id={family}
                      className="react-aria-ListBoxItem font-picker-item"
                      textValue={family}
                    >
                      <span style={{ fontFamily: family }}>{family}</span>
                    </ListBoxItem>
                  ))}
                </ListBoxSection>

                {visibleCustoms.length > 0 && (
                  <ListBoxSection className="font-picker-section">
                    <Header className="font-picker-section-header">
                      {t("fonts.sectionMine")}
                    </Header>
                    {visibleCustoms.map((family) => (
                      <ListBoxItem
                        key={family}
                        id={family}
                        className="react-aria-ListBoxItem font-picker-item"
                        textValue={family}
                      >
                        <span style={{ fontFamily: family }}>{family}</span>
                      </ListBoxItem>
                    ))}
                  </ListBoxSection>
                )}
              </ListBox>

              <div className="font-picker-footer">
                <Button
                  className="font-picker-manage"
                  onPress={handleOpenManager}
                >
                  <ManageIcon size={iconProps.size} aria-hidden="true" />
                  {faceCount === 0
                    ? t("fonts.addFonts")
                    : t("fonts.manageFonts")}
                </Button>
              </div>
            </Dialog>
          </Popover>
        </DialogTrigger>
      </div>

      {ManagerDialog && (
        <ManagerDialog isOpen={isManagerOpen} onOpenChange={setManagerOpen} />
      )}
    </fieldset>
  );
});
