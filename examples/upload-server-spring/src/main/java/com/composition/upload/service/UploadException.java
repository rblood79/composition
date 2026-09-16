package com.composition.upload.service;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 계약 응답 코드를 실은 예외 — 웹 층 ({@code TusExceptionHandler}) 이 그대로 HTTP 상태로 바꾼다.
 * 메시지는 클라이언트에 나가므로 저장 경로·스택·내부 호스트명을 담지 않는다 (S10).
 */
public class UploadException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final int status;
    private final Map<String, String> headers = new LinkedHashMap<String, String>();

    public UploadException(int status, String message) {
        super(message);
        this.status = status;
    }

    public UploadException withHeader(String name, String value) {
        headers.put(name, value);
        return this;
    }

    public int getStatus() {
        return status;
    }

    public Map<String, String> getHeaders() {
        return Collections.unmodifiableMap(headers);
    }
}
