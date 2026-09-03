# Supabase Schema Reference (Human-readable)

> **역사 문서 — cloud data layer 폐기 전 schema**
>
> ADR-128 이후 production에서 Supabase는 인증에만 사용합니다. 아래
> `projects`/`pages`/`elements`/`design_*` 테이블은 현행 Builder 저장 경로가
> 아닙니다. 프로젝트 데이터의 정본은
> [IndexedDB의 canonical document](INDEXDB.md)이며, 폐기 결정은
> [ADR-128](../../adr/completed/128-supabase-backend-decommission.md)을
> 참조하세요.

## projects

- id: UUID (PK)
- name: TEXT
- created_by: UUID (FK → users)
- domain: TEXT unique
- created_at: TIMESTAMP default now()
- updated_at: TIMESTAMP default now()

## pages

- id: UUID (PK)
- project_id: UUID (FK → projects)
- title: TEXT
- slug: TEXT
- order_num: INT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP

## elements

- id: UUID (PK)
- page_id: UUID (FK → pages)
- parent_id: UUID? (null for root)
- tag: TEXT ('div','Button',...)
- props: JSONB (style/className/events/component props)
- order_num: INT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP

## design_tokens

- id: UUID (PK)
- project_id: UUID (FK → projects)
- theme_id: UUID (FK → design_themes)
- name: TEXT (e.g., color.brand.primary)
- type: TEXT (color/typography/spacing/shadow)
- value: JSONB
- scope: TEXT ('raw'/'semantic')
- alias_of: TEXT?
- css_variable: TEXT? (e.g., --color-primary)
- created_at: TIMESTAMP

## design_themes

- id: UUID (PK)
- project_id: UUID (FK → projects)
- name: TEXT
- status: TEXT (active/archived)
- version: INT (default 1)
- created_at: TIMESTAMP
