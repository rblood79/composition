package com.composition.upload.service;

/** UPLOAD_SESSION.STATUS — 격리 → 스캔 → 승인 (S4). 다운로드는 APPROVED 만. */
public enum UploadStatus {
    CREATED,
    UPLOADING,
    SCANNING,
    APPROVED,
    REJECTED;

    /** TTL GC 대상 (아직 바이트를 받는 중). */
    public boolean isActive() {
        return this == CREATED || this == UPLOADING;
    }
}
