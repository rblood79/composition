/**
 * Project Export Schema
 *
 * Zod 스키마를 사용한 프로젝트 데이터 검증
 *
 * @since 2026-01-02 Phase 1
 */
import { z } from "zod";
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
const uuidPattern = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const LooseRecordSchema = z.record(z.string(), z.unknown());
export const CanonicalNodeSchema = z.lazy(() => z
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
})
    .catchall(z.unknown()));
export const CompositionDocumentSchema = z
    .object({
    version: z.string().regex(/^composition-\d+\.\d+$/, {
        message: 'CompositionDocument version must use the "composition-<major>.<minor>" namespace',
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
        .max(EXPORT_LIMITS.MAX_PROJECT_NAME_LENGTH, `Project name must be at most ${EXPORT_LIMITS.MAX_PROJECT_NAME_LENGTH} characters`),
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
    metadata: MetadataSchema,
})
    .strict();
//# sourceMappingURL=project.schema.js.map