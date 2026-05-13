/**
 * React Query Hooks for Data Panel
 *
 * 🚀 Phase 6: React Query 서버 상태 관리
 *
 * 기능:
 * - 자동 캐싱 (5분 staleTime)
 * - 중복 요청 방지 (request deduplication)
 * - 자동 재시도 (retry: 2)
 * - 백그라운드 refetch
 * - 선언적 로딩/에러 상태
 *
 * @since 2025-12-10 Phase 6 React Query
 */

import { useQuery, useMutation, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { getDB } from "../../lib/db";
import type {
  DataTable,
  ApiEndpoint,
  Variable,
  Transformer,
} from "../../types/builder/data.types";

// ============================================
// Query Keys
// ============================================

/**
 * 쿼리 키 팩토리
 * - 일관된 키 관리
 * - 자동 완성 지원
 */
export const dataQueryKeys = {
  all: ["data"] as const,

  // DataTables
  collections: (projectId: string) =>
    [...dataQueryKeys.all, "collections", projectId] as const,
  dataTable: (projectId: string, tableName: string) =>
    [...dataQueryKeys.collections(projectId), tableName] as const,

  // API Endpoints
  apiEndpoints: (projectId: string) =>
    [...dataQueryKeys.all, "apiEndpoints", projectId] as const,
  apiEndpoint: (projectId: string, endpointName: string) =>
    [...dataQueryKeys.apiEndpoints(projectId), endpointName] as const,

  // Variables
  variables: (projectId: string) =>
    [...dataQueryKeys.all, "variables", projectId] as const,
  variable: (projectId: string, variableName: string) =>
    [...dataQueryKeys.variables(projectId), variableName] as const,

  // Transformers
  transformers: (projectId: string) =>
    [...dataQueryKeys.all, "transformers", projectId] as const,
  transformer: (projectId: string, transformerName: string) =>
    [...dataQueryKeys.transformers(projectId), transformerName] as const,
};

// ============================================
// API Functions (Direct DB Access)
// ============================================

/**
 * DataTables 조회
 */
async function fetchCollections(projectId: string): Promise<DataTable[]> {
  const db = await getDB();
  const data = await (
    db as unknown as {
      collections: { getByProject: (projectId: string) => Promise<DataTable[]> };
    }
  ).collections?.getByProject(projectId);

  return data || [];
}

/**
 * API Endpoints 조회
 */
async function fetchApiEndpoints(projectId: string): Promise<ApiEndpoint[]> {
  const db = await getDB();
  const data = await (
    db as unknown as {
      api_endpoints: {
        getByProject: (projectId: string) => Promise<ApiEndpoint[]>;
      };
    }
  ).api_endpoints?.getByProject(projectId);

  return data || [];
}

/**
 * Variables 조회
 */
async function fetchVariables(projectId: string): Promise<Variable[]> {
  const db = await getDB();
  const data = await (
    db as unknown as {
      variables: { getByProject: (projectId: string) => Promise<Variable[]> };
    }
  ).variables?.getByProject(projectId);

  return data || [];
}

/**
 * Transformers 조회
 */
async function fetchTransformers(projectId: string): Promise<Transformer[]> {
  const db = await getDB();
  const data = await (
    db as unknown as {
      transformers: {
        getByProject: (projectId: string) => Promise<Transformer[]>;
      };
    }
  ).transformers?.getByProject(projectId);

  return data || [];
}

// ============================================
// React Query Hooks
// ============================================

/**
 * DataTables 조회 훅
 *
 * @example
 * ```tsx
 * function DataTableList({ projectId }) {
 *   const { data, isLoading, error } = useDataTablesQuery(projectId);
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error error={error} />;
 *
 *   return <List items={data} />;
 * }
 * ```
 */
export function useDataTablesQuery(
  projectId: string | null | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<DataTable[], Error> {
  return useQuery({
    queryKey: dataQueryKeys.collections(projectId || ""),
    queryFn: () => fetchCollections(projectId!),
    enabled: !!projectId && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * API Endpoints 조회 훅
 */
export function useApiEndpointsQuery(
  projectId: string | null | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<ApiEndpoint[], Error> {
  return useQuery({
    queryKey: dataQueryKeys.apiEndpoints(projectId || ""),
    queryFn: () => fetchApiEndpoints(projectId!),
    enabled: !!projectId && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Variables 조회 훅
 */
export function useVariablesQuery(
  projectId: string | null | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<Variable[], Error> {
  return useQuery({
    queryKey: dataQueryKeys.variables(projectId || ""),
    queryFn: () => fetchVariables(projectId!),
    enabled: !!projectId && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Transformers 조회 훅
 */
export function useTransformersQuery(
  projectId: string | null | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<Transformer[], Error> {
  return useQuery({
    queryKey: dataQueryKeys.transformers(projectId || ""),
    queryFn: () => fetchTransformers(projectId!),
    enabled: !!projectId && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================
// Combined Data Query Hook
// ============================================

export interface DataPanelData {
  collections: DataTable[];
  apiEndpoints: ApiEndpoint[];
  variables: Variable[];
  transformers: Transformer[];
}

export interface DataPanelQueryResult {
  data: DataPanelData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * 모든 데이터 패널 데이터를 한번에 조회하는 훅
 *
 * @example
 * ```tsx
 * function DataTablePanel({ projectId, isActive }) {
 *   const { data, isLoading, error, refetch } = useDataPanelQuery(projectId, {
 *     enabled: isActive,
 *   });
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error error={error} />;
 *
 *   const { collections, apiEndpoints, variables, transformers } = data;
 *   // ...
 * }
 * ```
 */
export function useDataPanelQuery(
  projectId: string | null | undefined,
  options?: { enabled?: boolean }
): DataPanelQueryResult {
  const enabled = !!projectId && (options?.enabled !== false);

  const dataTablesQuery = useDataTablesQuery(projectId, { enabled });
  const apiEndpointsQuery = useApiEndpointsQuery(projectId, { enabled });
  const variablesQuery = useVariablesQuery(projectId, { enabled });
  const transformersQuery = useTransformersQuery(projectId, { enabled });

  const isLoading =
    dataTablesQuery.isLoading ||
    apiEndpointsQuery.isLoading ||
    variablesQuery.isLoading ||
    transformersQuery.isLoading;

  const isError =
    dataTablesQuery.isError ||
    apiEndpointsQuery.isError ||
    variablesQuery.isError ||
    transformersQuery.isError;

  const error =
    dataTablesQuery.error ||
    apiEndpointsQuery.error ||
    variablesQuery.error ||
    transformersQuery.error;

  const data =
    dataTablesQuery.data &&
    apiEndpointsQuery.data &&
    variablesQuery.data &&
    transformersQuery.data
      ? {
          collections: dataTablesQuery.data,
          apiEndpoints: apiEndpointsQuery.data,
          variables: variablesQuery.data,
          transformers: transformersQuery.data,
        }
      : undefined;

  const refetch = () => {
    dataTablesQuery.refetch();
    apiEndpointsQuery.refetch();
    variablesQuery.refetch();
    transformersQuery.refetch();
  };

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
  };
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * DataTable 생성 뮤테이션
 */
export function useCreateDataTableMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      dataTable,
    }: {
      projectId: string;
      dataTable: Omit<DataTable, "id" | "created_at" | "updated_at">;
    }) => {
      const db = await getDB();
      const created = await (
        db as unknown as {
          collections: {
            create: (data: Partial<DataTable>) => Promise<DataTable>;
          };
        }
      ).collections.create({
        ...dataTable,
        project_id: projectId,
      });
      return created;
    },
    onSuccess: (_, { projectId }) => {
      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: dataQueryKeys.collections(projectId),
      });
    },
  });
}

/**
 * DataTable 업데이트 뮤테이션
 */
export function useUpdateDataTableMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tableId,
      updates,
    }: {
      projectId: string;
      tableId: string;
      updates: Partial<DataTable>;
    }) => {
      const db = await getDB();
      const updated = await (
        db as unknown as {
          collections: {
            update: (id: string, data: Partial<DataTable>) => Promise<DataTable>;
          };
        }
      ).collections.update(tableId, updates);
      return updated;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: dataQueryKeys.collections(projectId),
      });
    },
  });
}

/**
 * DataTable 삭제 뮤테이션
 */
export function useDeleteDataTableMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tableId,
    }: {
      projectId: string;
      tableId: string;
    }) => {
      const db = await getDB();
      await (
        db as unknown as {
          collections: { delete: (id: string) => Promise<void> };
        }
      ).collections.delete(tableId);
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: dataQueryKeys.collections(projectId),
      });
    },
  });
}

// ============================================
// Cache Invalidation Utilities
// ============================================

/**
 * 프로젝트의 모든 데이터 캐시 무효화
 */
export function useInvalidateProjectData() {
  const queryClient = useQueryClient();

  return (projectId: string) => {
    queryClient.invalidateQueries({
      queryKey: [...dataQueryKeys.all, "collections", projectId],
    });
    queryClient.invalidateQueries({
      queryKey: [...dataQueryKeys.all, "apiEndpoints", projectId],
    });
    queryClient.invalidateQueries({
      queryKey: [...dataQueryKeys.all, "variables", projectId],
    });
    queryClient.invalidateQueries({
      queryKey: [...dataQueryKeys.all, "transformers", projectId],
    });
  };
}

/**
 * 전체 데이터 캐시 무효화
 */
export function useInvalidateAllData() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({
      queryKey: dataQueryKeys.all,
    });
  };
}
