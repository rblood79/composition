---
title: Service Modules — auth-only 이후 실존 범위
impact: HIGH
impactDescription: cloud CRUD adapter 는 ADR-128 로 전부 삭제 — services/ 는 mock API + 저장/에러 유틸 + AI 만
tags: [supabase, service, architecture, adr-128]
---

과거 `services/api/*` 의 cloud service module 규약(`elementsService` 류 Supabase CRUD)은 ADR-128 Phase 2 에서 **전부 삭제**됐습니다 (`BaseApiService` / `legacyElementsApiService` / `ProjectsApiService` / `PagesApiService` / `DocumentsApiService` 등 11 파일). 현행 `apps/builder/src/services/` 실존 범위:

| 모듈                           | 역할                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `services/api/index.ts`        | **mock data API** — `apiConfig`/`fetchMockData` (countries/products 등 목업 엔드포인트) + `handleApiError` |
| `services/api/ErrorHandler.ts` | `classifyError` 등 에러 분류 유틸 (`useErrorHandler` hook 이 소비)                                         |
| `services/save/saveService.ts` | 저장 파이프라인 — `getDB()`(IndexedDB adapter) 경유                                                        |
| `services/ai/*`                | Groq Agent (Tool Calling)                                                                                  |

## Incorrect

```tsx
// ❌ cloud service module 부활 — ADR-128 위반
// services/api/elementsService.ts (신설 금지)
export const elementsService = {
  async getAll() {
    const { data, error } = await supabase.from("elements").select("*");
    ...
  },
};

// ❌ 컴포넌트/스토어에 목업 fetch 로직 인라인 중복 — services/api 의 apiConfig 우회
```

## Correct

```tsx
// ✅ 목업 엔드포인트 추가/사용 — services/api/index.ts 의 apiConfig 경유
import { apiConfig } from "@/services/api";
const data = await apiConfig.MOCK_DATA("/countries", { page: 1, limit: 10 });

// ✅ 데이터 영속 — IndexedDB adapter + canonical document
import { getDB } from "@/lib/db"; // apps/builder/src/lib/db/index.ts:25
const db = await getDB();

// ✅ collection 컴포넌트 items read — useCollectionData 단일 경유 (ADR-132)
// apps/builder/src/builder/hooks/useCollectionData.ts:202
// (source="api" 도 useAsyncList.load 안에서 처리 — useEffect+useState 우회 금지)

// ✅ 에러 처리 — 기존 유틸 재사용
import { handleApiError } from "@/services/api";
import { useErrorHandler } from "@/builder/hooks/useErrorHandler";
```

## Why

- `services/api/index.ts` 상단 주석이 정본: cloud adapter export 는 제거됐고 "본 index 는 mock data API + apiConfig + handleApiError 만 export" — 신규 caller 는 mock API 또는 IndexedDB(`getDB()`) 직접 사용 (ADR-128 주석 명시)
- cloud 시나리오 검토 불필요가 ADR-128 의 Positive consequence — service module 계층에 cloud 전제 코드를 다시 들이면 dead code 누적이 재발

## 관련 규칙

- [supabase-no-direct-calls](supabase-no-direct-calls.md) — auth-only boundary (auth 진입점 전수)
- [supabase-rls-required](supabase-rls-required.md) — RLS 적용 범위 (auth-only 이후)
- `.claude/rules/state-management.md` — Memory→Index→History→DB(IndexedDB)→Preview 파이프라인
