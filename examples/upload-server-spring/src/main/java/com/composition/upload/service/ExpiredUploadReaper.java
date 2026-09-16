package com.composition.upload.service;

import java.time.Instant;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * S7 — TTL GC. {@code @EnableScheduling} (UploadWebConfig) 이 켜진 컨텍스트에서 {@code upload.gcIntervalMillis}
 * 주기로 {@link UploadSessionService#reapExpired}. Boot 없이 Spring 의 기본 단일 스레드 스케줄러로 동작한다.
 * 테스트·운영 도구는 {@link #reap()} 을 직접 호출한다.
 */
public class ExpiredUploadReaper {

    private static final Log LOG = LogFactory.getLog(ExpiredUploadReaper.class);

    private final UploadSessionService service;

    public ExpiredUploadReaper(UploadSessionService service) {
        this.service = service;
    }

    @Scheduled(fixedDelayString = "${upload.gcIntervalMillis:600000}", initialDelayString = "${upload.gcIntervalMillis:600000}")
    public int reap() {
        int n = service.reapExpired(Instant.now());
        if (n > 0) {
            LOG.info("expired uploads removed: " + n);
        }
        return n;
    }
}
