---
title: Row Level Security — ADR-128 이후 적용 범위
impact: HIGH
impactDescription: 데이터 보안 — 단, ADR-128 이후 앱 데이터는 IndexedDB 이므로 RLS 실효 범위는 auth 관련 영역 한정
tags: [supabase, security, rls, adr-128]
---

ADR-128 (Implemented 2026-05-12) 이후 **데이터 영속은 IndexedDB + canonical document** 입니다. 앱 데이터용 Supabase 테이블(`elements`/`pages`/`projects` 등)은 dead 판정 후 코드에서 제거됐으므로, RLS 규칙의 실효 범위는 **Supabase auth 관련 영역으로 한정**됩니다.

## 현행 규칙

1. **신규 Supabase 테이블 생성 자체가 정책 위반** — 데이터 저장 요구는 IndexedDB(`getDB()`) + canonical document 로 해결. Supabase 테이블 제안은 ADR-128 을 Supersede 하는 신규 ADR 이 선행돼야 함
2. **auth 관련 데이터** (Supabase `auth.users` 등)는 Supabase 관리 영역 — 앱 코드에서 테이블 직접 query 없음 (`supabase.from()` 0건, [supabase-no-direct-calls](supabase-no-direct-calls.md))
3. **미래 cloud 재도입 시** (ADR-128 reverse): 그 시점에 모든 신규 테이블에 RLS 활성화 + owner 정책이 필수 원칙으로 복원됨

## 역사적 참고 — cloud 시절 RLS 마이그레이션

`docs/migrations/002_create_documents_table.sql`(:36 `ALTER TABLE documents ENABLE ROW LEVEL SECURITY;` + owner read/write POLICY)은 cloud documents 시절 산출물로, ADR-128 로 해당 코드 경로가 삭제된 **역사적 문서**입니다. 신규 작업의 근거로 재사용 금지 — 다만 cloud 재도입 ADR 작성 시 RLS 패턴 참고 자료로는 유효:

```sql
-- 참고 패턴 (역사적) — 테이블 생성 시 RLS 활성화 + owner 정책
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner can read" ON documents FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "owner can write" ON documents FOR ALL USING (user_id = auth.uid());
```

## Incorrect

```tsx
// ❌ "RLS 걸었으니 안전" 명분으로 앱 데이터 테이블 신설 — RLS 이전에 테이블 자체가 정책 위반
await supabase.from("user_projects").select("*"); // ADR-128 위반
```

## Correct

```tsx
// ✅ 앱 데이터는 IndexedDB — 사용자 단일 로컬 환경이라 row-level 권한 개념 자체가 불필요
import { getDB } from "@/lib/db";
const db = await getDB();
```

## 관련 규칙

- [supabase-no-direct-calls](supabase-no-direct-calls.md) — auth-only boundary (진입점 전수)
- [supabase-service-modules](supabase-service-modules.md) — services/ 실존 범위
- `docs/adr/completed/128-supabase-backend-decommission.md` — 공식 결정
