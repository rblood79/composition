package com.composition.upload.service;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;

/**
 * S9 — 감사 로그. 생성/완료/거부/삭제/403 을 principal · id · 원본명과 남긴다. 사용자 입력 값은
 * {@link #sanitize(String)} 로 CR/LF·제어 문자를 지운 뒤 기록한다 (로그 주입 차단).
 * 로깅 구현은 spring-jcl 이 고른다 (log4j2/slf4j 가 classpath 에 없으면 java.util.logging).
 */
public class AuditLog {

    private static final Log LOG = LogFactory.getLog("composition.upload.audit");

    public void event(String action, String ownerId, String uploadId, String detail) {
        LOG.info("action=" + sanitize(action)
            + " owner=" + sanitize(ownerId)
            + " upload=" + sanitize(uploadId)
            + (detail == null ? "" : " detail=" + sanitize(detail)));
    }

    /** CR/LF 와 0x20 미만·0x7f 제어 문자를 '_' 로 바꾼다. null 은 "-". */
    public static String sanitize(String value) {
        if (value == null) {
            return "-";
        }
        StringBuilder sb = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '\r' || c == '\n' || c < 0x20 || c == 0x7f) {
                sb.append('_');
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }
}
