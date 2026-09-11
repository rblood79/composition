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
  z.object({
    op: z.literal("define_endpoint"),
    endpoint: ApiEndpointDraftSchema,
  }),
  z.object({
    op: z.literal("bind_element"),
    elementId: z.string().min(1),
    ...collectionRef,
    fieldMap: z
      .object({ value: z.string().optional(), icon: z.string().optional() })
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
  "remove_field",
  "remove_rows",
  "define_variable",
];

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
 * 않을 op 를 뺀 변형을 만든다 (ADR-213: `remove_field` · `remove_rows` 제외).
 */
export function dataChangeJsonSchema(options?: {
  excludeOps?: readonly DataOpKind[];
}): Record<string, unknown> {
  const exclude = new Set(options?.excludeOps ?? []);
  const ops = DataOpSchema.options.filter(
    (option) => !exclude.has(option.shape.op.value),
  );
  const schema = z.object({
    ops: z.array(z.discriminatedUnion("op", ops as never)).min(1),
    origin: z.enum(DATA_CHANGE_ORIGINS),
    label: z.string().optional(),
  });
  return z.toJSONSchema(schema) as Record<string, unknown>;
}
