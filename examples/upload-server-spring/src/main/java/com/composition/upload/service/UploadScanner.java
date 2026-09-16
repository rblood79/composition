package com.composition.upload.service;

import java.nio.file.Path;

/**
 * S4 — 완료 후 격리 → 스캔 → 승인 훅. 완료된 파일은 {@code SCANNING} 상태로 두고 이 훅의 판정으로
 * {@code APPROVED}/{@code REJECTED} 가 된다. AV 엔진 (ClamAV 등) 연동은 이 인터페이스 구현 1개로 끝난다.
 */
public interface UploadScanner {

    enum Verdict {
        APPROVED,
        REJECTED
    }

    /** 파일 전체를 읽어도 되는 유일한 지점. 예외는 REJECTED 로 취급된다. */
    Verdict scan(UploadSession session, Path file) throws Exception;
}
