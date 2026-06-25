/**
 * ADR-142 family ④(collections) — ComboBox primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`ComboBox.tsx`)가 useResolvedCollectionItems(dataBinding|items → rows)로 채우고
 * RAC ComboBox + Label/Input/Button/Popover/ListBox 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4).
 */
export const comboBoxBinding = {
    source: {
        kind: "internal",
        renderer: "combobox",
    },
    props: {
        accepts: {
            dataBinding: { kind: "binding", label: "Data", section: "content" },
            // ADR-912 영역 B Task 7: 정적 items[](StoredComboBoxItem[]).
            //   toRacProps 가 props.items pass-through 를 보장(미선언 시 정적 옵션 소실).
            //   kind:"items-manager" 는 비-DATA_ATTR_KIND → out[key]=value 통과 유지 +
            //   Inspector 정적 옵션 추가/제거 UI(ItemsManager) 렌더(RSP Dynamic collections).
            items: {
                kind: "items-manager",
                label: "Options",
                section: "content",
                itemsManager: {
                    itemsKey: "items",
                    itemTypeName: "Option",
                    defaultItem: { id: "", label: "Option", value: "" },
                    itemSchema: [
                        { key: "label", type: "string", label: "Label" },
                        { key: "value", type: "string", label: "Value" },
                        { key: "textValue", type: "string", label: "Text Value" },
                        { key: "description", type: "string", label: "Description" },
                        { key: "icon", type: "icon", label: "Icon" },
                        { key: "isDisabled", type: "boolean", label: "Disabled" },
                        { key: "onActionId", type: "event-id", label: "On Action" },
                    ],
                    labelKey: "label",
                },
            },
            label: { kind: "string", label: "Label", section: "content" },
            description: {
                kind: "string",
                label: "Description",
                section: "content",
            },
            placeholder: {
                kind: "string",
                label: "Placeholder",
                section: "content",
            },
            iconName: { kind: "icon", label: "Icon", section: "content" },
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
            isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=ComboBox.binding.js.map