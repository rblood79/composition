package com.composition.upload.service;

import java.nio.file.Path;

/** 참조 구현 스캐너 — 항상 APPROVED. 운영은 AV 연동 구현으로 교체한다 (UploadCoreConfig#uploadScanner). */
public class NoOpUploadScanner implements UploadScanner {

    @Override
    public Verdict scan(UploadSession session, Path file) {
        return Verdict.APPROVED;
    }
}
