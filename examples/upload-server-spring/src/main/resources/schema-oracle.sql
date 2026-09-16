-- ADR-201 참조 서버 메타 테이블 — Oracle (DBA 가 1회 실행. 애플리케이션은 upload.jdbc.initSchema=none)
-- 파일 바이트는 디스크 (upload.storage.dir, UUID 파일명). 이 표는 세션 메타만 담는다.
-- 원본 파일명(FILE_NAME)·RELATIVE_PATH 는 여기에만 저장되고 디스크 경로에는 쓰이지 않는다 (S2).

CREATE TABLE UPLOAD_SESSION (
  ID             VARCHAR2(36)   NOT NULL,          -- UUIDv4 (서버 생성, 추측 불가)
  OWNER_ID       VARCHAR2(128)  NOT NULL,          -- 세션 principal (소유자 바인딩, P3)
  FILE_NAME      VARCHAR2(255)  NOT NULL,          -- Upload-Metadata filename (검증 통과, NFC)
  FILE_TYPE      VARCHAR2(255),                    -- Upload-Metadata filetype (브라우저 보고값, 신뢰하지 않음)
  RELATIVE_PATH  VARCHAR2(1024),                   -- Upload-Metadata relativePath (폴더 업로드)
  TOTAL_SIZE     NUMBER(19)     NOT NULL,          -- Upload-Length
  UPLOAD_OFFSET  NUMBER(19)     DEFAULT 0 NOT NULL,-- 서버 offset (진실)
  STORAGE_PATH   VARCHAR2(1024) NOT NULL,          -- 디스크 절대 경로 (UUID 파일명)
  STATUS         VARCHAR2(16)   NOT NULL,          -- CREATED | UPLOADING | SCANNING | APPROVED | REJECTED
  CREATED_AT     TIMESTAMP      NOT NULL,
  EXPIRES_AT     TIMESTAMP      NOT NULL,          -- 마지막 PATCH + TTL. 경과 시 410, GC 가 삭제
  CONSTRAINT PK_UPLOAD_SESSION PRIMARY KEY (ID)
);

CREATE INDEX IX_UPLOAD_SESSION_OWNER   ON UPLOAD_SESSION (OWNER_ID, STATUS);
CREATE INDEX IX_UPLOAD_SESSION_EXPIRES ON UPLOAD_SESSION (EXPIRES_AT, STATUS);
