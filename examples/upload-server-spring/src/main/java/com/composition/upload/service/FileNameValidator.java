package com.composition.upload.service;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 계약 §3-1 — Upload-Metadata filename / relativePath 검증 12 규칙 (P1).
 *
 * <p>검증을 통과한 이름도 디스크 경로에는 쓰이지 않는다 (S2 — 저장 파일명은 UUID). 이 클래스는 방어 심층이다.
 * 실패는 {@link ValidationException} 으로 알리고 호출자가 400 으로 바꾼다.
 */
public final class FileNameValidator {

    public static final int MAX_NAME_LENGTH = 255;
    public static final int MAX_RELATIVE_PATH_LENGTH = 1024;

    private static final Pattern WINDOWS_RESERVED = Pattern.compile(
        "^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\\..*)?$", Pattern.CASE_INSENSITIVE);
    private static final Pattern DRIVE_LETTER = Pattern.compile("^[A-Za-z]:.*");
    private static final Pattern PERCENT_ENCODED_SEPARATOR = Pattern.compile(
        "%(2f|5c|00|2e%2e)", Pattern.CASE_INSENSITIVE);

    private FileNameValidator() {
    }

    /** 검증 실패 — 메시지는 클라이언트에 그대로 나간다 (경로·내부 정보 0). */
    public static final class ValidationException extends RuntimeException {
        private static final long serialVersionUID = 1L;

        public ValidationException(String message) {
            super(message);
        }
    }

    /** filename 검증 후 NFC 정규화된 이름을 돌려준다. */
    public static String validateFileName(String raw) {
        String name = normalize(raw, "filename");
        if (name.indexOf('/') >= 0 || name.indexOf('\\') >= 0) {
            throw new ValidationException("filename must not contain path separators");
        }
        validateSegment(name, "filename");
        return name;
    }

    /**
     * relativePath 검증 (폴더 업로드). {@code /} 로 나눈 각 세그먼트에 같은 규칙, 전체 길이 ≤ 1024. 빈 값은 허용 (null 반환).
     */
    public static String validateRelativePath(String raw) {
        if (raw == null || raw.isEmpty()) {
            return null;
        }
        String path = normalize(raw, "relativePath");
        if (path.length() > MAX_RELATIVE_PATH_LENGTH) {
            throw new ValidationException("relativePath exceeds " + MAX_RELATIVE_PATH_LENGTH + " characters");
        }
        if (path.indexOf('\\') >= 0) {
            throw new ValidationException("relativePath must use '/' as the only separator");
        }
        if (path.startsWith("/")) {
            throw new ValidationException("relativePath must be relative");
        }
        String[] segments = path.split("/", -1);
        for (String segment : segments) {
            validateSegment(segment, "relativePath segment");
        }
        return path;
    }

    /** 확장자 (소문자, 점 없음). 없으면 빈 문자열. */
    public static String extensionOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        if (dot < 0 || dot == fileName.length() - 1) {
            return "";
        }
        return fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static String normalize(String raw, String what) {
        if (raw == null || raw.isEmpty()) {
            throw new ValidationException(what + " is required");
        }
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (c == 0) {
                throw new ValidationException(what + " contains a null byte");
            }
            if (c == '\r' || c == '\n') {
                throw new ValidationException(what + " contains CR/LF");
            }
            if (c < 0x20 || c == 0x7f) {
                throw new ValidationException(what + " contains a control character");
            }
        }
        return Normalizer.normalize(raw, Normalizer.Form.NFC);
    }

    /** 규칙 5~12 — 분리자를 뺀 한 세그먼트에 적용. */
    private static void validateSegment(String segment, String what) {
        if (segment.isEmpty()) {
            throw new ValidationException(what + " has an empty segment");
        }
        if (".".equals(segment) || "..".equals(segment)) {
            throw new ValidationException(what + " must not be '.' or '..'");
        }
        if (segment.startsWith("/") || segment.startsWith("\\") || segment.startsWith("\\\\")
            || DRIVE_LETTER.matcher(segment).matches()) {
            throw new ValidationException(what + " must not be an absolute path");
        }
        if (PERCENT_ENCODED_SEPARATOR.matcher(segment).find()) {
            throw new ValidationException(what + " contains a percent-encoded separator");
        }
        if (segment.indexOf('／') >= 0 || segment.indexOf('＼') >= 0) {
            throw new ValidationException(what + " contains a full-width path separator");
        }
        if (WINDOWS_RESERVED.matcher(segment).matches()) {
            throw new ValidationException(what + " is a reserved device name");
        }
        if (segment.startsWith(" ") || segment.endsWith(" ") || segment.endsWith(".")) {
            throw new ValidationException(what + " must not start or end with a space or end with a dot");
        }
        if (segment.length() > MAX_NAME_LENGTH
            || segment.getBytes(StandardCharsets.UTF_8).length > MAX_NAME_LENGTH) {
            throw new ValidationException(what + " exceeds " + MAX_NAME_LENGTH + " characters/bytes");
        }
    }
}
