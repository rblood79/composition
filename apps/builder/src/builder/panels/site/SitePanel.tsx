import { memo, useCallback, useState } from "react";
import { Button as RACButton } from "react-aria-components/Button";
import { ArrowDown, ArrowUp, Globe, Lock, LockOpen } from "lucide-react";
import { useI18n } from "@/i18n";
import type {
  CatalogSiteAccess,
  CatalogSiteRedirect,
  CatalogSiteSettings,
  EntryId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { useCatalogPages } from "../../catalogRuntime/react";
import { PanelContents } from "../../components/panel/PanelContents";
import { PanelHeader } from "../../components/panel/PanelHeader";
import { Section as PropertySection } from "../../components/panel/Section";
import { PropertyInput } from "../../components/property/PropertyInput";
import { PropertyRowMenu } from "../../components/property/PropertyRowMenu";
import { PropertySelect } from "../../components/property/PropertySelect";
import { PropertySwitch } from "../../components/property/PropertySwitch";
import { ACTION_ICONS } from "../../config/actionIcons";
import { SiteAssetField } from "./SiteAssetField";
import { iconProps } from "../../../utils/ui/uiConstants";
import {
  useCatalogSiteSettings,
  type SiteSettingsPatch,
} from "./useCatalogSiteSettings";
import "./SitePanel.css";

const AddIcon = ACTION_ICONS.add;
/** Common BCP 47 tags (`<html lang>`); a value set elsewhere stays listed. */
const LANGS = ["ko", "en", "ja", "zh-CN", "zh-TW", "es", "fr", "de", "pt-BR"];
const SEARCH_DEFAULT = { index: true, sitemap: true, robots: "allow" } as const;

/** `/old` — a redirect's source is a path (the document refuses one without the leading `/`). */
const asPath = (value: string) => {
  const trimmed = value.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

/**
 * ADR-286 Decision 5 · user decision 4 — the 「Site」 panel, apart from the Builder's Settings
 * (user 2026-10-28): the open project's site settings (`ProjectEntry.site`), each edit one history
 * step. Access protection names who may open the site; its secrets (password · client secret ·
 * certificate) are kept by the publish host (user decision 2) — no secret field here. Publish does
 * not read these yet (R5 — the notice).
 */
export function SitePanel() {
  const { t } = useI18n();
  const settings = useCatalogSiteSettings();
  return (
    <div className="panel">
      <PanelHeader
        icon={<Globe size={iconProps.size} />}
        title={t("panels.site")}
        panelId="site"
      />
      <PanelContents>
        {settings && (
          <SiteSettingsForm site={settings.site} change={settings.change} />
        )}
      </PanelContents>
    </div>
  );
}

const SiteSettingsForm = memo(function SiteSettingsForm({
  site,
  change,
}: {
  site: CatalogSiteSettings;
  change: (patch: SiteSettingsPatch) => boolean;
}) {
  const { t } = useI18n();
  const pages = useCatalogPages();
  const text = useCallback(
    (key: "title" | "description", value: string) => {
      const next = value.trim() || undefined;
      if (next !== site[key]) change({ [key]: next });
    },
    [change, site],
  );
  const search = site.search ?? SEARCH_DEFAULT;
  const redirects = site.redirects ?? [];
  const writeRedirects = (next: readonly CatalogSiteRedirect[]) =>
    change({ redirects: next.length ? next : undefined });
  const stored: CatalogSiteAccess = site.access ?? { kind: "none" };
  // SSO needs an issuer: choosing it shows the fields, and the first issuer writes the setting.
  const [ssoDraft, setSsoDraft] = useState(false);
  const access: CatalogSiteAccess =
    ssoDraft && stored.kind !== "sso"
      ? { kind: "sso", protocol: "oidc", issuer: "", protectedPageIds: "all" }
      : stored;
  const writeAccess = (next: CatalogSiteAccess) => {
    if (next.kind === "sso" && !next.issuer) return setSsoDraft(true);
    setSsoDraft(false);
    change({ access: next.kind === "none" ? undefined : next });
  };

  const langOptions = [
    { value: "", label: t("settings.siteLangUnset") },
    ...[...new Set([...LANGS, ...(site.lang ? [site.lang] : [])])].map(
      (value) => ({ value, label: value }),
    ),
  ];

  return (
    <>
      <PropertySection title={t("settings.siteGeneral")}>
      <div className="site-settings-notice" role="note">
        {t("settings.sitePublishPending")}
      </div>
      <PropertyInput
        label={t("settings.siteTitle")}
        value={site.title ?? ""}
        placeholder={t("settings.siteTitlePlaceholder")}
        onChange={(value) => text("title", value)}
      />
      <PropertyInput
        label={t("settings.siteDescription")}
        value={site.description ?? ""}
        multiline
        onChange={(value) => text("description", value)}
      />
      <PropertySelect
        label={t("settings.siteLang")}
        value={site.lang ?? ""}
        options={langOptions}
        translateOptions={false}
        optionValueMode="literal"
        onChange={(value) => change({ lang: value || undefined })}
      />
        <SiteAssetField
          label={t("settings.siteFaviconLight")}
          value={site.favicon?.light}
          onChange={(light) => {
            const favicon = { ...site.favicon, light };
            if (!light) delete favicon.light;
            change({
              favicon: favicon.light || favicon.dark ? favicon : undefined,
            });
          }}
        />
        <SiteAssetField
          label={t("settings.siteFaviconDark")}
          value={site.favicon?.dark}
          onChange={(dark) => {
            const favicon = { ...site.favicon, dark };
            if (!dark) delete favicon.dark;
            change({
              favicon: favicon.light || favicon.dark ? favicon : undefined,
            });
          }}
        />
      <SiteAssetField
        label={t("settings.siteSocialImage")}
        value={site.socialImage}
        onChange={(socialImage) => change({ socialImage })}
      />

      </PropertySection>
      <PropertySection title={t("settings.siteSearch")}>
      <div className="fieldset-row site-search-row">
        <PropertySwitch
          label={t("settings.siteSearchIndex")}
          isSelected={search.index}
          onChange={(index) => change({ search: { ...search, index } })}
        />
        <PropertySwitch
          label={t("settings.siteSitemap")}
          isSelected={search.sitemap}
          onChange={(sitemap) => change({ search: { ...search, sitemap } })}
        />
      </div>
      <PropertySelect
        label={t("settings.siteRobots")}
        value={search.robots}
        options={[
          { value: "allow", label: t("settings.siteRobotsAllow") },
          { value: "none", label: t("settings.siteRobotsNone") },
        ]}
        translateOptions={false}
        onChange={(robots) =>
          change({
            search: { ...search, robots: robots as "allow" | "none" },
          })
        }
      />

      </PropertySection>
      <PropertySection title={t("settings.siteRedirects")}>
        {redirects.map((redirect, index) => {
          const update = (patch: Partial<CatalogSiteRedirect>) =>
            writeRedirects(
              redirects.map((item, i) =>
                i === index ? { ...item, ...patch } : item,
              ),
            );
          const move = (to: number) => {
            const next = [...redirects];
            const [item] = next.splice(index, 1);
            next.splice(to, 0, item!);
            writeRedirects(next);
          };
          return (
            <div
              className="fieldset-row site-redirect-row"
              key={`${index}:${redirect.from}`}
              data-permanent={redirect.permanent || undefined}
            >
              <PropertyInput
                label={t("settings.siteRedirectFrom")}
                value={redirect.from}
                placeholder="/old"
                onChange={(value) => {
                  const from = asPath(value);
                  if (from !== redirect.from) update({ from });
                }}
              />
              <PropertyInput
                label={t("settings.siteRedirectTo")}
                value={redirect.to}
                placeholder="/new"
                onChange={(value) => {
                  const to = value.trim();
                  if (to !== redirect.to) update({ to });
                }}
              />
              <div className="fieldset-actions actions-site-redirect">
                <PropertyRowMenu
                  label={t("settings.siteRedirectActions")}
                  items={[
                    {
                      id: "permanent",
                      label: redirect.permanent
                        ? t("settings.siteRedirectMakeTemporary")
                        : t("settings.siteRedirectMakePermanent"),
                    },
                    {
                      id: "up",
                      label: t("settings.siteRedirectMoveUp"),
                      icon: ArrowUp,
                      isDisabled: index === 0,
                    },
                    {
                      id: "down",
                      label: t("settings.siteRedirectMoveDown"),
                      icon: ArrowDown,
                      isDisabled: index === redirects.length - 1,
                    },
                    {
                      id: "remove",
                      label: t("settings.siteRedirectRemove"),
                      icon: ACTION_ICONS.delete,
                    },
                  ]}
                  onAction={(id) => {
                    if (id === "permanent")
                      update({ permanent: !redirect.permanent });
                    else if (id === "up") move(index - 1);
                    else if (id === "down") move(index + 1);
                    else if (id === "remove")
                      writeRedirects(redirects.filter((_, i) => i !== index));
                  }}
                />
              </div>
              <span className="site-redirect-kind">
                {redirect.permanent
                  ? t("settings.siteRedirectPermanent")
                  : t("settings.siteRedirectTemporary")}
              </span>
            </div>
          );
        })}
        <RACButton
          className="control-button"
          data-variant="add"
          onPress={() =>
            writeRedirects([
              ...redirects,
              { from: "/old", to: "/", permanent: true },
            ])
          }
        >
          <AddIcon aria-hidden="true" size={14} />
          {t("settings.siteRedirectAdd")}
        </RACButton>
      </PropertySection>
      <PropertySection title={t("settings.siteAccess")}>

      <PropertySelect
        label={t("settings.siteAccessWho")}
        value={access.kind}
        icon={access.kind === "none" ? LockOpen : Lock}
        options={[
          { value: "none", label: t("settings.siteAccessNone") },
          { value: "password", label: t("settings.siteAccessPassword") },
          { value: "sso", label: t("settings.siteAccessSso") },
        ]}
        translateOptions={false}
        onChange={(kind) => {
          if (kind === access.kind) return;
          if (kind === "password") writeAccess({ kind: "password" });
          else if (kind === "sso")
            writeAccess({
              kind: "sso",
              protocol: "oidc",
              issuer: "",
              protectedPageIds: "all",
            });
          else writeAccess({ kind: "none" });
        }}
      />
      {access.kind !== "none" && (
        <div className="site-settings-notice" role="note">
          {t("settings.siteAccessSecretsNotice")}
        </div>
      )}
      {access.kind === "password" && (
        <PropertyInput
          label={t("settings.siteAccessHint")}
          value={access.hint ?? ""}
          onChange={(value) => {
            const hint = value.trim();
            if (hint !== (access.hint ?? ""))
              writeAccess(hint ? { ...access, hint } : { kind: "password" });
          }}
        />
      )}
      {access.kind === "sso" && (
        <SsoFields
          access={access}
          pages={pages.map((page) => ({ id: page.id, name: page.name }))}
          write={writeAccess}
        />
      )}
      </PropertySection>
    </>
  );
});

type SsoAccess = Extract<CatalogSiteAccess, { kind: "sso" }>;

function SsoFields({
  access,
  pages,
  write,
}: {
  access: SsoAccess;
  pages: readonly { id: EntryId<"page">; name: string }[];
  write: (access: CatalogSiteAccess) => void;
}) {
  const { t } = useI18n();
  const optional = (key: "metadataUrl" | "clientId", value: string) => {
    const next = value.trim();
    if (next === (access[key] ?? "")) return;
    const updated: SsoAccess = { ...access, [key]: next };
    if (!next) delete updated[key];
    write(updated);
  };
  const protectedIds =
    access.protectedPageIds === "all" ? null : access.protectedPageIds;
  return (
    <>
      <PropertySelect
        label={t("settings.siteSsoProtocol")}
        value={access.protocol}
        options={[
          { value: "oidc", label: "OpenID Connect" },
          { value: "saml", label: "SAML 2.0" },
        ]}
        translateOptions={false}
        onChange={(protocol) =>
          protocol !== access.protocol &&
          write({ ...access, protocol: protocol as SsoAccess["protocol"] })
        }
      />
      <PropertyInput
        label={t("settings.siteSsoIssuer")}
        value={access.issuer}
        placeholder="https://idp.example.com"
        onChange={(value) => {
          const issuer = value.trim();
          if (issuer !== access.issuer) write({ ...access, issuer });
        }}
      />
      <PropertyInput
        label={t("settings.siteSsoMetadataUrl")}
        value={access.metadataUrl ?? ""}
        placeholder="https://idp.example.com/.well-known/…"
        onChange={(value) => optional("metadataUrl", value)}
      />
      <PropertyInput
        label={t("settings.siteSsoClientId")}
        value={access.clientId ?? ""}
        onChange={(value) => optional("clientId", value)}
      />
      <PropertySelect
        label={t("settings.siteSsoProtects")}
        value={protectedIds ? "pages" : "all"}
        options={[
          { value: "all", label: t("settings.siteSsoProtectsAll") },
          { value: "pages", label: t("settings.siteSsoProtectsPages") },
        ]}
        translateOptions={false}
        onChange={(value) =>
          write({
            ...access,
            protectedPageIds: value === "all" ? "all" : (protectedIds ?? []),
          })
        }
      />
      {protectedIds && (
        <fieldset className="properties-aria site-sso-pages">
          <legend className="fieldset-legend">
            {t("settings.siteSsoProtectedPages")}
          </legend>
          {pages.map((page) => (
            <PropertySwitch
              key={page.id}
              label={page.name}
              labelMode="inline"
              isSelected={protectedIds.includes(page.id)}
              onChange={(selected) =>
                write({
                  ...access,
                  protectedPageIds: selected
                    ? [...protectedIds, page.id]
                    : protectedIds.filter((id) => id !== page.id),
                })
              }
            />
          ))}
        </fieldset>
      )}
    </>
  );
}
