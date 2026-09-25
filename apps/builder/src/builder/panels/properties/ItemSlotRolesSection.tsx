import { memo, useMemo } from "react";
import {
  ITEM_SLOT_ROLE_TABLE,
  type CanonicalNode,
  type SlotRole,
} from "@composition/shared";

import { PropertySection, PropertySwitch } from "../../components";
import { useStore } from "../../stores";
import { historyManager } from "../../stores/history";
import { useActiveCanonicalDocument } from "../../stores/canonical/canonicalElementsBridge";
import {
  getResolvedRefChildren,
  getSyntheticDescendantLookup,
  isSyntheticDescendantId,
} from "../../stores/canonical/syntheticDescendantLookup";
import { getNodeMap } from "../../stores/canonical/canonicalTraversalHelpers";
import { resolveChainEnd } from "../../components/staticCollectionMigration";
import { useCanonicalPropertyElementType } from "./hooks/useCanonicalPropertyRead";
import {
  buildItemRoleSurface,
  planItemRoleChild,
  planItemRoleToggle,
  type ItemRoleSurface,
} from "../../components/itemSlotRoles";
import { withFrameElementMirrorId } from "../../../adapters/canonical/frameMirror";
import { runAfterStructuralOriginImpact } from "../../stores/utils/elementUpdate";
import { ACTION_ICONS } from "../../config/actionIcons";
import { useI18n } from "@/i18n";

const AddIcon = ACTION_ICONS.add;
type AddElementInput = Parameters<
  ReturnType<typeof useStore.getState>["addElement"]
>[0];

const ROLE_LABEL_KEY: Record<SlotRole, string | undefined> = {
  icon: "propertiesPanel.itemRoleIcon",
  avatar: "propertiesPanel.itemRoleAvatar",
  label: "propertiesPanel.itemRoleLabel",
  description: "propertiesPanel.itemRoleDescription",
  shortcut: "propertiesPanel.itemRoleShortcut",
} as Record<SlotRole, string | undefined>;

/**
 * ADR-238 Phase 1 — 선택 항목의 역할 표면 (instance = on/off · origin = 없는 역할 추가). 항목이 아니면 null.
 * synthetic 항목 (`<instance>/<path>`) 은 해석된 노드의 `ref` 로, canonical ref 는 체인 끝으로 origin 을 찾는다.
 */
function readItemRoleSurface(
  elementId: string,
  byId: ReadonlyMap<string, CanonicalNode>,
): { surface: ItemRoleSurface; origin: CanonicalNode } | null {
  if (isSyntheticDescendantId(elementId)) {
    const node = getSyntheticDescendantLookup(elementId)?.node as
      (CanonicalNode & { ref?: string }) | undefined;
    const origin = resolveChainEnd(node?.ref, byId);
    const surface = buildItemRoleSurface(
      origin,
      getResolvedRefChildren(elementId),
      true,
    );
    return surface && origin ? { surface, origin } : null;
  }
  const node = byId.get(elementId);
  if (!node) return null;
  const isInstance = node.type === "ref";
  const origin = isInstance ? resolveChainEnd(node.id, byId) : node;
  // origin 표면은 Components 페이지 항목 origin (reusable) 만 — 문서의 plain 항목은 자기 자식이 정본.
  if (!isInstance && node.reusable !== true) return null;
  const surface = buildItemRoleSurface(
    origin,
    isInstance ? getResolvedRefChildren(elementId) : undefined,
    isInstance,
  );
  return surface && origin ? { surface, origin } : null;
}

export const ItemSlotRolesSection = memo(function ItemSlotRolesSection({
  elementId,
}: {
  elementId: string;
}) {
  const { t } = useI18n();
  const document = useActiveCanonicalDocument();
  // 항목 type (ref 는 origin type) 이 아니면 문서를 읽지 않는다 — 모든 선택에 붙는 절.
  const elementType = useCanonicalPropertyElementType(elementId);
  const isItemType =
    elementType !== null && elementType in ITEM_SLOT_ROLE_TABLE;
  const read = useMemo(
    () =>
      document && isItemType
        ? readItemRoleSurface(elementId, getNodeMap())
        : null,
    [document, elementId, isItemType],
  );
  if (!read) return null;
  const { surface, origin } = read;

  const roleLabel = (role: SlotRole) => {
    const key = ROLE_LABEL_KEY[role];
    return key ? t(key as never) : role;
  };

  const handleToggle = (role: SlotRole, enabled: boolean) => {
    const update = planItemRoleToggle(elementId, surface, role, enabled);
    if (!update) return;
    const state = useStore.getState();
    if (state.selectedElementId !== elementId) return;
    state.updateSelectedPropertiesWithChildren({}, [update] as never);
  };

  const handleAdd = (role: SlotRole) => {
    const plan = planItemRoleChild(origin, role);
    if (!plan) return;
    const state = useStore.getState();
    const pageId =
      (state.elementsMap.get(origin.id) as { page_id?: string } | undefined)
        ?.page_id ?? null;
    // 추가 + 표 순서 위치로 이동 = 되돌리기 1회 (창은 동기 — await 는 창 밖). origin 에 역할을 더하면
    //   모든 instance 가 바뀐다 (ADR-236 E4) — 창을 열기 전에 묻는다.
    runAfterStructuralOriginImpact([origin.id], () => {
      const writes = historyManager.runInTransaction(
        { type: "add", elementId: plan.node.id },
        () => {
          const added = state.addElement(
            withFrameElementMirrorId(
              {
                ...plan.node,
                parent_id: origin.id,
                page_id: pageId,
              } as unknown as AddElementInput,
              null,
            ),
          );
          useStore
            .getState()
            .moveElementToContainer(plan.node.id, origin.id, plan.index);
          return added;
        },
      );
      void writes;
    });
  };

  return (
    <PropertySection title={t("propertiesPanel.itemRolesSection" as never)}>
      {surface.rows.map((row) => {
        const label = roleLabel(row.role);
        if (surface.mode === "origin" && !row.present) {
          return (
            <div className="list-row item-role-row" key={row.role}>
              <div className="list-row__body">
                <span className="list-row__label">{label}</span>
              </div>
              <div className="list-row__actions">
                <button
                  aria-label={`${t("propertiesPanel.itemRoleAdd" as never)} ${label}`}
                  className="list-row__action item-role-add"
                  onClick={() => handleAdd(row.role)}
                  type="button"
                >
                  <AddIcon aria-hidden="true" size={12} />
                </button>
              </div>
            </div>
          );
        }
        if (surface.mode === "origin" || row.required) {
          return (
            <div className="list-row item-role-row" key={row.role}>
              <div className="list-row__body">
                <span className="list-row__label">{label}</span>
              </div>
              {row.required ? (
                <span className="list-row__meta">
                  {t("propertiesPanel.itemRoleRequired" as never)}
                </span>
              ) : null}
            </div>
          );
        }
        return (
          <PropertySwitch
            key={row.role}
            label={label}
            labelMode="inline"
            isSelected={row.enabled}
            onChange={(next) => handleToggle(row.role, next)}
          />
        );
      })}
    </PropertySection>
  );
});
