import { useI18n } from "@/i18n";
import type { CatalogToastPlacement } from "../../../../../../packages/shared/src/catalog/document/types";
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
import { useCatalogToastPlacement } from "./useCatalogToastPlacement";

/**
 * The open project's page grid (`pageLayout` — how its pages sit on the Canvas) at the session's
 * breakpoint, each edit one history step. A document value: it lives in the Site panel, not the
 * Builder's Settings (user decision 2026-10-28 — Settings = this Builder's environment).
 */
export function SitePageLayoutSection() {
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
    <PropertySection id="site-page-layout" title={t("settings.pageLayout")}>
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
      </div>
      {/* ADR-232 — 컨테이너 폭은 뷰포트가 아니라 **열 수** 다 (대안 D 기각). */}
      {layoutView.direction === "auto" && (
        <div className="fieldset-row settings-row">
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
          {layoutView.tierOverrideAvailable && (
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
          )}
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

/**
 * S2 ToastContainer placement — where the open project's app (Preview · Publish) shows its toasts.
 * S2's one value (`top` · `top end` · `bottom` · `bottom end`) is two fields here, as S2's Toast
 * reads it (`placement` + `align`) — four labels do not fit one row of the panel.
 */
export function SiteAppSection() {
  const { t } = useI18n();
  const toastPlacement = useCatalogToastPlacement();
  if (!toastPlacement) return null;
  const toastVertical = toastPlacement.value.startsWith("top")
    ? "top"
    : "bottom";
  const toastAlign = toastPlacement.value.endsWith("end") ? "end" : "center";
  const changeToast = (vertical: string, align: string) =>
    toastPlacement.change(
      (align === "end" ? `${vertical} end` : vertical) as CatalogToastPlacement,
    );
  const toastPlacementOptions = [
    { id: "top", label: t("settings.toastPlacementTop") },
    { id: "bottom", label: t("settings.toastPlacementBottom") },
  ];
  const toastAlignOptions = [
    { id: "center", label: t("settings.toastAlignCenter") },
    { id: "end", label: t("settings.toastAlignEnd") },
  ];

  return (
    <PropertySection id="site-app" title={t("settings.app")}>
      <div className="fieldset-row settings-row">
        <PropertySizeToggle
          label={t("settings.toastPlacement")}
          value={toastVertical}
          onChange={(value: string) => changeToast(value, toastAlign)}
          options={toastPlacementOptions}
          className="settings-toast-placement-toggle"
        />
        <PropertySizeToggle
          label={t("settings.toastAlign")}
          value={toastAlign}
          onChange={(value: string) => changeToast(toastVertical, value)}
          options={toastAlignOptions}
          className="settings-toast-align-toggle"
        />
      </div>
    </PropertySection>
  );
}
