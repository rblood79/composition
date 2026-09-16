import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { racSuggestionFeatures } from "./racSuggestionFeatures";
import { describe, expect, it } from "vitest";
import { resolveEditContract, type CanonicalNode } from "@composition/shared";
import { getLocalSuggestions } from "./localSuggestions";
import { withPanelStyleFields } from "../../../services/ai/compiler/styleManifest";
import type {
  CommandContext,
  CommandManifest,
} from "../../../services/ai/compiler/manifest";

function fixture(type: string, props: Record<string, unknown> = {}) {
  const fields = resolveEditContract({
    id: "selected",
    type,
    props,
  } as CanonicalNode).fields;
  const manifest: CommandManifest = {
    commands: [],
    components: ["Button", "Select", "Card"].map((type) => ({
      type,
      label: type,
      placeable: true,
      creationMode: "leaf",
      props: [],
    })),
  };
  const context: CommandContext = {
    selectedId: "selected",
    parentId: "body",
    nodes: [
      { id: "body", type: "body" },
      {
        id: "selected",
        type,
        props: withPanelStyleFields(
          fields.map((field) => ({
            name: field.key,
            origin: field.origin,
            kind: field.kind,
            values: field.options?.map((option) => option.value),
            min: field.min,
            max: field.max,
          })),
        ),
      },
    ],
  };
  return { fields, manifest, context, korean: false };
}

describe("선택 계약에 맞는 로컬 추천", () => {
  it("Button과 Select의 실제 편집 계약에 따라 추천이 달라진다", () => {
    const button = getLocalSuggestions(fixture("Button"));
    const select = getLocalSuggestions(fixture("Select"));
    expect(button.filter((item) => item.group === "component").length).toBe(2);
    expect(button.filter((item) => item.group === "common").length).toBe(2);
    expect(select.filter((item) => item.group === "component").length).toBe(3);
    expect(select.filter((item) => item.group === "common").length).toBe(2);
    expect(button).not.toEqual(select);
    expect(button.every((item) => item.request.startsWith("set "))).toBe(true);
  });
  it("현재 boolean 값이 바뀌면 반대 동작을 추천한다", () => {
    const initial = fixture("Checkbox", { isSelected: false });
    initial.fields = initial.fields.filter(
      (field) => field.key === "isSelected",
    );
    expect(getLocalSuggestions(initial)[0]?.request).toBe(
      "set isSelected to true",
    );
    initial.fields[0].currentValue = true;
    expect(getLocalSuggestions(initial)[0]?.request).toBe(
      "set isSelected to false",
    );
  });
  it("숨김·조건부 필드와 semantic/style 이름 충돌을 추천하지 않는다", () => {
    const input = fixture("Button");
    const field = input.fields.find(
      (field) => field.origin === "semantic" && field.options?.length,
    )!;
    input.fields = [field];
    field.editorHidden = true;
    expect(
      getLocalSuggestions(input).some((item) =>
        item.request.startsWith(`set ${field.key} `),
      ),
    ).toBe(false);
    field.editorHidden = false;
    const target = input.context.nodes[1];
    target.props = [
      ...target.props!,
      { name: field.key, origin: "style", kind: "css" },
    ];
    expect(
      getLocalSuggestions(input).some((item) =>
        item.request.startsWith(`set ${field.key} `),
      ),
    ).toBe(false);
  });
  it("선택이 없으면 등록된 생성만, 페이지도 없으면 추천하지 않는다", () => {
    const input = fixture("Button");
    input.context.selectedId = null;
    expect(getLocalSuggestions(input).map((item) => item.request)).toEqual([
      "Add Button",
      "Add Select",
      "Add Card",
    ]);
    input.context.parentId = null;
    expect(getLocalSuggestions(input)).toEqual([]);
  });
});

describe("RAC 주요 기능과 공통 편집을 함께 제공", () => {
  it.each([
    ["Button", "set isPending to true"],
    ["Checkbox", "set isIndeterminate to true"],
    ["ToggleButton", "set isSelected to true"],
    ["Select", "set selectionMode to multiple"],
    ["ComboBox", "set allowsCustomValue to true"],
    ["NumberField", "set step to 5"],
    ["ProgressBar", "set isIndeterminate to true"],
    ["ListBox", "set selectionMode to multiple"],
    ["Table", "set selectionMode to multiple"],
    ["Disclosure", "set isExpanded to false"],
    ["DisclosureGroup", "set allowsMultipleExpanded to false"],
    ["TimeField", "set hourCycle to 12"],
    ["FileTrigger", "set allowsMultiple to true"],
  ])("%s의 주요 기능이 공통 variant/size에 밀리지 않는다", (type, request) => {
    const suggestions = getLocalSuggestions(fixture(type));
    expect(
      suggestions
        .filter((item) => item.group === "component")
        .map((item) => item.request),
    ).toContain(request);
    expect(suggestions.some((item) => item.group === "common")).toBe(true);
  });
  it.each(Object.entries(racSuggestionFeatures))(
    "%s의 우선 기능은 실제 RAC md와 현재 편집 계약에 근거한다",
    (type, features) => {
      const reference = readFileSync(
        resolve(
          import.meta.dirname,
          "../../../../../../.claude/skills/react-aria/references/components",
          `${features.reference}.md`,
        ),
        "utf8",
      );
      const input = fixture(type);
      for (const key of features.fields) {
        expect(reference, `${type}.${key} reference`).toContain(`\`${key}\``);
        expect(
          input.fields.some((field) => field.key === key),
          `${type}.${key} editable`,
        ).toBe(true);
      }
      expect(
        getLocalSuggestions(input).some((item) => item.group === "component"),
      ).toBe(true);
    },
  );
  it("문서에 있어도 편집 계약이 없으면 실행 추천을 만들지 않는다", () => {
    const input = fixture("ComboBox");
    input.fields = input.fields.filter(
      (field) => field.key !== "allowsCustomValue",
    );
    expect(
      getLocalSuggestions(input).some((item) =>
        item.request.includes("allowsCustomValue"),
      ),
    ).toBe(false);
  });
  it("숫자 기능은 현재 범위 안의 값과 step을 제안한다", () => {
    const suggestions = getLocalSuggestions(
      fixture("Slider", { minValue: 10, maxValue: 20, step: 2, value: 10 }),
    );
    expect(suggestions.map((item) => item.request)).toContain(
      "set value to 14",
    );
    const small = getLocalSuggestions(
      fixture("Slider", { minValue: 0, maxValue: 0.5, step: 0.1 }),
    );
    expect(small.some((item) => item.request.startsWith("set step"))).toBe(
      false,
    );
  });
});

describe("추천 작업의 완료 조건", () => {
  it("사용자 입력 허용은 readonly/disabled도 같은 한 번의 수정으로 해제한다", () => {
    const input = fixture("ComboBox", {
      allowsCustomValue: false,
      isDisabled: true,
      isReadOnly: true,
    });
    const suggestion = getLocalSuggestions({
      ...input,
      identity: "page:combo",
    }).find((item) => item.request === "set allowsCustomValue to true")!;
    expect(suggestion.execution).toMatchObject({
      identity: "page:combo",
      program: {
        version: 1,
        source: "compiler",
        operations: [
          {
            op: "update_element",
            args: {
              elementId: "selected",
              props: {
                allowsCustomValue: true,
                isDisabled: false,
                isReadOnly: false,
              },
            },
          },
        ],
      },
    });
    expect(suggestion.execution!.program.operations).toHaveLength(1);
  });
  it("표시 상태 변경에는 입력 허용 같은 무관한 속성을 섞지 않는다", () => {
    const suggestion = getLocalSuggestions(
      fixture("Button", { isDisabled: true }),
    ).find((item) => item.request === "set isPending to true")!;
    expect(suggestion.execution!.program.operations[0].args).toEqual({
      elementId: "selected",
      props: { isPending: true },
    });
  });
});
