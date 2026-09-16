package com.composition.upload.config;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

/**
 * 참조 서버 설정 값 — upload.properties (docs/reference/upload/server-contract.md §6 knob 표).
 *
 * <p>Boot 의 {@code @ConfigurationProperties} 없이 쓰기 위해 평범한 POJO 로 둔다. 운영은
 * {@link UploadWebConfig} 가 Spring Environment 에서 채우고, 테스트는 직접 생성한다.
 */
public class UploadProperties {

    private String storageDir;
    private long maxSize = 10L * 1024 * 1024 * 1024;
    private long chunkMaxBytes = 64L * 1024 * 1024;
    private long ttlHours = 24L;
    private int maxActivePerOwner = 10;
    private Set<String> allowedExtensions = Collections.emptySet();
    private Set<String> corsAllowedOrigins = Collections.emptySet();
    private boolean devLoginEnabled = false;

    public String getStorageDir() {
        return storageDir;
    }

    public void setStorageDir(String storageDir) {
        this.storageDir = storageDir;
    }

    /** Tus-Max-Size (바이트). */
    public long getMaxSize() {
        return maxSize;
    }

    public void setMaxSize(long maxSize) {
        this.maxSize = maxSize;
    }

    /** PATCH 1회 상한 (바이트). */
    public long getChunkMaxBytes() {
        return chunkMaxBytes;
    }

    public void setChunkMaxBytes(long chunkMaxBytes) {
        this.chunkMaxBytes = chunkMaxBytes;
    }

    public long getTtlHours() {
        return ttlHours;
    }

    public void setTtlHours(long ttlHours) {
        this.ttlHours = ttlHours;
    }

    public long getTtlMillis() {
        return ttlHours * 3600L * 1000L;
    }

    public int getMaxActivePerOwner() {
        return maxActivePerOwner;
    }

    public void setMaxActivePerOwner(int maxActivePerOwner) {
        this.maxActivePerOwner = maxActivePerOwner;
    }

    public Set<String> getAllowedExtensions() {
        return allowedExtensions;
    }

    /** 쉼표 구분 문자열 → 소문자 집합. */
    public void setAllowedExtensions(String csv) {
        this.allowedExtensions = csvToSet(csv, true);
    }

    public void setAllowedExtensions(Set<String> extensions) {
        this.allowedExtensions = Collections.unmodifiableSet(new LinkedHashSet<String>(extensions));
    }

    /** 확장자 (소문자, 점 없음) 가 화이트리스트에 있는가. 빈 확장자는 항상 거부. */
    public boolean isExtensionAllowed(String extension) {
        if (extension == null || extension.isEmpty()) {
            return false;
        }
        return allowedExtensions.contains(extension.toLowerCase(Locale.ROOT));
    }

    public Set<String> getCorsAllowedOrigins() {
        return corsAllowedOrigins;
    }

    public void setCorsAllowedOrigins(String csv) {
        this.corsAllowedOrigins = csvToSet(csv, false);
    }

    public boolean isDevLoginEnabled() {
        return devLoginEnabled;
    }

    public void setDevLoginEnabled(boolean devLoginEnabled) {
        this.devLoginEnabled = devLoginEnabled;
    }

    private static Set<String> csvToSet(String csv, boolean lowerCase) {
        if (csv == null || csv.trim().isEmpty()) {
            return Collections.emptySet();
        }
        Set<String> out = new LinkedHashSet<String>();
        for (String raw : Arrays.asList(csv.split(","))) {
            String v = raw.trim();
            if (v.isEmpty()) {
                continue;
            }
            out.add(lowerCase ? v.toLowerCase(Locale.ROOT) : v);
        }
        return Collections.unmodifiableSet(out);
    }
}
