package com.composition.upload.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * S3 — 완료 후 매직바이트 대조. 확장자에 알려진 서명이 있으면 파일 선두와 비교하고, 하나도 맞지 않으면 REJECTED.
 * 서명이 없는 확장자 (txt/csv/json) 는 통과. 브라우저가 보낸 filetype 은 여기서 쓰지 않는다 (신뢰하지 않음).
 */
public final class MagicBytes {

    private static final int HEAD_LENGTH = 16;

    private static final byte[] PNG = { (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
    private static final byte[] JPEG = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF };
    private static final byte[] GIF87 = ascii("GIF87a");
    private static final byte[] GIF89 = ascii("GIF89a");
    private static final byte[] PDF = ascii("%PDF");
    private static final byte[] ZIP = { 0x50, 0x4B, 0x03, 0x04 };
    private static final byte[] ZIP_EMPTY = { 0x50, 0x4B, 0x05, 0x06 };
    private static final byte[] ZIP_SPANNED = { 0x50, 0x4B, 0x07, 0x08 };
    private static final byte[] OLE = { (byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0, (byte) 0xA1, (byte) 0xB1, 0x1A, (byte) 0xE1 };

    private static final Map<String, List<byte[]>> SIGNATURES;
    private static final Map<String, String> MIME;

    static {
        Map<String, List<byte[]>> s = new HashMap<String, List<byte[]>>();
        s.put("png", Collections.singletonList(PNG));
        s.put("jpg", Collections.singletonList(JPEG));
        s.put("jpeg", Collections.singletonList(JPEG));
        s.put("gif", Arrays.asList(GIF87, GIF89));
        s.put("pdf", Collections.singletonList(PDF));
        List<byte[]> zip = Arrays.asList(ZIP, ZIP_EMPTY, ZIP_SPANNED);
        s.put("zip", zip);
        s.put("xlsx", zip);
        s.put("docx", zip);
        s.put("pptx", zip);
        s.put("hwpx", zip);
        s.put("hwp", Collections.singletonList(OLE));
        SIGNATURES = Collections.unmodifiableMap(s);

        Map<String, String> m = new HashMap<String, String>();
        m.put("png", "image/png");
        m.put("jpg", "image/jpeg");
        m.put("jpeg", "image/jpeg");
        m.put("gif", "image/gif");
        m.put("pdf", "application/pdf");
        m.put("zip", "application/zip");
        MIME = Collections.unmodifiableMap(m);
    }

    private MagicBytes() {
    }

    /** 확장자에 서명이 없으면 true (판정 불가 = 통과). 있으면 파일 선두와 대조. */
    public static boolean matches(String extension, Path file) throws IOException {
        List<byte[]> candidates = SIGNATURES.get(extension);
        if (candidates == null) {
            return true;
        }
        byte[] head = readHead(file);
        for (byte[] signature : candidates) {
            if (startsWith(head, signature)) {
                return true;
            }
        }
        return false;
    }

    /** 다운로드 Content-Type — 서명으로 확인된 타입만 구체값, 나머지는 octet-stream (S6). */
    public static String contentTypeFor(String extension, Path file) throws IOException {
        String mime = MIME.get(extension);
        if (mime == null) {
            return "application/octet-stream";
        }
        return matches(extension, file) ? mime : "application/octet-stream";
    }

    private static byte[] readHead(Path file) throws IOException {
        byte[] buf = new byte[HEAD_LENGTH];
        int total = 0;
        InputStream in = Files.newInputStream(file);
        try {
            while (total < buf.length) {
                int n = in.read(buf, total, buf.length - total);
                if (n < 0) {
                    break;
                }
                total += n;
            }
        } finally {
            in.close();
        }
        return Arrays.copyOf(buf, total);
    }

    private static boolean startsWith(byte[] head, byte[] signature) {
        if (head.length < signature.length) {
            return false;
        }
        for (int i = 0; i < signature.length; i++) {
            if (head[i] != signature[i]) {
                return false;
            }
        }
        return true;
    }

    private static byte[] ascii(String s) {
        byte[] out = new byte[s.length()];
        for (int i = 0; i < s.length(); i++) {
            out[i] = (byte) s.charAt(i);
        }
        return out;
    }
}
