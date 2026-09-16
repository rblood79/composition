package com.composition.upload.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import com.composition.upload.config.UploadProperties;
import com.composition.upload.service.UploadMetadataParser.UploadMetadata;

/**
 * 업로드 세션 흐름 — 생성 (P2·S3·S7) → PATCH 직렬화 (P4, {@code SELECT … FOR UPDATE} 안에서 디스크 쓰기 + MERGE)
 * → 완료 시 격리→스캔→승인 (S4) → 종료/GC (S7). 소유자 대조 (P3) 는 모든 조회 경로가 {@link #requireOwned} 를 지난다.
 */
public class UploadSessionService {

    private static final Log LOG = LogFactory.getLog(UploadSessionService.class);

    private final UploadProperties properties;
    private final UploadSessionRepository repository;
    private final UploadStorage storage;
    private final TransactionTemplate tx;
    private final UploadScanner scanner;
    private final AuditLog audit;

    public UploadSessionService(UploadProperties properties, UploadSessionRepository repository, UploadStorage storage,
                                TransactionTemplate tx, UploadScanner scanner, AuditLog audit) {
        this.properties = properties;
        this.repository = repository;
        this.storage = storage;
        this.tx = tx;
        this.scanner = scanner;
        this.audit = audit;
    }

    public UploadProperties getProperties() {
        return properties;
    }

    public UploadStorage getStorage() {
        return storage;
    }

    public Instant expiresFrom(Instant now) {
        return now.plusMillis(properties.getTtlMillis());
    }

    /** POST 생성. 예외: 400 (확장자·길이) · 413 (Tus-Max-Size) · 429 (quota). */
    public UploadSession create(String ownerId, UploadMetadata meta, long totalSize) {
        if (totalSize < 0) {
            throw new UploadException(400, "Upload-Length must be >= 0");
        }
        if (totalSize > properties.getMaxSize()) {
            throw new UploadException(413, "Upload-Length exceeds Tus-Max-Size")
                .withHeader("Tus-Max-Size", String.valueOf(properties.getMaxSize()));
        }
        if (!properties.isExtensionAllowed(meta.getExtension())) {
            throw new UploadException(400, "file extension is not allowed");
        }
        if (repository.countActiveByOwner(ownerId) >= properties.getMaxActivePerOwner()) {
            throw new UploadException(429, "too many active uploads for this owner");
        }
        String id = java.util.UUID.randomUUID().toString();
        Path path;
        try {
            path = storage.allocate(id);
        } catch (IOException e) {
            LOG.error("allocate failed for " + id, e);
            throw new UploadException(500, "storage unavailable");
        }
        Instant now = Instant.now();
        UploadStatus initial = totalSize == 0 ? UploadStatus.SCANNING : UploadStatus.CREATED;
        repository.insert(new UploadSession(id, ownerId, meta.getFileName(), meta.getFileType(), meta.getRelativePath(),
            totalSize, 0L, path.toString(), initial, now, expiresFrom(now)));
        audit.event("create", ownerId, id, meta.getFileName() + " size=" + totalSize);
        UploadSession created = repository.findById(id);
        return totalSize == 0 ? complete(created) : created;
    }

    /** 존재 + 소유자 + 만료 검사. 예외: 404 · 403 · 410. */
    public UploadSession requireOwned(String id, String ownerId) {
        UploadSession s = repository.findById(id);
        return checkOwned(s, id, ownerId, Instant.now());
    }

    private UploadSession checkOwned(UploadSession s, String id, String ownerId, Instant now) {
        if (s == null) {
            throw new UploadException(404, "upload not found");
        }
        if (!s.getOwnerId().equals(ownerId)) {
            audit.event("forbidden", ownerId, id, "owner mismatch");
            throw new UploadException(403, "upload belongs to another principal");
        }
        if (s.getStatus().isActive() && s.isExpired(now)) {
            throw new UploadException(410, "upload expired");
        }
        return s;
    }

    /**
     * PATCH — 행 잠금 안에서 offset 대조 (409) · 청크 상한/길이 초과 (413) · 디스크 쓰기 · checksum (460, 롤백) · MERGE.
     * 완료되면 트랜잭션 밖에서 {@link #complete}.
     */
    public UploadSession appendChunk(final String id, final String ownerId, final long clientOffset, final long length,
                                     final InputStream body, final String checksumHeader) {
        final Instant now = Instant.now();
        UploadSession updated = tx.execute(new TransactionCallback<UploadSession>() {
            @Override
            public UploadSession doInTransaction(TransactionStatus status) {
                UploadSession s = checkOwned(repository.lockById(id), id, ownerId, now);
                if (!s.getStatus().isActive()) {
                    throw new UploadException(409, "upload is already complete")
                        .withHeader("Upload-Offset", String.valueOf(s.getUploadOffset()));
                }
                if (clientOffset != s.getUploadOffset()) {
                    throw new UploadException(409, "Upload-Offset does not match the server offset")
                        .withHeader("Upload-Offset", String.valueOf(s.getUploadOffset()));
                }
                if (length > properties.getChunkMaxBytes()) {
                    throw new UploadException(413, "chunk exceeds upload.chunk.maxBytes");
                }
                if (clientOffset + length > s.getTotalSize()) {
                    throw new UploadException(413, "chunk would exceed Upload-Length");
                }
                Checksum expected = Checksum.parse(checksumHeader);
                UploadStorage.WriteResult wr;
                try {
                    wr = storage.write(id, clientOffset, body, length, expected == null ? null : expected.jcaName);
                } catch (UploadStorage.ShortBodyException e) {
                    throw new UploadException(400, "request body ended before Content-Length bytes");
                } catch (IOException e) {
                    LOG.error("write failed for " + id, e);
                    throw new UploadException(500, "storage write failed");
                }
                if (expected != null && !MessageDigest.isEqual(expected.digest, wr.getDigest())) {
                    throw new UploadException(460, "Upload-Checksum does not match the received chunk");
                }
                long newOffset = clientOffset + length;
                UploadStatus next = newOffset >= s.getTotalSize() ? UploadStatus.SCANNING : UploadStatus.UPLOADING;
                repository.mergeOffset(id, newOffset, next, expiresFrom(now));
                return repository.findById(id);
            }
        });
        if (updated != null && updated.getStatus() == UploadStatus.SCANNING) {
            return complete(updated);
        }
        return updated;
    }

    /** S4 — 매직바이트 대조 후 스캐너 판정. REJECTED 면 바이트 삭제, 행은 감사용으로 남긴다. */
    UploadSession complete(UploadSession s) {
        Path file = fileOf(s);
        UploadScanner.Verdict verdict;
        try {
            if (!MagicBytes.matches(FileNameValidator.extensionOf(s.getFileName()), file)) {
                verdict = UploadScanner.Verdict.REJECTED;
                audit.event("reject", s.getOwnerId(), s.getId(), "magic bytes mismatch for " + s.getFileName());
            } else {
                verdict = scanner.scan(s, file);
                if (verdict == UploadScanner.Verdict.REJECTED) {
                    audit.event("reject", s.getOwnerId(), s.getId(), "scanner rejected " + s.getFileName());
                }
            }
        } catch (Exception e) {
            LOG.warn("scan failed for " + s.getId() + " — treating as REJECTED", e);
            verdict = UploadScanner.Verdict.REJECTED;
        }
        if (verdict == UploadScanner.Verdict.REJECTED) {
            try {
                storage.delete(s.getId());
            } catch (IOException e) {
                LOG.warn("delete after reject failed for " + s.getId(), e);
            }
            repository.updateStatus(s.getId(), UploadStatus.REJECTED);
        } else {
            repository.updateStatus(s.getId(), UploadStatus.APPROVED);
            audit.event("approve", s.getOwnerId(), s.getId(), s.getFileName());
        }
        return repository.findById(s.getId());
    }

    /** DELETE (termination). */
    public void terminate(String id, String ownerId) {
        UploadSession s = requireOwned(id, ownerId);
        try {
            storage.delete(s.getId());
        } catch (IOException e) {
            LOG.warn("delete failed for " + id, e);
        }
        repository.delete(id);
        audit.event("terminate", ownerId, id, s.getFileName());
    }

    /** S7 — TTL GC. 만료된 활성 세션의 파일 + 행 삭제. 삭제한 세션 수를 돌려준다. */
    public int reapExpired(Instant now) {
        List<UploadSession> expired = repository.findExpired(now);
        int count = 0;
        for (UploadSession s : expired) {
            try {
                storage.delete(s.getId());
            } catch (IOException e) {
                LOG.warn("gc delete failed for " + s.getId(), e);
            }
            repository.delete(s.getId());
            audit.event("expire", s.getOwnerId(), s.getId(), s.getFileName());
            count++;
        }
        return count;
    }

    /** 다운로드 — APPROVED 만 (S4/S6). 그 외 상태는 404. */
    public UploadSession requireApproved(String id, String ownerId) {
        UploadSession s = requireOwned(id, ownerId);
        if (s.getStatus() != UploadStatus.APPROVED) {
            throw new UploadException(404, "file is not available");
        }
        return s;
    }

    public Path fileOf(UploadSession s) {
        Path stored = Paths.get(s.getStoragePath());
        Path expected = storage.pathFor(s.getId());
        // DB 의 경로가 저장 루트 밖을 가리키면 (조작·마이그레이션 오류) 루트 기준 경로만 신뢰한다
        return stored.equals(expected) ? stored : expected;
    }

    /** {@code Upload-Checksum: sha1 <base64>} 파싱 — 지원 안 하는 알고리즘·형식은 400. */
    static final class Checksum {
        final String jcaName;
        final byte[] digest;

        private Checksum(String jcaName, byte[] digest) {
            this.jcaName = jcaName;
            this.digest = digest;
        }

        static Checksum parse(String header) {
            if (header == null || header.trim().isEmpty()) {
                return null;
            }
            String[] parts = header.trim().split("\\s+");
            if (parts.length != 2) {
                throw new UploadException(400, "Upload-Checksum must be '<algorithm> <base64>'");
            }
            String algorithm = parts[0].toLowerCase(Locale.ROOT);
            String jca;
            if ("sha1".equals(algorithm)) {
                jca = "SHA-1";
            } else if ("sha256".equals(algorithm)) {
                jca = "SHA-256";
            } else {
                throw new UploadException(400, "unsupported checksum algorithm — see Tus-Checksum-Algorithm");
            }
            byte[] digest;
            try {
                digest = Base64.getDecoder().decode(parts[1]);
            } catch (IllegalArgumentException e) {
                throw new UploadException(400, "Upload-Checksum value is not base64");
            }
            return new Checksum(jca, digest);
        }
    }
}
