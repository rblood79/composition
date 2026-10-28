import { useI18n } from "@/i18n";
import {
  catalogPageColumnsChange,
  catalogPageColumnsFieldValue,
} from "../../catalogRuntime/pageLayoutSettings";
import { Section as PropertySection } from "../../components/panel/Section";
import { PropertySizeToggle } from "../../components/property/PropertySizeToggle";
import { PropertySwitch } from "../../components/property/PropertySwitch";
import { PropertyUnitInput } from "../../components/property/PropertyUnitInput";
import { ACTION_ICONS } from "../../config/actionIcons";
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

  const pageLayoutOptions = [
    { id: "auto", label: t("settings.pageLayoutAuto") },
    { id: "horizontal", label: t("settings.pageLayoutHorizontal") },
    { id: "vertical", label: t("settings.pageLayoutVertical") },
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
      {/* Page Gap | Column Count 한 줄 (2026-10-28 사용자 지적 — 종전엔 열 수 줄에 tier 스위치가
          같이 있어 두 줄로 갈렸다). 열 수는 Auto 방향에서만. */}
      <div className="fieldset-row settings-row">
        {/* 「80 PX」 — 아이콘 prefix · S/M/L preset ▾ 대신 단위 suffix + stepper (panel-ui 20 — 대조 B11) */}
        <PropertyUnitInput
          label={t("settings.pageGap")}
          value={`${layoutView.gap}px`}
          min={0}
          max={2000}
          onChange={handlePageGapChange}
          units={["px"]}
          unitSuffix
          allowKeywords={false}
        />
        {/* ADR-232 — 컨테이너 폭은 뷰포트가 아니라 **열 수** 다 (대안 D 기각). */}
        {layoutView.direction === "auto" && (
          <PropertyUnitInput
            label={t("settings.pageColumns")}
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
        )}
      </div>
      {layoutView.direction === "auto" && layoutView.tierOverrideAvailable && (
        <div className="fieldset-row settings-row">
          <PropertySwitch
            label={t("settings.pageLayoutTierOverride")}
            isSelected={layoutView.hasTierOverride}
            onChange={(selected: boolean) =>
              catalogLayout.change({
                kind: "tierOverride",
                enabled: selected,
              })
            }
            icon={ACTION_ICONS.toggleRulers}
          />
        </div>
      )}
      <PropertySizeToggle
        label={t("settings.pageLayoutDirection")}
        value={layoutView.direction}
        onChange={handlePageLayoutChange}
        options={pageLayoutOptions}
        className="settings-page-layout-toggle"
      />
    </PropertySection>
  );
}
