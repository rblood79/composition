import { memo, useCallback } from "react";
import { NotebookTabs, GripHorizontal } from "lucide-react";
import {
  PropertyInput,
  PropertySwitch,
  PropertySection,
} from "../../../components";
import type { ComponentEditorProps } from "../../../inspector/types";
import { PROPERTY_LABELS } from "../../../../utils/ui/labels";
import { useStore } from "../../../stores";
import { useSyncChildProp } from "../../../hooks/useSyncChildProp";
import {
  getFrameElementMirrorId,
  withFrameElementMirrorId,
} from "../../../../adapters/canonical/frameMirror";

/**
 * Slider hybrid afterSections — Range Mode만 수동
 *
 * Range Mode 토글 시 Thumb 동적 생성/삭제 + 배열 value 조작이 필요하므로
 * Spec 선언형으로 표현 불가. 나머지(label, NumberFormatting, Range min/max/step 등)는
 * Spec properties + propagation으로 자동화 완료.
 *
 * value/minValue/maxValue → SliderTrack 동기화는 propagation 규칙이 담당하므로
 * afterSections에서 SliderTrack을 직접 업데이트하지 않는다.
 */
export const SliderHybridAfterSections = memo(
  function SliderHybridAfterSections({
    elementId,
    currentProps,
    onUpdate,
  }: ComponentEditorProps) {
    const { buildChildUpdates } = useSyncChildProp(elementId);

    const isRange = Array.isArray(currentProps.value);
    const rangeValues: [number, number] = isRange
      ? [
          Number((currentProps.value as number[])[0]) || 0,
          Number((currentProps.value as number[])[1]) || 100,
        ]
      : [0, 100];

    const syncSliderOutput = useCallback(
      (text: string) => {
        const childUpdates = buildChildUpdates([
          { childTag: "SliderOutput", propKey: "children", value: text },
        ]);
        if (childUpdates.length > 0) {
          useStore
            .getState()
            .updateSelectedPropertiesWithChildren({}, childUpdates);
        }
      },
      [buildChildUpdates],
    );

    const handleRangeModeToggle = useCallback(
      async (checked: boolean) => {
        const store = useStore.getState();
        const { childrenMap, elementsMap } = store;
        const minVal = Number(currentProps.minValue) || 0;
        const maxVal = Number(currentProps.maxValue) || 100;

        const sliderChildren = childrenMap.get(elementId) ?? [];
        const sliderTrack = sliderChildren.find(
          (c) => c.type === "SliderTrack",
        );
        const sliderOutputRef = sliderChildren.find(
          (c) => c.type === "SliderOutput",
        );

        if (checked) {
          // Single → Range
          const current = Number(currentProps.value) || 50;
          const startVal = Math.round(
            Math.max(minVal, current - (maxVal - minVal) * 0.15),
          );
          const endVal = Math.round(
            Math.min(maxVal, current + (maxVal - minVal) * 0.15),
          );

          onUpdate({ value: [startVal, endVal] });

          if (sliderOutputRef) {
            const freshOutput = elementsMap.get(sliderOutputRef.id);
            if (freshOutput) {
              store.updateElementProps(freshOutput.id, {
                ...freshOutput.props,
                children: `${startVal} – ${endVal}`,
              });
            }
          }

          if (sliderTrack) {
            const trackChildren = childrenMap.get(sliderTrack.id) ?? [];
            const thumbCount = trackChildren.filter(
              (c) => c.type === "SliderThumb",
            ).length;
            if (thumbCount < 2) {
              const parentEl = elementsMap.get(elementId);
              await store.addElement(
                withFrameElementMirrorId(
                  {
                    id: crypto.randomUUID(),
                    type: "SliderThumb",
                    props: {
                      style: { width: 18, height: 18, borderRadius: "50%" },
                    },
                    parent_id: sliderTrack.id,
                    page_id: parentEl?.page_id ?? null,
                    deleted: false,
                  },
                  parentEl ? getFrameElementMirrorId(parentEl) : null,
                ),
              );
            }
          }
        } else {
          // Range → Single
          const vals = currentProps.value as number[];
          const singleVal = Array.isArray(vals) ? vals[0] : (vals ?? 50);

          onUpdate({ value: singleVal });

          if (sliderOutputRef) {
            const freshOutput = elementsMap.get(sliderOutputRef.id);
            if (freshOutput) {
              store.updateElementProps(freshOutput.id, {
                ...freshOutput.props,
                children: String(singleVal),
              });
            }
          }

          if (sliderTrack) {
            const trackChildren = childrenMap.get(sliderTrack.id) ?? [];
            const thumbs = trackChildren.filter(
              (c) => c.type === "SliderThumb",
            );
            if (thumbs.length > 1) {
              const toRemove = thumbs.slice(1).map((t) => t.id);
              await store.removeElements(toRemove);
            }
          }
        }
      },
      [
        elementId,
        currentProps.minValue,
        currentProps.maxValue,
        currentProps.value,
        onUpdate,
      ],
    );

    const updateRangeValue = useCallback(
      (index: 0 | 1, raw: string) => {
        const num = raw === "" ? 0 : Number(raw) || 0;
        const el = useStore.getState().elementsMap.get(elementId);
        const currentVal = (el?.props as Record<string, unknown>)?.value;
        const latest: [number, number] = Array.isArray(currentVal)
          ? [Number(currentVal[0]) || 0, Number(currentVal[1]) || 100]
          : [0, 100];
        latest[index] = num;
        onUpdate({ value: latest });
        syncSliderOutput(`${latest[0]} – ${latest[1]}`);
      },
      [elementId, onUpdate, syncSliderOutput],
    );

    return (
      <PropertySection title="Value">
        <PropertySwitch
          label="Range Mode"
          isSelected={isRange}
          onChange={handleRangeModeToggle}
          icon={GripHorizontal}
        />

        {isRange ? (
          <>
            <PropertyInput
              label="Start Value"
              value={String(rangeValues[0])}
              onChange={(value) => updateRangeValue(0, value)}
              icon={NotebookTabs}
              placeholder="0"
            />
            <PropertyInput
              label="End Value"
              value={String(rangeValues[1])}
              onChange={(value) => updateRangeValue(1, value)}
              icon={NotebookTabs}
              placeholder="100"
            />
          </>
        ) : (
          <PropertyInput
            label={PROPERTY_LABELS.DEFAULT_VALUE}
            value={String(currentProps.value ?? "")}
            onChange={(value) => {
              const numVal = value === "" ? 0 : Number(value) || 0;
              onUpdate({ value: numVal });
              syncSliderOutput(String(numVal));
            }}
            icon={NotebookTabs}
            placeholder="0"
          />
        )}
      </PropertySection>
    );
  },
);
