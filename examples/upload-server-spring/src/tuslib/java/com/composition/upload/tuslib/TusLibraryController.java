package com.composition.upload.tuslib;

import java.io.IOException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

import com.composition.upload.config.StorageDirectoryValidator;
import com.composition.upload.config.UploadProperties;
import com.composition.upload.service.OwnerResolver;
import com.composition.upload.service.UploadException;

import me.desair.tus.server.TusFileUploadService;
import me.desair.tus.server.exception.TusException;

/**
 * 변형 ② — tus-java-server 라이브러리 위임 (스켈레톤). Maven 프로파일 {@code tus-lib} 로만 컴파일된다
 * ({@code mvn -P tus-lib ...}) — 기본 빌드는 이 소스 루트를 포함하지 않는다.
 *
 * <p>라이브러리가 프로토콜 (core/creation/expiration/termination/checksum/concatenation) 을 처리하고 이 클래스는
 * 소유자 확인 (P3) 과 저장 경로 (S1 — 같은 {@link StorageDirectoryValidator}) 만 붙인다. CSRF (P5) 와 override (§4)
 * 는 변형 ① 과 같은 필터가 {@code /tus-lib/upload/*} 에도 걸린다. 메타 DB·스캔 훅·다운로드는 변형 ① 전용 —
 * 이 변형을 쓰면 라이브러리의 저장소 (파일 기반 {@code .info}) 가 메타를 담는다.
 *
 * <p>의존 좌표: {@code me.desair.tus:tus-java-server:1.0.0-3.0} (Java 8 호환).
 */
@Controller
@Profile("tus-lib")
@RequestMapping("/tus-lib/upload")
public class TusLibraryController {

    private final TusFileUploadService tus;
    private final OwnerResolver owners;

    public TusLibraryController(TusFileUploadService tus, OwnerResolver owners) {
        this.tus = tus;
        this.owners = owners;
    }

    /** 모든 메서드를 라이브러리에 위임. OPTIONS 는 인증 없이, 나머지는 소유자 필수. */
    @RequestMapping(value = { "", "/", "/**" })
    public void handle(HttpServletRequest request, HttpServletResponse response) throws IOException {
        if (!"OPTIONS".equalsIgnoreCase(request.getMethod()) && owners.resolve(request) == null) {
            throw new UploadException(401, "authentication required");
        }
        try {
            // 소유자 바인딩: 라이브러리의 owner-key 확장 — 같은 principal 만 같은 업로드 URL 을 본다
            tus.process(request, response, owners.resolve(request));
        } catch (TusException e) {
            response.setStatus(e.getStatus());
            response.getWriter().write(e.getMessage() == null ? "" : e.getMessage());
        }
    }

    /** 프로파일 전용 배선 — 저장 경로는 변형 ① 과 같은 검증기를 지난다 (S1). */
    @Configuration
    @Profile("tus-lib")
    public static class TusLibraryConfig {

        @Bean
        public TusFileUploadService tusFileUploadService(UploadProperties properties, StorageDirectoryValidator validator) {
            return new TusFileUploadService()
                .withStoragePath(validator.storagePath().resolve("tus-lib").toString())
                .withUploadURI("/tus-lib/upload")
                .withMaxUploadSize(properties.getMaxSize())
                .withUploadExpirationPeriod(properties.getTtlMillis())
                .withThreadLocalCache(true);
        }

        @Bean
        public TusLibraryCleanup tusLibraryCleanup(TusFileUploadService tus) {
            return new TusLibraryCleanup(tus);
        }
    }

    /** S7 — 라이브러리 저장소의 만료 업로드 정리 (변형 ① 의 ExpiredUploadReaper 와 같은 주기). */
    public static class TusLibraryCleanup {
        private final TusFileUploadService tus;

        public TusLibraryCleanup(TusFileUploadService tus) {
            this.tus = tus;
        }

        @Scheduled(fixedDelayString = "${upload.gcIntervalMillis:600000}", initialDelayString = "${upload.gcIntervalMillis:600000}")
        public void cleanup() throws IOException {
            tus.cleanup();
        }
    }
}
