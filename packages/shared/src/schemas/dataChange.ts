/**
 * `DataChange` — 데이터 편집의 단일 IR (ADR-152 §2-3, Phase 1c).
 *
 * 사람 UI (DataTableEditor) · import envelope · AI 제안 (ADR-213 `propose_data_change`
 * tool) · agent tool 이 같은 op 목록을 만들고, 적용기 `applyDataChange`
 * (`apps/builder/src/builder/stores/utils/dataChange.ts`) 하나가 파급 · History ·
 * 저장 · Canvas 동기화를 맡는다.
 *
 * **단일 소스**: zod 스키마가 정본이고 JSON Schema (`dataChangeJsonSchema`) 는 여기서
 * 생성한다 — 손으로 쓴 두 번째 JSON Schema 금지 (ADR-213 §결정 2). 필드 · 행 참조는
 * 전부 `fieldId` (v2.1) 다 — key 로 참조하는 op 는 없다.
 *
 * 타입은 builder 의 `DataField` (`apps/builder/src/types/builder/data.types.ts`) 와
 * 필드 단위로 같다 — builder 가 shared 를 import 하므로 shared 쪽이 정의를 둔다.
 */
import { z } from "zod";
import { VARIABLE_DEF_TYPES } from "../state/variable.types";

export const DATA_FIELD_TYPES = [
  "string",
  "number",
  "boolean",
  "date",
  "datetime",
  "email",
  "url",
  "image",
  "array",
  "object",
] as const;

export interface DataFieldShape {
  id?: string;
  key: string;
  type: (typeof DATA_FIELD_TYPES)[number];
  label?: string;
  required?: boolean;
  defaultValue?: unknown;
  children?: DataFieldShape[];
}

export const DataFieldSchema: z.ZodType<DataFieldShape> = z.object({
  id: z.string().optional(),
  key: z.string(),
  type: z.enum(DATA_FIELD_TYPES),
  label: z.string().optional(),
  required: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  get children() {
    return z.array(DataFieldSchema).optional();
  },
});

/**
 * `update_field.patch` — `null` 은 "키 제거" (label 을 지우는 undo 를 직렬화 뒤에도
 * 되살리기 위해; `undefined` 는 JSON 에서 사라진다). `id` 는 바꿀 수 없다.
 */
export const DataFieldPatchSchema = z.object({
  key: z.string().optional(),
  type: z.enum(DATA_FIELD_TYPES).optional(),
  label: z.string().nullable().optional(),
  required: z.boolean().nullable().optional(),
  defaultValue: z.unknown().nullable().optional(),
  get children() {
    return z.array(DataFieldSchema).nullable().optional();
  },
});

const RowSchema = z.record(z.string(), z.unknown());
const RowsSchema = z.array(RowSchema);
const SourceSchema = z.enum(["manual", "api"]);

export const ApiEndpointDraftSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  baseUrl: z.string(),
  path: z.string(),
  headers: z
    .array(
      z.object({ key: z.string(), value: z.string(), enabled: z.boolean() }),
    )
    .optional(),
  queryParams: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
        type: z.enum(["string", "number", "boolean"]),
        required: z.boolean(),
      }),
    )
    .optional(),
  bodyType: z
    .enum(["json", "form-data", "x-www-form-urlencoded", "none"])
    .optional(),
  bodyTemplate: z.string().optional(),
  dataPath: z.string().optional(),
  targetCollectionId: z.string().optional(),
});

const collectionRef = { collectionId: z.string().min(1) };

/**
 * ADR-214 Phase 1 — 프로젝트 변수 정의 (id 없는 `VariableDef`). `define_variable` 은
 * "변수 `variableId` 의 정의를 `definition` 으로 둔다" — `null` 은 제거 (`DataFieldPatchSchema`
 * 의 null=제거 규약과 같다). 생성은 `variableId` 생략 (적용기가 발급해 `applied` 에 싣는다).
 * 페이지 · 요소 변수는 canonical 노드 `state` 축이라 이 op 의 대상이 아니다.
 */
export const VariableDefinitionSchema = z.object({
  name: z.string().min(1),
  type: z.enum(VARIABLE_DEF_TYPES),
  defaultValue: z.unknown().optional(),
  persist: z.boolean().optional(),
});

export const DataOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create_collection"),
    /** undo 가 삭제된 collection 을 **같은 id** 로 되살릴 때만 채운다 (바인딩 참조 보존). */
    id: z.string().optional(),
    projectId: z.string().optional(),
    name: z.string().min(1),
    description: z.string().optional(),
    schema: z.array(DataFieldSchema),
    rows: RowsSchema.optional(),
    source: SourceSchema.optional(),
  }),
  z.object({ op: z.literal("delete_collection"), ...collectionRef }),
  z.object({
    op: z.literal("update_collection"),
    ...collectionRef,
    patch: z.object({
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
    }),
  }),
  z.object({
    op: z.literal("add_field"),
    ...collectionRef,
    field: DataFieldSchema,
    index: z.number().int().min(0).optional(),
  }),
  z.object({
    op: z.literal("update_field"),
    ...collectionRef,
    fieldId: z.string().min(1),
    /** `key` 변경 = rename — 적용기가 행 (mockData · runtimeData) 도 같이 옮긴다. */
    patch: DataFieldPatchSchema,
  }),
  z.object({
    op: z.literal("remove_field"),
    ...collectionRef,
    fieldId: z.string().min(1),
  }),
  z.object({
    op: z.literal("set_cell"),
    ...collectionRef,
    rowIndex: z.number().int().min(0),
    fieldId: z.string().min(1),
    value: z.unknown(),
  }),
  z.object({
    op: z.literal("insert_rows"),
    ...collectionRef,
    rows: RowsSchema.min(1),
    at: z.number().int().min(0).optional(),
  }),
  z.object({
    op: z.literal("remove_rows"),
    ...collectionRef,
    rowIndexes: z.array(z.number().int().min(0)).min(1),
  }),
  z.object({
    op: z.literal("replace_rows"),
    ...collectionRef,
    rows: RowsSchema,
  }),
  z.object({
    op: z.literal("set_source"),
    ...collectionRef,
    source: SourceSchema,
    endpointId: z.string().optional(),
  }),
  /**
   * ADR-213 Phase 4 — API endpoint 정의. `endpoint.id` 가 있고 store 에 있으면 그 정의를
   * 바꾸고, 없으면 생성 (적용기가 id 를 발급해 `applied` 에 싣는다). 생성의 역연산은
   * `delete_endpoint` (사람 전용 — tool 스키마에서 제외).
   */
  z.object({
    op: z.literal("define_endpoint"),
    endpoint: ApiEndpointDraftSchema,
  }),
  z.object({ op: z.literal("delete_endpoint"), endpointId: z.string().min(1) }),
  z.object({
    op: z.literal("bind_element"),
    elementId: z.string().min(1),
    /** `null` = 바인딩 해제 (ADR-213 Phase 2 — inverse 와 사람 UI 의 "연결 끊기" 가 같은 op). */
    collectionId: z.string().min(1).nullable(),
    fieldMap: z
      .object({ value: z.string().optional(), icon: z.string().optional() })
      .optional(),
    /**
     * inverse 전용 — 적용 전 `props.dataBinding` · `x-composition.dataBinding` 원본
     * 스냅샷. 있으면 `collectionId` 를 해석하지 않고 그대로 되돌린다 (legacy 형태
     * 보존). tool 노출 스키마 (`dataChangeJsonSchema`) 에서는 제거된다.
     */
    restore: z
      .object({
        props: z.unknown().optional(),
        extension: z.unknown().optional(),
      })
      .optional(),
  }),
  z.object({
    op: z.literal("define_variable"),
    variableId: z.string().min(1).optional(),
    definition: VariableDefinitionSchema.nullable(),
  }),
]);

export type DataOp = z.infer<typeof DataOpSchema>;
export type DataOpKind = DataOp["op"];
export type DataFieldPatch = z.infer<typeof DataFieldPatchSchema>;
export type ApiEndpointDraft = z.infer<typeof ApiEndpointDraftSchema>;
export type VariableDefinition = z.infer<typeof VariableDefinitionSchema>;

export const DATA_OP_KINDS = DataOpSchema.options.map(
  (option) => option.shape.op.value,
) as readonly DataOpKind[];

/**
 * 사람 UI 전용 — ADR-213 tool 스키마에서 제외 (`dataChangeJsonSchema({ excludeOps })`).
 *
 * `define_variable` (ADR-214) 은 삭제 (`definition: null`) 가 같은 op 라 분리 노출이 불가하고,
 * 변수의 AI 쓰기 경로는 ADR-214 범위 밖 (ADR-213 후속 판정 — `list_variables` 읽기부터) 이라
 * 전체를 사람 전용으로 둔다.
 */
export const HUMAN_ONLY_DATA_OPS: readonly DataOpKind[] = [
  "delete_collection",
  "remove_field",
  "remove_rows",
  "delete_endpoint",
  "define_variable",
];

/** 적용기 내부 (inverse) 전용 필드 — tool 입력 스키마에서 뺀다 (ADR-213 HC2). */
export const INTERNAL_DATA_OP_FIELDS: Readonly<
  Record<string, readonly string[]>
> = {
  bind_element: ["restore"],
};

export const DATA_CHANGE_ORIGINS = ["user", "import", "ai", "agent"] as const;
export type DataChangeOrigin = (typeof DATA_CHANGE_ORIGINS)[number];

export const DataChangeSchema = z.object({
  ops: z.array(DataOpSchema).min(1),
  origin: z.enum(DATA_CHANGE_ORIGINS),
  label: z.string().optional(),
});

export type DataChange = z.infer<typeof DataChangeSchema>;

export function parseDataChange(input: unknown): DataChange {
  return DataChangeSchema.parse(input);
}

/**
 * JSON Schema (draft 2020-12) — zod 스키마에서 생성. `excludeOps` 로 tool 에 노출하지
 * 않을 op 를 뺀 변형을 만든다 (ADR-213: `HUMAN_ONLY_DATA_OPS` 제외). `omitOrigin` 은
 * 모델 대면 변형 — origin 은 executor 가 stamp 한다 (HC2). `omitFields` 는 op 별 내부
 * 필드 (`INTERNAL_DATA_OP_FIELDS`) 를 뺀다.
 */
export function dataChangeJsonSchema(options?: {
  excludeOps?: readonly DataOpKind[];
  omitOrigin?: boolean;
  omitFields?: Readonly<Record<string, readonly string[]>>;
}): Record<string, unknown> {
  const exclude = new Set(options?.excludeOps ?? []);
  const omitFields = options?.omitFields ?? {};
  const ops = DataOpSchema.options
    .filter((option) => !exclude.has(option.shape.op.value))
    .map((option) => {
      const fields = omitFields[option.shape.op.value];
      if (!fields || fields.length === 0) return option;
      const mask = Object.fromEntries(fields.map((f) => [f, true as const]));
      return (option as z.ZodObject<z.ZodRawShape>).omit(mask as never);
    });
  const schema = z.object({
    ops: z.array(z.discriminatedUnion("op", ops as never)).min(1),
    ...(options?.omitOrigin ? {} : { origin: z.enum(DATA_CHANGE_ORIGINS) }),
    label: z.string().optional(),
  });
  return z.toJSONSchema(schema) as Record<string, unknown>;
}

/**
 * 모델 대면 `propose_data_change` 입력 스키마 — 사람 전용 op 제외 · origin 없음 · 내부
 * 필드 없음. Anthropic / Ollama 어댑터가 같은 이 파생을 쓰고 executor 만 origin 을 stamp 한다.
 */
export function modelFacingDataChangeJsonSchema(): Record<string, unknown> {
  return dataChangeJsonSchema({
    excludeOps: HUMAN_ONLY_DATA_OPS,
    omitOrigin: true,
    omitFields: INTERNAL_DATA_OP_FIELDS,
  });
}
