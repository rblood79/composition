package com.composition.upload.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import javax.annotation.PostConstruct;
import javax.servlet.ServletContext;

/**
 * S1 — 저장 디렉터리가 웹루트 ({@code ServletContext.getRealPath("/")}) 하위면 ApplicationContext 기동을 실패시킨다.
 *
 * <p>Tomcat {@code webapps/} 안에 업로드 파일이 놓이면 JSP 로 실행되거나 정적 리소스로 서빙된다 (RCE). 그래서
 * 설정 오류를 경고로 남기지 않고 기동 자체를 막는다 — 예외 메시지에 두 경로와 사유를 싣는다.
 */
public class StorageDirectoryValidator {

    private final UploadProperties properties;
    private final ServletContext servletContext;

    public StorageDirectoryValidator(UploadProperties properties, ServletContext servletContext) {
        this.properties = properties;
        this.servletContext = servletContext;
    }

    @PostConstruct
    public void validate() {
        String configured = properties.getStorageDir();
        if (configured == null || configured.trim().isEmpty()) {
            throw new IllegalStateException("upload.storage.dir is required (ADR-201 S1: file bytes must live outside the web root)");
        }
        Path storage = Paths.get(configured).toAbsolutePath().normalize();
        try {
            Files.createDirectories(storage);
            storage = storage.toRealPath();
        } catch (IOException e) {
            throw new IllegalStateException("upload.storage.dir is not writable: " + storage, e);
        }
        if (!Files.isWritable(storage)) {
            throw new IllegalStateException("upload.storage.dir is not writable: " + storage);
        }

        String realRoot = servletContext == null ? null : servletContext.getRealPath("/");
        if (realRoot != null) {
            Path webroot = Paths.get(realRoot).toAbsolutePath().normalize();
            try {
                if (Files.exists(webroot)) {
                    webroot = webroot.toRealPath();
                }
            } catch (IOException ignored) {
                // 실경로 해석 실패 시 normalize 결과로 비교한다
            }
            if (storage.startsWith(webroot)) {
                throw new IllegalStateException(
                    "upload.storage.dir must be outside the web root (ADR-201 S1). storage=" + storage
                        + " webroot=" + webroot
                        + " — files under the web root can be served as static resources or executed as JSP."
                        + " Move upload.storage.dir to a directory outside " + webroot + ".");
            }
        }
    }

    /** 검증을 통과한 절대 저장 경로. */
    public Path storagePath() {
        return Paths.get(properties.getStorageDir()).toAbsolutePath().normalize();
    }
}
