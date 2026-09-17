package com.composition.upload.web;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/** TUS 1.0 헤더 이름·상수 (계약 §1·§2·§5). */
public final class TusHeaders {

    public static final String TUS_VERSION = "1.0.0";
    public static final String TUS_EXTENSIONS = "creation,expiration,termination,checksum";
    public static final String TUS_CHECKSUM_ALGORITHMS = "sha1,sha256";
    public static final String OFFSET_CONTENT_TYPE = "application/offset+octet-stream";

    public static final String TUS_RESUMABLE = "Tus-Resumable";
    public static final String TUS_VERSION_HEADER = "Tus-Version";
    public static final String TUS_EXTENSION = "Tus-Extension";
    public static final String TUS_MAX_SIZE = "Tus-Max-Size";
    public static final String TUS_CHECKSUM_ALGORITHM = "Tus-Checksum-Algorithm";
    public static final String UPLOAD_LENGTH = "Upload-Length";
    public static final String UPLOAD_OFFSET = "Upload-Offset";
    public static final String UPLOAD_METADATA = "Upload-Metadata";
    public static final String UPLOAD_EXPIRES = "Upload-Expires";
    public static final String UPLOAD_CHECKSUM = "Upload-Checksum";
    public static final String UPLOAD_DEFER_LENGTH = "Upload-Defer-Length";
    public static final String METHOD_OVERRIDE = "X-HTTP-Method-Override";
    public static final String CSRF_TOKEN = "X-CSRF-TOKEN";
    /** 브라우저 클라이언트가 읽는 CSRF 토큰 쿠키 (Spring Security CookieCsrfTokenRepository 관례, HttpOnly 아님). */
    public static final String CSRF_COOKIE = "XSRF-TOKEN";

    /** §5 — CORS pre-flight 허용 요청 헤더. */
    public static final String[] CORS_ALLOWED_HEADERS = {
        TUS_RESUMABLE, UPLOAD_LENGTH, UPLOAD_OFFSET, UPLOAD_METADATA, UPLOAD_CHECKSUM,
        "Content-Type", METHOD_OVERRIDE, CSRF_TOKEN
    };

    /** §5 — 이게 빠지면 클라이언트가 Upload-Offset / Location 을 못 읽어 재개가 불가능하다. */
    public static final String[] CORS_EXPOSED_HEADERS = {
        UPLOAD_OFFSET, "Location", UPLOAD_LENGTH, UPLOAD_EXPIRES, TUS_RESUMABLE,
        TUS_EXTENSION, TUS_MAX_SIZE, TUS_CHECKSUM_ALGORITHM
    };

    private static final DateTimeFormatter RFC_7231 = DateTimeFormatter.RFC_1123_DATE_TIME;

    private TusHeaders() {
    }

    /** {@code Upload-Expires} — RFC 7231 HTTP-date (예 {@code Thu, 18 Sep 2026 09:00:00 GMT}). */
    public static String httpDate(Instant instant) {
        return RFC_7231.format(instant.atOffset(ZoneOffset.UTC));
    }
}
