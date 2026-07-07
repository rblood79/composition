---
title: Supabase Auth-Only Boundary
impact: HIGH
impactDescription: ADR-128 — Supabase 는 로그인(auth) 전용. 데이터 영속은 IndexedDB + canonical document
tags: [supabase, architecture, auth, adr-128]
---

Supabase 사용은 **auth 전용**입니다 (ADR-128 Implemented 2026-05-12 — `docs/adr/completed/128-supabase-backend-decommission.md`). cloud data layer(`supabase.from(...)` 기반 elements/pages/projects query)는 전부 dead 판정 후 물리 삭제됐고, 데이터 영속은 **IndexedDB + canonical document** 가 담당합니다.

**현행 auth 진입점 (전수, grep 확증 2026-07-07 — `supabase.from()` 0건)**:

| 파일                                      | 호출                                      |
| ----------------------------------------- | ----------------------------------------- |
| `apps/builder/src/env/supabase.client.ts` | `createClient()` singleton (유일 생성)    |
| `apps/builder/src/auth/Signin.tsx`        | `signUp`(:29) / `signInWithPassword`(:48) |
| `apps/builder/src/auth/devAutoLogin.ts`   | `signInWithPassword`(:15)                 |
| `apps/builder/src/main.tsx`               | `getSession`(:43, :47)                    |
| `apps/builder/src/dashboard/index.tsx`    | `getSession`(:70)                         |

## Incorrect

```tsx
// ❌ 데이터 CRUD 에 Supabase 사용 — ADR-128 dead 정책 위반
//    supabase.from(...) 호출 발견 시 즉시 dead 판정 (ADR-128 Consequences)
const { data } = await supabase.from("elements").select("*");
await supabase.from("projects").insert({ ... });

// ❌ createClient 재호출 — singleton 외 클라이언트 생성 금지
import { createClient } from "@supabase/supabase-js";
const myClient = createClient(url, key);

// ❌ auth 외 Supabase surface (storage / rpc / realtime) 신규 도입
```

## Correct

```tsx
// ✅ auth 는 singleton 경유
import { supabase } from "@/env/supabase.client";
const { error } = await supabase.auth.signInWithPassword({ email, password });
const {
  data: { session },
} = await supabase.auth.getSession();

// ✅ 데이터 영속은 IndexedDB adapter + canonical document
import { getDB } from "@/lib/db"; // apps/builder/src/lib/db/index.ts:25
const db = await getDB();
// canonical mutation 순서는 .claude/rules/state-management.md §Canonical sync 호출 순서

// ✅ collection 컴포넌트의 items read 는 useCollectionData 단일 경유 (ADR-132)
// apps/builder/src/builder/hooks/useCollectionData.ts:202
```

## Why

- cloud premise 는 stale (사용자 확정: "로그인 후 모두 IndexedDB 에서 구현 중") — cloud 호출 부활은 ADR-128 을 Supersede 하는 신규 ADR 없이 금지
- auth 흐름(signIn / signUp / getSession / token refresh)은 회귀 금지 hard constraint — auth 영역 변경 시 `supabase.auth.*` grep 으로 진입점 변화 0 확인

## 관련 규칙

- [supabase-rls-required](supabase-rls-required.md) — RLS 적용 범위 (auth-only 이후)
- [supabase-service-modules](supabase-service-modules.md) — services/ 실존 범위
- `.claude/rules/state-management.md` — canonical document / IndexedDB 파이프라인
