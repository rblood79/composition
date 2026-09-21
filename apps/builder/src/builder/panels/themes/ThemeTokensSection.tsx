/**
 * ThemeTokensSection — 활성 테마의 토큰 재정의 (ADR-227 Phase 4).
 *
 * 현재 델타 (`theme.tokens`) 를 `.list-row` 로 나열 (키 · 값 meta · 재설정 20) 하고, 아래 "재정의 추가" 격자
 * (분류 | 키 | 값 + 추가 28) 로 새 키를 넣는다. 값 검증은 `themeTokenEditor.parseThemeTokenInput` (seed 와
 * 같으면 델타 삭제 · 무효는 안내). 쓰기는 `themeActions.setThemeToken` (문서 우선 · history 1 · 런타임 1회).
 */

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Minus } from "lucide-react";
import { ACTION_ICONS } from "../../config/actionIcons";
import type {
  ThemesCollection,
  TokensSnapshotEntry,
} from "@composition/shared";
import { getActiveTheme } from "@composition/shared";
import { useI18n } from "../../../i18n";
import { iconProps } from "../../../utils/ui/uiConstants";
import {
  ActionIconButton,
  PropertyInput,
  PropertySection,
  PropertySelect,
} from "../../components";
import { setThemeToken } from "./themeActions";
import { useThemesCollection } from "./ThemeListSection";
import {
  THEME_TOKEN_CATEGORIES,
  formatThemeTokenValue,
  joinThemeTokenKey,
  parseThemeTokenInput,
  splitThemeTokenKey,
  themeTokenKeys,
  themeTokenSeedValue,
  type ThemeTokenCategory,
} from "./themeTokenEditor";

const CATEGORY_LABEL_KEY: Record<ThemeTokenCategory, string> = {
  color: "themes.catColor",
  typography: "themes.catTypography",
  radius: "themes.catRadius",
  border: "themes.catBorder",
  shadow: "themes.catShadow",
  focus: "themes.catFocus",
};

interface OverrideRowProps {
  themeId: string;
  tokenKey: string;
  entry: TokensSnapshotEntry;
}

const OverrideRow = memo(function OverrideRow({
  themeId,
  tokenKey,
  entry,
}: OverrideRowProps) {
  const { t } = useI18n();
  const reset = useCallback(
    () => setThemeToken(themeId, tokenKey, null),
    [themeId, tokenKey],
  );
  const parts = splitThemeTokenKey(tokenKey);
  const edit = useCallback(
    (raw: string) => {
      if (!parts) return;
      const result = parseThemeTokenInput(parts.category, parts.key, raw);
      if ("entry" in result) setThemeToken(themeId, tokenKey, result.entry);
    },
    [parts, themeId, tokenKey],
  );
  return (
    <div className="theme-token-row" data-token-key={tokenKey}>
      <div className="list-row">
        <div className="list-row__body">
          <span className="list-row__label theme-token-key">{tokenKey}</span>
          <input
            type="text"
            className="list-row__input theme-token-value"
            defaultValue={formatThemeTokenValue(entry)}
            aria-label={`${t("themes.value")}: ${tokenKey}`}
            onKeyDown={(event) => {
              if (event.key === "Enter") edit(event.currentTarget.value);
            }}
            onBlur={(event) => edit(event.currentTarget.value)}
          />
        </div>
        <div className="list-row__actions">
          <button
            type="button"
            className="list-row__action theme-token-reset"
            onClick={reset}
            aria-label={`${t("themes.reset")}: ${tokenKey}`}
          >
            <Minus size={12} />
          </button>
        </div>
      </div>
    </div>
  );
});

function AddOverrideRow({ themes }: { themes: ThemesCollection }) {
  const { t } = useI18n();
  const [category, setCategory] = useState<ThemeTokenCategory>("color");
  const keys = useMemo(() => themeTokenKeys(category), [category]);
  const [key, setKey] = useState<string>(keys[0] ?? "");
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  // 분류가 바뀌면 키 목록도 바뀐다 — 첫 키로
  useEffect(() => {
    setKey(keys[0] ?? "");
    setInvalid(false);
  }, [keys]);

  const categoryOptions = useMemo(
    () =>
      THEME_TOKEN_CATEGORIES.map((c) => ({
        value: c,
        label: t(CATEGORY_LABEL_KEY[c]),
      })),
    [t],
  );
  const keyOptions = useMemo(
    () => keys.map((k) => ({ value: k, label: k })),
    [keys],
  );
  const seed = themeTokenSeedValue(category, key);

  const add = useCallback(() => {
    const result = parseThemeTokenInput(category, key, value);
    if ("error" in result) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setThemeToken(
      themes.active,
      joinThemeTokenKey(category, key),
      result.entry,
    );
    setValue("");
  }, [category, key, themes.active, value]);

  return (
    <div className="theme-token-add">
      <div className="fieldset-row">
        <PropertySelect
          label={t("themes.category")}
          value={category}
          onChange={(v) => setCategory(v as ThemeTokenCategory)}
          options={categoryOptions}
          translateOptions={false}
        />
        <PropertySelect
          label={t("themes.key")}
          value={key}
          onChange={setKey}
          options={keyOptions}
          translateOptions={false}
          optionValueMode="literal"
        />
      </div>
      <div className="fieldset-row">
        <PropertyInput
          label={t("themes.value")}
          value={value}
          onChange={setValue}
          placeholder={seed === undefined ? undefined : String(seed)}
          className="theme-token-add-value"
        />
        <div className="fieldset-actions">
          <ActionIconButton
            onPress={add}
            aria-label={t("themes.addOverride")}
            className="theme-token-add-button"
          >
            <ACTION_ICONS.add
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ActionIconButton>
        </div>
      </div>
      {invalid && (
        <p className="theme-token-invalid" role="alert">
          {t("themes.invalidValue")}
        </p>
      )}
    </div>
  );
}

export function ThemeTokensSection() {
  const { t } = useI18n();
  const themes = useThemesCollection();
  const active = themes ? getActiveTheme({ themes }) : null;
  if (!themes || !active) return null;
  const entries = Object.entries(active.tokens ?? {});
  return (
    <PropertySection title={t("themes.tokens")} id="theme-tokens">
      <div className="theme-token-list">
        {entries.length === 0 ? (
          <p className="theme-token-empty">{t("themes.tokensEmpty")}</p>
        ) : (
          entries.map(([tokenKey, entry]) => (
            <OverrideRow
              key={`${active.id}:${tokenKey}:${String(entry.value)}`}
              themeId={active.id}
              tokenKey={tokenKey}
              entry={entry}
            />
          ))
        )}
      </div>
      <AddOverrideRow themes={themes} />
    </PropertySection>
  );
}
