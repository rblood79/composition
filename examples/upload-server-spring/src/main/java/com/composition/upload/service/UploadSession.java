package com.composition.upload.service;

import java.time.Instant;

/** UPLOAD_SESSION 한 행. 불변 값 객체 — 갱신은 repository 가 새 인스턴스를 읽어 온다. */
public final class UploadSession {

    private final String id;
    private final String ownerId;
    private final String fileName;
    private final String fileType;
    private final String relativePath;
    private final long totalSize;
    private final long uploadOffset;
    private final String storagePath;
    private final UploadStatus status;
    private final Instant createdAt;
    private final Instant expiresAt;

    public UploadSession(String id, String ownerId, String fileName, String fileType, String relativePath,
                         long totalSize, long uploadOffset, String storagePath, UploadStatus status,
                         Instant createdAt, Instant expiresAt) {
        this.id = id;
        this.ownerId = ownerId;
        this.fileName = fileName;
        this.fileType = fileType;
        this.relativePath = relativePath;
        this.totalSize = totalSize;
        this.uploadOffset = uploadOffset;
        this.storagePath = storagePath;
        this.status = status;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    public String getId() {
        return id;
    }

    public String getOwnerId() {
        return ownerId;
    }

    public String getFileName() {
        return fileName;
    }

    public String getFileType() {
        return fileType;
    }

    public String getRelativePath() {
        return relativePath;
    }

    public long getTotalSize() {
        return totalSize;
    }

    public long getUploadOffset() {
        return uploadOffset;
    }

    public String getStoragePath() {
        return storagePath;
    }

    public UploadStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public boolean isExpired(Instant now) {
        return expiresAt.isBefore(now);
    }

    public boolean isComplete() {
        return uploadOffset >= totalSize;
    }
}
