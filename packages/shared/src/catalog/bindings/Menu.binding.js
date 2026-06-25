/**
 * ADR-142 family ④(collections) — Menu primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`Menu.tsx`/MenuButton)가 useCollectionData(dataBinding → items)로 채우고
 * RAC Menu + MenuItem 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4).
 */
export const menuBinding = {
    source: {
        kind: "internal",
        renderer: "menu",
    },
    props: {
        accepts: {
            dataBinding: { kind: "binding", label: "Data", section: "content" },
            // ADR-912 영역 B Task 3: 정적 items[] SSOT(RuntimeMenuItem[]).
            //   toRacProps 가 props.items pass-through 를 보장(미선언 시 static children placeholder).
            //   kind:"items-manager" 는 비-DATA_ATTR_KIND → out[key]=value 통과 유지 +
            //   Inspector 정적 menu item 추가/제거 UI(ItemsManager) 렌더(RSP Dynamic collections).
            items: {
                kind: "items-manager",
                label: "Menu Items",
                section: "content",
                itemsManager: {
                    itemsKey: "items",
                    itemTypeName: "MenuItem",
                    defaultItem: { id: "", label: "New Item" },
                    itemSchema: [
                        { key: "label", type: "string", label: "Label" },
                        { key: "value", type: "string", label: "Value" },
                        { key: "href", type: "string", label: "URL" },
                        { key: "isDisabled", type: "boolean", label: "Disabled" },
                        { key: "icon", type: "icon", label: "Icon" },
                        { key: "shortcut", type: "string", label: "Shortcut" },
                        { key: "description", type: "string", label: "Description" },
                        { key: "onActionId", type: "event-id", label: "On Action" },
                    ],
                    labelKey: "label",
                    allowSections: true,
                },
            },
            label: { kind: "string", label: "Trigger Label", section: "content" },
            variant: {
                kind: "variant",
                label: "Variant",
                section: "appearance",
                default: "default",
            },
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
            selectionMode: {
                kind: "enum",
                label: "Selection Mode",
                section: "state",
                default: "none",
                options: [
                    { value: "none", label: "None" },
                    { value: "single", label: "Single" },
                    { value: "multiple", label: "Multiple" },
                ],
            },
            isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=Menu.binding.js.map