/**
 * Project Export Schema
 *
 * Zod 스키마를 사용한 프로젝트 데이터 검증
 *
 * @since 2026-01-02 Phase 1
 */
import { z } from "zod";
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
    [key: string]: unknown;
}
export declare const CanonicalNodeSchema: z.ZodType<CanonicalNodeSchemaShape>;
export declare const CompositionDocumentSchema: z.ZodObject<{
    version: z.ZodString;
    themes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    imports: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    _meta: z.ZodOptional<z.ZodObject<{
        schemaVersion: z.ZodOptional<z.ZodLiteral<"canonical-primary-1.0">>;
    }, z.core.$catchall<z.ZodUnknown>>>;
    children: z.ZodArray<z.ZodType<CanonicalNodeSchemaShape, unknown, z.core.$ZodTypeInternals<CanonicalNodeSchemaShape, unknown>>>;
}, z.core.$catchall<z.ZodUnknown>>;
/**
 * Project Info 스키마
 */
export declare const ProjectInfoSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
}, z.core.$strip>;
/**
 * Metadata 스키마 (Phase 4)
 */
export declare const MetadataSchema: z.ZodOptional<z.ZodObject<{
    builderVersion: z.ZodString;
    exportedBy: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    thumbnail: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
/**
 * 전체 Export 데이터 스키마
 */
export declare const ExportedProjectSchema: z.ZodObject<{
    version: z.ZodString;
    exportedAt: z.ZodString;
    project: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    document: z.ZodObject<{
        version: z.ZodString;
        themes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        imports: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        _meta: z.ZodOptional<z.ZodObject<{
            schemaVersion: z.ZodOptional<z.ZodLiteral<"canonical-primary-1.0">>;
        }, z.core.$catchall<z.ZodUnknown>>>;
        children: z.ZodArray<z.ZodType<CanonicalNodeSchemaShape, unknown, z.core.$ZodTypeInternals<CanonicalNodeSchemaShape, unknown>>>;
    }, z.core.$catchall<z.ZodUnknown>>;
    currentPageId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fontRegistry: z.ZodOptional<z.ZodUnknown>;
    metadata: z.ZodOptional<z.ZodObject<{
        builderVersion: z.ZodString;
        exportedBy: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        thumbnail: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strict>;
export type ExportedProjectSchemaType = z.infer<typeof ExportedProjectSchema>;
export {};
//# sourceMappingURL=project.schema.d.ts.map