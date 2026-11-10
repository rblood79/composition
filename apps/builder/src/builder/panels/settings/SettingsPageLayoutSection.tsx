import {
  Columns2,
  GapHorizontal,
  LayoutArrowDown,
  LayoutArrowRight,
  LayoutGrid,
  PictureInPicture2,
} from "lucide-react";
import { useI18n } from "@/i18n";
import {
  catalogPageColumnsChange,
  catalogPageColumnsFieldValue,
} from "../../catalogRuntime/pageLayoutSettings";
import { Section as PropertySection } from "../../components/panel/Section";
import { PropertySizeToggle } from "../../components/property/PropertySizeToggle";
import { PropertySwitch } from "../../components/property/PropertySwitch";
import { PropertyUnitInput } from "../../components/property/PropertyUnitInput";
import { iconProps } from "../../../utils/ui/uiConstants";
import {
  normalizePageLayoutDirection,
  type PageLayoutDirection,
} from "../../stores/canvasSettings";
import { useCatalogPageLayout } from "./useCatalogPageLayout";

/**
 * The open project's page grid (`pageLayout` — how its pages sit on the Canvas) at the session's
 * breakpoint, each edit one history step. Stored in the document, but it arranges the Builder's
 * Canvas, not the site — so it is a Builder setting (user decision 2026-10-28, after a short stay
 * in the Site panel). `null` outside an open catalog project.
 */
export function SettingsPageLayoutSection() {
  const { t } = useI18n();
  const catalogLayout = useCatalogPageLayout();
  if (!catalogLayout) return null;
  const layoutView = catalogLayout.view;
  // ADR-274: Auto = 기준 배율 (`40%`), Fixed = 개수 (`3`) — 같은 칸의 단위가 모드다.
  const columnsFieldValue = catalogPageColumnsFieldValue(layoutView);

  // 가로 · 세로는 아이콘 (Layout 절의 방향 아이콘과 같음) — 176 칸에서 「Horizontal」 이 잘린다
  //   (2026-10-28 사용자 결정). 글자는 접근 이름으로 남는다.
  const pageLayoutOptions = [
    {
      id: "auto",
      label: t("settings.pageLayoutAuto"),
      // Auto 도 아이콘 (사용자 지정 2026-11-11) — 세 칸 모두 그림, 글자는 접근 이름
      icon: (
        <LayoutGrid
          color={iconProps.color}
          size={iconProps.size}
          strokeWidth={iconProps.strokeWidth}
        />
      ),
    },
    {
      id: "horizontal",
      label: t("settings.pageLayoutHorizontal"),
      icon: (
        <LayoutArrowRight
          color={iconProps.color}
          size={iconProps.size}
          strokeWidth={iconProps.strokeWidth}
        />
      ),
    },
    {
      id: "vertical",
      label: t("settings.pageLayoutVertical"),
      icon: (
        <LayoutArrowDown
          color={iconProps.color}
          size={iconProps.size}
          strokeWidth={iconProps.strokeWidth}
        />
      ),
    },
  ];

  const handlePageLayoutChange = (value: string) => {
    catalogLayout.change({
      kind: "direction",
      direction: normalizePageLayoutDirection(value as PageLayoutDirection) as
        "auto" | "vertical" | "horizontal",
    });
  };

  const handlePageGapChange = (value: string) => {
    const nextGap = Number.parseFloat(value);
    if (!Number.isFinite(nextGap) || nextGap < 0) return;
    catalogLayout.change({ kind: "gap", gap: nextGap });
  };

  const handlePageColumnsChange = (value: string) => {
    const change = catalogPageColumnsChange(layoutView, value);
    if (change) catalogLayout.change(change);
  };

  return (
    <PropertySection id="settings-page-layout" title={t("settings.pageLayout")}>
      {/* 순서 (사용자 지정 2026-11-11): Direction | Page gap · Column count | This breakpoint.
          열 수 · tier 스위치는 Auto 방향에서만 (tier 스위치는 쓸 수 있을 때만). */}
      <div className="fieldset-row settings-row">
        <PropertySizeToggle
          label={t("settings.pageLayoutDirection")}
          value={layoutView.direction}
          onChange={handlePageLayoutChange}
          options={pageLayoutOptions}
          className="settings-page-layout-toggle"
        />
        {/* 「80 PX」 — S/M/L preset ▾ 대신 단위 suffix (panel-ui 20 — 대조 B11). 칸 안 앞 표시는
            숫자 칸 공통 (Figma 방식, 사용자 결정 2026-11-10) */}
        <PropertyUnitInput
          label={t("settings.pageGap")}
          icon={GapHorizontal}
          value={`${layoutView.gap}px`}
          min={0}
          max={2000}
          onChange={handlePageGapChange}
          units={["px"]}
          unitSuffix
          allowKeywords={false}
        />
      </div>
      {layoutView.direction === "auto" && (
        <div className="fieldset-row settings-row">
          {/* ADR-232 — 컨테이너 폭은 뷰포트가 아니라 **열 수** 다 (대안 D 기각). */}
          <PropertyUnitInput
            label={t("settings.pageColumns")}
            icon={Columns2}
            value={columnsFieldValue}
            // 개수 1 ~ 24 · 배율 10 ~ 100 % (사용자 결정 2) — 한 칸이라 넓은 쪽으로 받고
            //   단위별 범위는 명령이 맞춘다 (`catalogPageColumnsChange`).
            min={1}
            max={100}
            onChange={handlePageColumnsChange}
            // `%` = Auto (이 배율로 줌아웃하면 모니터 한 폭에 들어가는 만큼 — ADR-274), 단위
            //   없음 = Fixed 개수. `auto` 를 쳐도 Auto 다.
            units={["", "%"]}
            unitSuffix
            allowKeywords
          />
          {layoutView.tierOverrideAvailable && (
            <PropertySwitch
              label={t("settings.pageLayoutTierOverride")}
              icon={PictureInPicture2}
              isSelected={layoutView.hasTierOverride}
              onChange={(selected: boolean) =>
                catalogLayout.change({
                  kind: "tierOverride",
                  enabled: selected,
                })
              }
            />
          )}
        </div>
      )}
    </PropertySection>
  );
}
