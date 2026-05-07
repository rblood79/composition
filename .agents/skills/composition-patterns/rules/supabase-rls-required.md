---
title: Always Use Row Level Security
impact: HIGH
impactDescription: 데이터 보안, 권한 관리, 다중 테넌트 지원
tags: [supabase, security, rls]
---

모든 테이블에 Row Level Security (RLS)를 적용합니다.

## Incorrect

```sql
-- ❌ RLS 없는 테이블
CREATE TABLE elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  type TEXT NOT NULL,
  props JSONB DEFAULT '{}'
);

-- RLS 미활성화 상태로 운영
```

```tsx
// ❌ 클라이언트에서 모든 데이터 접근 가능
const { data } = await supabase.from("elements").select("*"); // 다른 사용자 데이터도 조회됨
```

## Correct

```sql
-- ✅ RLS 활성화 및 정책 설정
CREATE TABLE elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  props JSONB DEFAULT '{}'
);

-- RLS 활성화
ALTER TABLE elements ENABLE ROW LEVEL SECURITY;

-- 정책 정의: 본인 데이터만 조회/수정 가능
CREATE POLICY "Users can view own elements"
  ON elements FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own elements"
  ON elements FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own elements"
  ON elements FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own elements"
  ON elements FOR DELETE
  USING (user_id = auth.uid());
```

```tsx
// ✅ 자동으로 현재 사용자 데이터만 조회됨
const { data } = await supabase.from("elements").select("*"); // RLS가 자동 필터링
```
