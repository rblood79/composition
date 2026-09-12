/**
 * Project Export Schema
 *
 * Zod 스키마를 사용한 프로젝트 데이터 검증
 *
 * @since 2026-01-02 Phase 1
 */

import { z } from "zod";
import { VariableDefSchema } from "../state/variable.types";
import { EXPORT_LIMITS } from "../types/export.types";

// ============================================
// Base Schemas
// ============================================

/**
 * Semver 버전 패턴
 */
const semverPattern = /^\d+\.\d+\.\d+$/;

/**
 * UUID 패턴 (유연하게 - 하이픈 없는 것도 허용)
 */
const uuidPattern =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

// ============================================
// Canonical Document Schema
// ============================================

interface CanonicalNodeSchemaShape {
  id: string;
  type: string;
  name?: string;
  props?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  reusable?: boolean;
  children?: CanonicalNodeSchemaShape[];
  slot?: false | string[];
  theme?: Record<string, unknown>;
  ref?: string;
  descendants?: Record<string, unknown>;
  clip?: unknown;
  placeholder?: boolean;
  /** ADR-214 — 노드 소유 상태 정의 (페이지 · 요소 변수) */
  state?: unknown;
  [key: string]: unknown;
}

const LooseRecordSchema = z.record(z.string(), z.unknown());

export const CanonicalNodeSchema: z.ZodType<CanonicalNodeSchemaShape> = z.lazy(
  () =>
    z
      .object({
        id: z
          .string()
          .min(1, { message: "Canonical node ID is required" })
          .refine((id) => !id.includes("/"), {
            message: "Canonical node ID must not contain slash characters",
          }),
        type: z.string().min(1, {
          message: "Canonical node type is required",
        }),
        name: z.string().optional(),
        props: LooseRecordSchema.optional(),
        metadata: LooseRecordSchema.optional(),
        reusable: z.boolean().optional(),
        children: z.array(CanonicalNodeSchema).optional(),
        slot: z.union([z.literal(false), z.array(z.string())]).optional(),
        theme: LooseRecordSchema.optional(),
        ref: z.string().optional(),
        descendants: LooseRecordSchema.optional(),
        clip: z.unknown().optional(),
        placeholder: z.boolean().optional(),
        // ADR-214 Phase 1 — 잘못된 state 는 import 경계에서 거부 (catchall 통과 금지)
        state: z.array(VariableDefSchema).optional(),
      })
      .catchall(z.unknown()),
);

export const CompositionDocumentSchema = z
  .object({
    version: z.string().regex(/^composition-\d+\.\d+$/, {
      message:
        'CompositionDocument version must use the "composition-<major>.<minor>" namespace',
    }),
    themes: LooseRecordSchema.optional(),
    variables: LooseRecordSchema.optional(),
    imports: z.record(z.string(), z.string()).optional(),
    _meta: z
      .object({
        schemaVersion: z.literal("canonical-primary-1.0").optional(),
      })
      .catchall(z.unknown())
      .optional(),
    children: z.array(CanonicalNodeSchema),
  })
  .catchall(z.unknown());

// ============================================
// Project Schema
// ============================================

/**
 * Project Info 스키마
 */
export const ProjectInfoSchema = z.object({
  id: z.string().regex(uuidPattern, {
    message: "Project ID must be a valid UUID",
  }),
  name: z
    .string()
    .min(1, "Project name is required")
    .max(
      EXPORT_LIMITS.MAX_PROJECT_NAME_LENGTH,
      `Project name must be at most ${EXPORT_LIMITS.MAX_PROJECT_NAME_LENGTH} characters`,
    ),
});

/**
 * Metadata 스키마 (Phase 4)
 */
export const MetadataSchema = z
  .object({
    builderVersion: z.string().regex(semverPattern, {
      message: "Builder version must follow semver format",
    }),
    exportedBy: z.string().max(120).optional(),
    description: z
      .string()
      .max(EXPORT_LIMITS.MAX_DESCRIPTION_LENGTH)
      .optional(),
    thumbnail: z.string().optional(),
  })
  .optional();

/**
 * 전체 Export 데이터 스키마
 */
export const ExportedProjectSchema = z
  .object({
    version: z.string().regex(semverPattern, {
      message: "Version must follow semver format (e.g., 1.0.0)",
    }),
    exportedAt: z.string().datetime({
      message: "exportedAt must be a valid ISO 8601 datetime",
    }),
    project: ProjectInfoSchema,
    document: CompositionDocumentSchema,
    currentPageId: z.string().nullable().optional(),
    fontRegistry: z.unknown().optional(),
    collections: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          // ADR-152 v2.1: `id` 는 안정 참조 (`{#id}` 템플릿 · fieldMap · 차트) — strip 되면 import 뒤 참조가 끊긴다
          schema: z
            .array(
              z.object({
                id: z.string().optional(),
                key: z.string(),
                type: z.string(),
                label: z.string().optional(),
                required: z.boolean().optional(),
                defaultValue: z.unknown().optional(),
              }),
            )
            .optional(),
          mockData: z.array(z.record(z.string(), z.unknown())).optional(),
          runtimeData: z.array(z.record(z.string(), z.unknown())).optional(),
          useMockData: z.boolean().optional(),
          // ADR-218 — 실행 정책은 export 에 보존(import 복원). runtimeData 는 export 채널 제외.
          executionPolicy: z
            .object({
              mode: z.enum(["auto", "manual", "interval"]),
              intervalSec: z.number().int().positive().optional(),
            })
            .optional(),
          status: z.enum(["idle", "loading", "success", "error"]).optional(),
          error: z.string().nullable().optional(),
        }),
      )
      .optional(),
    apiEndpoints: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          baseUrl: z.string(),
          path: z.string(),
          method: z.string().optional(),
          headers: z
            .union([
              z.record(z.string(), z.string()),
              z.array(
                z.object({
                  key: z.string(),
                  value: z.string(),
                  enabled: z.boolean(),
                }),
              ),
            ])
            .optional(),
          queryParams: z
            .array(z.object({ key: z.string(), value: z.string() }))
            .optional(),
          bodyType: z.string().optional(),
          bodyTemplate: z.string().optional(),
          responseMapping: z
            .object({
              dataPath: z.string(),
              fieldMappings: z
                .array(
                  z.object({ sourceKey: z.string(), targetKey: z.string() }),
                )
                .optional(),
            })
            .optional(),
          executionMode: z.enum(["client", "server"]).optional(),
          timeout: z.number().optional(),
        }),
      )
      .optional(),
    metadata: MetadataSchema,
  })
  .strict();

export type ExportedProjectSchemaType = z.infer<typeof ExportedProjectSchema>;
