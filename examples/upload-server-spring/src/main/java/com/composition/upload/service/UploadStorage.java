package com.composition.upload.service;

import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.regex.Pattern;

/**
 * 디스크 저장 — 파일명은 UUID (S2), 디렉터리는 {@link com.composition.upload.config.StorageDirectoryValidator} 가
 * 웹루트 밖임을 보장한 경로 (S1). PATCH 청크는 {@code RandomAccessFile.seek(offset)} 뒤 1회 순차 쓰기 — 병합 단계 0.
 */
public class UploadStorage {

    private static final Pattern UUID_V4 = Pattern.compile(
        "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$");
    private static final int BUFFER = 64 * 1024;

    private final Path root;

    public UploadStorage(Path root) {
        this.root = root;
    }

    public Path getRoot() {
        return root;
    }

    /** 저장 경로 = root/{uuid}. id 형식이 UUIDv4 가 아니면 예외 — 사용자 입력이 경로에 닿지 못하게 한다. */
    public Path pathFor(String uploadId) {
        if (uploadId == null || !UUID_V4.matcher(uploadId).matches()) {
            throw new IllegalArgumentException("upload id is not a UUIDv4");
        }
        Path p = root.resolve(uploadId).normalize();
        if (!p.getParent().equals(root)) {
            throw new IllegalArgumentException("resolved path escaped the storage root");
        }
        return p;
    }

    /** POST 생성 시 빈 파일. */
    public Path allocate(String uploadId) throws IOException {
        Path p = pathFor(uploadId);
        Files.createDirectories(root);
        Files.createFile(p);
        return p;
    }

    /** 청크 쓰기 결과 — 실제 쓴 바이트 수와 (요청 시) digest. */
    public static final class WriteResult {
        private final long bytesWritten;
        private final byte[] digest;

        WriteResult(long bytesWritten, byte[] digest) {
            this.bytesWritten = bytesWritten;
            this.digest = digest;
        }

        public long getBytesWritten() {
            return bytesWritten;
        }

        public byte[] getDigest() {
            return digest;
        }

        public String getDigestBase64() {
            return digest == null ? null : Base64.getEncoder().encodeToString(digest);
        }
    }

    /**
     * {@code offset} 에 정확히 {@code length} 바이트를 쓴다. 스트림이 먼저 끝나면 {@link ShortBodyException}.
     * {@code algorithm} (JCA 이름, 예 "SHA-1") 이 있으면 쓰면서 digest 를 계산한다 — 파일 전체 해시 0, 청크 해시만.
     */
    public WriteResult write(String uploadId, long offset, InputStream body, long length, String algorithm)
        throws IOException {
        Path p = pathFor(uploadId);
        MessageDigest digest = null;
        if (algorithm != null) {
            try {
                digest = MessageDigest.getInstance(algorithm);
            } catch (NoSuchAlgorithmException e) {
                throw new IllegalArgumentException("unsupported checksum algorithm: " + algorithm);
            }
        }
        byte[] buf = new byte[BUFFER];
        long remaining = length;
        RandomAccessFile raf = new RandomAccessFile(p.toFile(), "rw");
        try {
            raf.seek(offset);
            while (remaining > 0) {
                int want = (int) Math.min(buf.length, remaining);
                int n = body.read(buf, 0, want);
                if (n < 0) {
                    throw new ShortBodyException(length - remaining, length);
                }
                raf.write(buf, 0, n);
                if (digest != null) {
                    digest.update(buf, 0, n);
                }
                remaining -= n;
            }
        } finally {
            raf.close();
        }
        return new WriteResult(length, digest == null ? null : digest.digest());
    }

    public void delete(String uploadId) throws IOException {
        Files.deleteIfExists(pathFor(uploadId));
    }

    public boolean exists(String uploadId) {
        return Files.exists(pathFor(uploadId));
    }

    /** Content-Length 보다 body 가 짧게 끝났다 (클라이언트 중단). */
    public static final class ShortBodyException extends IOException {
        private static final long serialVersionUID = 1L;
        private final long received;
        private final long expected;

        public ShortBodyException(long received, long expected) {
            super("request body ended after " + received + " of " + expected + " bytes");
            this.received = received;
            this.expected = expected;
        }

        public long getReceived() {
            return received;
        }

        public long getExpected() {
            return expected;
        }
    }
}
