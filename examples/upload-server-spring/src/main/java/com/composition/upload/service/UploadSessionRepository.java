package com.composition.upload.service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/**
 * UPLOAD_SESSION 접근 — 전부 prepared statement ({@code ?} 바인딩, S8). SQL 은 Oracle 과 H2 (MODE=Oracle) 양쪽에서
 * 같은 문장이 돈다: {@code SELECT … FOR UPDATE} 로 PATCH 를 직렬화하고 offset 갱신은 표준 {@code MERGE … USING}.
 */
public class UploadSessionRepository {

    private static final String COLUMNS =
        "ID, OWNER_ID, FILE_NAME, FILE_TYPE, RELATIVE_PATH, TOTAL_SIZE, UPLOAD_OFFSET, STORAGE_PATH, STATUS, CREATED_AT, EXPIRES_AT";

    private static final String INSERT =
        "INSERT INTO UPLOAD_SESSION (" + COLUMNS + ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    private static final String SELECT_BY_ID =
        "SELECT " + COLUMNS + " FROM UPLOAD_SESSION WHERE ID = ?";
    private static final String SELECT_BY_ID_FOR_UPDATE = SELECT_BY_ID + " FOR UPDATE";
    private static final String MERGE_OFFSET =
        "MERGE INTO UPLOAD_SESSION T USING (SELECT CAST(? AS VARCHAR(36)) AS ID FROM DUAL) S ON (T.ID = S.ID)"
            + " WHEN MATCHED THEN UPDATE SET UPLOAD_OFFSET = ?, STATUS = ?, EXPIRES_AT = ?";
    private static final String UPDATE_STATUS =
        "UPDATE UPLOAD_SESSION SET STATUS = ? WHERE ID = ?";
    private static final String UPDATE_EXPIRES =
        "UPDATE UPLOAD_SESSION SET EXPIRES_AT = ? WHERE ID = ?";
    private static final String COUNT_ACTIVE =
        "SELECT COUNT(*) FROM UPLOAD_SESSION WHERE OWNER_ID = ? AND STATUS IN ('CREATED', 'UPLOADING')";
    private static final String SELECT_EXPIRED =
        "SELECT " + COLUMNS + " FROM UPLOAD_SESSION WHERE EXPIRES_AT < ? AND STATUS IN ('CREATED', 'UPLOADING')";
    private static final String DELETE =
        "DELETE FROM UPLOAD_SESSION WHERE ID = ?";

    private static final RowMapper<UploadSession> MAPPER = new RowMapper<UploadSession>() {
        @Override
        public UploadSession mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new UploadSession(
                rs.getString("ID"),
                rs.getString("OWNER_ID"),
                rs.getString("FILE_NAME"),
                rs.getString("FILE_TYPE"),
                rs.getString("RELATIVE_PATH"),
                rs.getLong("TOTAL_SIZE"),
                rs.getLong("UPLOAD_OFFSET"),
                rs.getString("STORAGE_PATH"),
                UploadStatus.valueOf(rs.getString("STATUS")),
                rs.getTimestamp("CREATED_AT").toInstant(),
                rs.getTimestamp("EXPIRES_AT").toInstant());
        }
    };

    private final JdbcTemplate jdbc;

    public UploadSessionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(UploadSession s) {
        jdbc.update(INSERT,
            s.getId(), s.getOwnerId(), s.getFileName(), s.getFileType(), s.getRelativePath(),
            s.getTotalSize(), s.getUploadOffset(), s.getStoragePath(), s.getStatus().name(),
            Timestamp.from(s.getCreatedAt()), Timestamp.from(s.getExpiresAt()));
    }

    /** 없으면 null. */
    public UploadSession findById(String id) {
        try {
            return jdbc.queryForObject(SELECT_BY_ID, MAPPER, id);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    /** 트랜잭션 안에서 행 잠금 — 같은 id 의 동시 PATCH 를 직렬화한다. 없으면 null. */
    public UploadSession lockById(String id) {
        try {
            return jdbc.queryForObject(SELECT_BY_ID_FOR_UPDATE, MAPPER, id);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    public void mergeOffset(String id, long newOffset, UploadStatus status, Instant expiresAt) {
        jdbc.update(MERGE_OFFSET, id, newOffset, status.name(), Timestamp.from(expiresAt));
    }

    public void updateStatus(String id, UploadStatus status) {
        jdbc.update(UPDATE_STATUS, status.name(), id);
    }

    /** 테스트·운영 도구용 — TTL 을 강제로 앞당긴다. */
    public void updateExpiresAt(String id, Instant expiresAt) {
        jdbc.update(UPDATE_EXPIRES, Timestamp.from(expiresAt), id);
    }

    public int countActiveByOwner(String ownerId) {
        Integer n = jdbc.queryForObject(COUNT_ACTIVE, Integer.class, ownerId);
        return n == null ? 0 : n.intValue();
    }

    public List<UploadSession> findExpired(Instant now) {
        return jdbc.query(SELECT_EXPIRED, MAPPER, Timestamp.from(now));
    }

    public void delete(String id) {
        jdbc.update(DELETE, id);
    }
}
