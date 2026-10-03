/**
 * ThemeListSection — 문서 테마 컬렉션 목록 (ADR-227 Phase 4).
 *
 * 행 = 공용 `.list-row` (StateSection · ItemsManager 와 같은 구조): [본문 28: 활성 표지 20 · 이름 · preset
 * meta] [액션 28: 복제 · 이름 · 삭제 (20×20)]. 이름 편집은 펼친 행의 `.list-row__fields` 안 PropertyInput
 * (전폭). 모든 쓰기는 Themes host (`themesHost` — 구 문서 우선 `themeActions` / catalog command 1개).
 * 마지막 테마의 삭제 버튼은 비활성 (shared `removeTheme` 도 거부한다 — 이중 방어).
 */

import { memo, useCallback, useMemo, useState } from "react";
import { Check, Minus, Pencil } from "lucide-react";
import { ACTION_ICONS } from "../../config/actionIcons";
import type { ThemesCollection } from "@composition/shared";
import { getActiveTheme } from "@composition/shared";
import { useI18n } from "../../../i18n";
import { iconProps } from "../../../utils/ui/uiConstants";
import { ActionIconButton } from "../../components/ui/ActionIconButton";
import { PropertyInput } from "../../components/property/PropertyInput";
import { Section as PropertySection } from "../../components/panel/Section";
import { useThemesHost } from "./themesHost";

function presetMeta(themes: ThemesCollection, id: string): string {
  const p = themes.items[id]?.preset;
  if (!p) return "";
  const overrides = Object.keys(themes.items[id]?.tokens ?? {}).length;
  return `${p.tint} · ${p.radiusScale}${overrides > 0 ? ` · +${overrides}` : ""}`;
}

interface ThemeRowProps {
  themes: ThemesCollection;
  id: string;
  editing: boolean;
  onToggleEdit: (id: string) => void;
}

const ThemeRow = memo(function ThemeRow({
  themes,
  id,
  editing,
  onToggleEdit,
}: ThemeRowProps) {
  const { t } = useI18n();
  const host = useThemesHost();
  const theme = themes.items[id];
  const isActive = themes.active === id;
  const isLast = themes.order.length <= 1;
  const [draft, setDraft] = useState(theme?.name ?? "");

  const activate = useCallback(() => {
    if (!isActive) host.setActiveTheme(id);
  }, [host, id, isActive]);
  const duplicate = useCallback(() => {
    // "추가 = 활성 복제" 규약이라 먼저 활성화한 뒤 복제한다 — 활성 행이면 entry 1, 아니면 2 (활성 + 복제)
    if (!isActive) host.setActiveTheme(id);
    host.addThemeFromActive();
  }, [host, id, isActive]);
  const remove = useCallback(() => {
    if (!isLast) host.removeTheme(id);
  }, [host, id, isLast]);
  const toggleEdit = useCallback(() => {
    setDraft(theme?.name ?? "");
    onToggleEdit(id);
  }, [id, onToggleEdit, theme?.name]);
  const commitName = useCallback(
    (value: string) => {
      setDraft(value);
      const next = value.trim();
      if (next !== "" && next !== theme?.name) host.renameTheme(id, next);
    },
    [host, id, theme?.name],
  );

  if (!theme) return null;
  return (
    <div
      className="theme-row"
      data-theme-id={id}
      data-active={isActive || undefined}
      data-expanded={editing || undefined}
    >
      <div className="list-row">
        <div className="list-row__body">
          <button
            type="button"
            className="list-row__action theme-row-activate"
            onClick={activate}
            aria-label={`${t("themes.activate")}: ${theme.name}`}
            aria-pressed={isActive}
            data-selected={isActive || undefined}
          >
            {isActive ? <Check size={12} strokeWidth={3} /> : null}
          </button>
          <span className="list-row__label theme-row-name">{theme.name}</span>
          <span className="list-row__meta theme-row-meta">
            {presetMeta(themes, id)}
          </span>
        </div>
        <div className="list-row__actions">
          <button
            type="button"
            className="list-row__action theme-row-duplicate"
            onClick={duplicate}
            aria-label={`${t("themes.duplicate")}: ${theme.name}`}
          >
            <ACTION_ICONS.duplicate size={12} />
          </button>
          <button
            type="button"
            className="list-row__action theme-row-rename"
            onClick={toggleEdit}
            aria-expanded={editing}
            aria-label={`${t("themes.rename")}: ${theme.name}`}
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            className="list-row__action theme-row-remove"
            onClick={remove}
            disabled={isLast}
            aria-label={`${t("themes.delete")}: ${theme.name}`}
            title={isLast ? t("themes.deleteLast") : undefined}
          >
            <Minus size={12} />
          </button>
        </div>
      </div>
      {editing && (
        <div className="list-row__fields theme-row-editor">
          <div className="fieldset-row" data-wide="true">
            <PropertyInput
              label={t("themes.name")}
              value={draft}
              onChange={commitName}
            />
          </div>
        </div>
      )}
    </div>
  );
});

export function ThemeListSection() {
  const { t } = useI18n();
  const host = useThemesHost();
  const themes = host.useThemes();
  const [editingId, setEditingId] = useState<string | null>(null);
  const toggleEdit = useCallback(
    (id: string) => setEditingId((cur) => (cur === id ? null : id)),
    [],
  );
  const handleAdd = useCallback(() => {
    host.addThemeFromActive();
  }, [host]);
  const actions = useMemo(
    () => (
      <ActionIconButton onPress={handleAdd} aria-label={t("themes.add")}>
        <ACTION_ICONS.add
          color={iconProps.color}
          size={iconProps.size}
          strokeWidth={iconProps.strokeWidth}
        />
      </ActionIconButton>
    ),
    [handleAdd, t],
  );

  // migration 전 (컬렉션 부재) 이면 목록을 그리지 않는다 — 로드 직후 잠깐의 창
  if (!themes || !getActiveTheme({ themes })) return null;

  return (
    <PropertySection title={t("themes.list")} id="theme-list" actions={actions}>
      <div className="theme-list">
        {themes.order.map((id) => (
          <ThemeRow
            key={id}
            themes={themes}
            id={id}
            editing={editingId === id}
            onToggleEdit={toggleEdit}
          />
        ))}
      </div>
    </PropertySection>
  );
}
