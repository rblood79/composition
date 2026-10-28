import { Network, ScanSearch } from "lucide-react";
import { memo, useCallback, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n";
import { updatePage } from "../../../../../../../packages/shared/src/catalog/commands";
import type {
  CatalogPageMeta,
  CatalogSiteSettings,
  EntryId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertySwitch } from "../../../components/property/PropertySwitch";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";
import { SiteAssetField } from "../../site/SiteAssetField";

/**
 * ADR-286 Decision 6 — a page's own settings over the site's (`PageEntry.meta`): title ·
 * description · social image (empty = the site's — shown as the placeholder) and hidden from search
 * or the sitemap. Each edit is one step; a page left with no setting has no `meta`.
 */
export const CatalogPageMetaSection = memo(function CatalogPageMetaSection({
  pageId,
}: {
  pageId: EntryId<"page">;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const runtime = workspace.runtime;
  const subscribeMeta = useCallback(
    (notify: () => void) => runtime.subscribeEntryField(pageId, "meta", notify),
    [pageId, runtime],
  );
  const meta = useSyncExternalStore(
    subscribeMeta,
    () =>
      runtime.selectEntryField(pageId, "meta") as CatalogPageMeta | undefined,
  );
  const subscribeSite = useCallback(
    (notify: () => void) =>
      runtime.subscribeEntryField(runtime.graph.projectId, "site", notify),
    [runtime],
  );
  const site = useSyncExternalStore(
    subscribeSite,
    () =>
      runtime.selectEntryField(runtime.graph.projectId, "site") as
        CatalogSiteSettings | undefined,
  );
  const write = useCallback(
    (patch: Partial<CatalogPageMeta>) => {
      const next: Record<string, unknown> = { ...meta, ...patch };
      for (const key of Object.keys(next))
        if (next[key] === undefined) delete next[key];
      const hidden = next.hidden as CatalogPageMeta["hidden"];
      if (hidden && !hidden.search && !hidden.sitemap) delete next.hidden;
      run(
        updatePage({
          id: pageId,
          fields: {
            meta: Object.keys(next).length
              ? (next as CatalogPageMeta)
              : undefined,
          },
          label: "Page settings",
        }),
      );
    },
    [meta, pageId, run],
  );
  const text = (key: "title" | "description", value: string) => {
    const next = value.trim() || undefined;
    if (next !== meta?.[key]) write({ [key]: next });
  };
  const hide = (key: "search" | "sitemap", value: boolean) => {
    const hidden = { ...meta?.hidden, [key]: value };
    if (!value) delete hidden[key];
    write({ hidden });
  };

  return (
    <PropertySection title={t("settings.pageMeta")}>
      <PropertyInput
        label={t("settings.pageMetaTitle")}
        value={meta?.title ?? ""}
        placeholder={site?.title ?? t("settings.pageMetaSiteDefault")}
        onChange={(value) => text("title", value)}
      />
      <PropertyInput
        label={t("settings.pageMetaDescription")}
        value={meta?.description ?? ""}
        placeholder={site?.description ?? t("settings.pageMetaSiteDefault")}
        multiline
        onChange={(value) => text("description", value)}
      />
      <SiteAssetField
        label={t("settings.pageMetaSocialImage")}
        value={meta?.socialImage}
        onChange={(socialImage) => write({ socialImage })}
      />
      <PropertySwitch
        label={t("settings.pageMetaHideSearch")}
        icon={ScanSearch}
        isSelected={meta?.hidden?.search === true}
        onChange={(value) => hide("search", value)}
      />
      <PropertySwitch
        label={t("settings.pageMetaHideSitemap")}
        icon={Network}
        isSelected={meta?.hidden?.sitemap === true}
        onChange={(value) => hide("sitemap", value)}
      />
    </PropertySection>
  );
});
