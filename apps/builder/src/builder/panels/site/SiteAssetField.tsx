import { memo, useCallback, useRef } from "react";
import { Button as RACButton } from "react-aria-components/Button";
import { useI18n } from "@/i18n";
import type { CatalogAssetUrl } from "../../../../../../packages/shared/src/catalog/document/types";
import { useResolvedAssetUrl } from "../../../lib/assets/useResolvedAssetUrl";
import { assetStorageEnabled } from "../../config/assetStorage";
import { ACTION_ICONS } from "../../config/actionIcons";
import { iconEditProps } from "../../../utils/ui/uiConstants";
import { useToastStore } from "../../stores/toast";
import "./SiteAssetField.css";

const DeleteIcon = ACTION_ICONS.delete;

/**
 * ADR-286 — an image the site or a page names (favicon · social image): the uploaded bytes go to
 * the asset store (ADR-235 writer) and the document holds the `asset:` reference only. There is no
 * dataURL fallback — the document's site fields take asset references.
 */
export const SiteAssetField = memo(function SiteAssetField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: CatalogAssetUrl | undefined;
  onChange: (value: CatalogAssetUrl | undefined) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const preview = useResolvedAssetUrl(value);
  const choose = useCallback(
    (file: File | undefined) => {
      if (!file || !file.type.startsWith("image/")) return;
      const fail = (error: unknown) => {
        console.warn("[assets] 사이트 이미지 저장 실패", error);
        useToastStore
          .getState()
          .showToast("error", t("settings.siteImageFailed"), {
            messageKey: "settings.siteImageFailed",
          });
      };
      if (!assetStorageEnabled()) return fail("asset writer off");
      void import("../../../lib/assets/assetWriter")
        .then(({ storeUploadedFile }) => storeUploadedFile(file))
        .then((stored) => onChange(stored.ref as CatalogAssetUrl), fail);
    },
    [onChange, t],
  );
  return (
    <fieldset
      className={`properties-aria site-asset-field ${className ?? ""}`.trim()}
    >
      <legend className="fieldset-legend">{label}</legend>
      <div className="react-aria-Group site-asset-row">
        <span className="site-asset-thumb" aria-hidden="true">
          {preview ? <img src={preview} alt="" /> : null}
        </span>
        <RACButton
          className="control-button site-asset-choose"
          onPress={() => input.current?.click()}
        >
          <span>
            {value
              ? t("settings.siteImageReplace")
              : t("settings.siteImageChoose")}
          </span>
        </RACButton>
        {value && (
          <RACButton
            className="control-button site-asset-remove"
            aria-label={t("settings.siteImageRemove")}
            onPress={() => onChange(undefined)}
          >
            <DeleteIcon aria-hidden="true" size={iconEditProps.size} />
          </RACButton>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
    </fieldset>
  );
});
