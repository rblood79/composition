package com.composition.upload.service;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 계약 §3 — {@code Upload-Metadata: key base64(value),key2 base64(value2),key3} 파싱 + 검증 (P1).
 *
 * <p>base64 는 표준 알파벳 (패딩 포함), 값은 UTF-8 (malformed 는 거부). filename 필수. filetype 은 MIME 형식만.
 */
public class UploadMetadataParser {

    private static final Pattern KEY = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");
    private static final Pattern MIME = Pattern.compile("^[A-Za-z0-9!#$&^_.+-]{1,127}/[A-Za-z0-9!#$&^_.+-]{1,127}$");

    /** 파싱·검증을 통과한 값. relativePath/fileType 은 null 가능. */
    public static final class UploadMetadata {
        private final String fileName;
        private final String fileType;
        private final String relativePath;

        public UploadMetadata(String fileName, String fileType, String relativePath) {
            this.fileName = fileName;
            this.fileType = fileType;
            this.relativePath = relativePath;
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

        public String getExtension() {
            return FileNameValidator.extensionOf(fileName);
        }
    }

    public UploadMetadata parse(String header) {
        if (header == null || header.trim().isEmpty()) {
            throw new FileNameValidator.ValidationException("Upload-Metadata with filename is required");
        }
        Map<String, String> pairs = new HashMap<String, String>();
        for (String rawPair : header.split(",")) {
            String pair = rawPair.trim();
            if (pair.isEmpty()) {
                continue;
            }
            int space = pair.indexOf(' ');
            String key = space < 0 ? pair : pair.substring(0, space);
            String encoded = space < 0 ? "" : pair.substring(space + 1).trim();
            if (!KEY.matcher(key).matches()) {
                throw new FileNameValidator.ValidationException("Upload-Metadata key is invalid");
            }
            if (pairs.containsKey(key)) {
                throw new FileNameValidator.ValidationException("Upload-Metadata key is duplicated: " + key);
            }
            pairs.put(key, decode(encoded, key));
        }
        String fileName = FileNameValidator.validateFileName(pairs.get("filename"));
        String relativePath = FileNameValidator.validateRelativePath(pairs.get("relativePath"));
        String fileType = pairs.get("filetype");
        if (fileType != null && !fileType.isEmpty() && !MIME.matcher(fileType).matches()) {
            throw new FileNameValidator.ValidationException("Upload-Metadata filetype is not a MIME type");
        }
        return new UploadMetadata(fileName, fileType == null || fileType.isEmpty() ? null : fileType, relativePath);
    }

    /** HEAD 응답 echo 용 재인코딩. */
    public static String encode(UploadSession session) {
        StringBuilder sb = new StringBuilder();
        sb.append("filename ").append(b64(session.getFileName()));
        if (session.getFileType() != null) {
            sb.append(",filetype ").append(b64(session.getFileType()));
        }
        if (session.getRelativePath() != null) {
            sb.append(",relativePath ").append(b64(session.getRelativePath()));
        }
        return sb.toString();
    }

    private static String b64(String value) {
        return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String decode(String encoded, String key) {
        if (encoded.isEmpty()) {
            return "";
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException e) {
            throw new FileNameValidator.ValidationException("Upload-Metadata value is not base64: " + key);
        }
        try {
            return StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes))
                .toString();
        } catch (CharacterCodingException e) {
            throw new FileNameValidator.ValidationException("Upload-Metadata value is not UTF-8: " + key);
        }
    }
}
