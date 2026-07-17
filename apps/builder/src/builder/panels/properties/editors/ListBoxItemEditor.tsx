import { memo, useMemo } from "react";
import {
  Tag,
  Binary,
  PointerOff,
  FileText,
  Link as LinkIcon,
} from "lucide-react";
import { resolveSlotComposition } from "@composition/shared";
import {
  PropertyInput,
  PropertySwitch,
  PropertyCustomId,
  PropertySection,
  PropertyIconPicker,
} from "../../../components";
import { PropertyEditorProps } from "../types/editorTypes";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";
import {
  useCanonicalPropertyChildren,
  useCanonicalPropertyElement,
} from "../hooks/useCanonicalPropertyRead";
import { useStore } from "../../../stores";
import {
  createListBoxItemSlotChildElement,
  type ListBoxItemSlotRole,
} from "../listBoxItemSlotChildActions";

/**
 * ListBoxItemEditor — ADR-147/148 slot composition model.
 *
 * React Aria `ListBoxItem` 의 `<Text slot="label">`/`<Text slot="description">` + decorative
 * icon + selection indicator 에 대응하는 slot 편집기. 레거시 `Field` 자식 / "Convert to Dynamic
 * Item" 동적 모델은 제거됐다(ADR-132 dataBinding row projection 이 동적 데이터를 대체 — 데이터 소스는
 * ListBox 레벨 dataBinding/columnMapping 으로 편집). 기존 프로젝트의 Field 자식은 렌더 경로에서
 * 보존되며 hydration migration 대상이다.
 *
 * **ADR-148 Phase 0 (slot 자식 배선 — 양방향 동기)**: label/description/icon 입력은 flat props
 * (데이터/템플릿 바인딩 경로)를 기록하고, slot 의 **구성(존재)·스타일 SSOT 는 조합 자식**이다
 * (Decision 3). slot 조합 문서(slot 자식 ≥1)에서 해당 slot 자식이 제거된 상태로 내용을 설정하면
 * 렌더가 gating 되어 시각 무반응(dead edit)이 되므로, 내용 설정 시 slot 자식을 origin seed 규약
 * (`props.slot` + 템플릿 바인딩 `{키}`)으로 자동 재생성해 정합을 유지한다. slot 자식이 0개인
 * legacy 문서는 flat 모델 그대로 두고 구조를 자동 변경하지 않는다(BC).
 */
export const ListBoxItemEditor = memo(function ListBoxItemEditor({
  elementId,
  currentProps,
  onUpdate,
}: PropertyEditorProps) {
  const element = useCanonicalPropertyElement(elementId);
  const children = useCanonicalPropertyChildren(elementId);
  const addElement = useStore((state) => state.addElement);
  const currentPageId = useStore((state) => state.currentPageId);
  const customId = element?.customId || "";

  // slot 구성 — 자식의 metadata.slotRole(canonical) 또는 props.slot(fallback) 판독.
  const slotComposition = useMemo(
    () => resolveSlotComposition(children),
    [children],
  );

  const updateProp = (key: string, value: unknown) => {
    onUpdate({ [key]: value });
  };

  /**
   * slot 조합 문서에서 내용 설정 시 제거된 slot 자식 재생성 (구성 ↔ 데이터 정합).
   * origin seed(listBoxTemplateOrigins.listBoxItemSlotChildren) 와 동일 규약 —
   * 기본 props 주입 없이 `props.slot` + 템플릿 바인딩만 (style 노이즈 방지).
   */
  const ensureSlotChild = (role: ListBoxItemSlotRole) => {
    if (!slotComposition || slotComposition.slots[role] != null) return;
    const pageId = element?.page_id ?? currentPageId;
    if (!pageId) return;

    addElement(
      createListBoxItemSlotChildElement({ role, parentId: elementId, pageId }),
    );
  };

  const labelValue = String(currentProps.label ?? currentProps.children ?? "");
  const iconValue =
    typeof currentProps.icon === "string" ? currentProps.icon : "";

  return (
    <>
      {/* Content slots (ADR-147) */}
      <PropertySection title="Content">
        <PropertyCustomId
          label="ID"
          value={customId}
          elementId={elementId}
          placeholder="listboxitem_1"
        />

        <PropertyInput
          label={PROPERTY_LABELS.LABEL}
          value={labelValue}
          onChange={(value) => {
            if (value) ensureSlotChild("label");
            updateProp("label", value || undefined);
          }}
          icon={Tag}
        />

        <PropertyInput
          label={PROPERTY_LABELS.DESCRIPTION}
          value={String(currentProps.description ?? "")}
          onChange={(value) => {
            if (value) ensureSlotChild("description");
            updateProp("description", value || undefined);
          }}
          icon={FileText}
        />

        <PropertyIconPicker
          label={PROPERTY_LABELS.ICON}
          value={iconValue}
          onChange={(value) => {
            if (value) ensureSlotChild("icon");
            updateProp("icon", value || undefined);
          }}
        />
      </PropertySection>

      {/* Data / selection identity */}
      <PropertySection title="Data">
        <PropertyInput
          label={PROPERTY_LABELS.VALUE}
          value={String(currentProps.value ?? "")}
          onChange={(value) => updateProp("value", value || undefined)}
          icon={Binary}
        />

        <PropertyInput
          label={PROPERTY_LABELS.TEXT_VALUE}
          value={String(currentProps.textValue ?? "")}
          onChange={(value) => updateProp("textValue", value || undefined)}
          icon={Binary}
        />

        <PropertyInput
          label={PROPERTY_LABELS.HREF}
          value={String(currentProps.href ?? "")}
          onChange={(value) => updateProp("href", value || undefined)}
          icon={LinkIcon}
        />
      </PropertySection>

      {/* State */}
      <PropertySection title="State">
        <PropertySwitch
          label={PROPERTY_LABELS.DISABLED}
          isSelected={Boolean(currentProps.isDisabled)}
          onChange={(checked) => updateProp("isDisabled", checked)}
          icon={PointerOff}
        />
      </PropertySection>
    </>
  );
});

export default ListBoxItemEditor;
