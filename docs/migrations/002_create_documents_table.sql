-- =============================================
-- ADR-123 Phase 1 — documents table 신규 생성
-- Cloud document-level row schema 단일화 (Canonical primary storage)
--
-- 이 파일은 참조용이며 직접 실행하지 않습니다.
-- Supabase Dashboard 또는 migration tool에서 실행하세요.
--
-- @see docs/adr/123-cloud-document-row-schema.md
-- @see docs/adr/design/123-cloud-document-row-schema-breakdown.md
-- @see docs/adr/design/123-inventory.md
-- =============================================

-- =============================================
-- documents 테이블 신규 생성
-- =============================================
-- 1 project = 1 document (canonical CompositionDocument JSON)
-- legacy `pages`/`elements` row 는 migration window 동안 fallback 유지
-- (ADR-123 Phase 4-5 에서 hot path 0건 달성 후 deprecation 검토)

CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content     JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 1 project = 1 document 보장 (upsert conflict target)
CREATE UNIQUE INDEX IF NOT EXISTS documents_project_id_key
  ON documents (project_id);

-- =============================================
-- RLS Policy — owner 만 read/write
-- =============================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can read"
  ON documents FOR SELECT
  USING (project_id IN (
    SELECT id FROM projects WHERE created_by = auth.uid()::text
  ));

CREATE POLICY "owner can write"
  ON documents FOR ALL
  USING (project_id IN (
    SELECT id FROM projects WHERE created_by = auth.uid()::text
  ));

-- =============================================
-- Trigger — updated_at 자동 갱신
-- =============================================

CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_updated_at_trigger ON documents;
CREATE TRIGGER documents_updated_at_trigger
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- =============================================
-- 검증 query (수동 실행)
-- =============================================
-- SELECT * FROM documents LIMIT 1;
-- SELECT pg_size_pretty(pg_relation_size('documents'));
-- SELECT count(*) FROM documents WHERE jsonb_typeof(content) = 'object';
