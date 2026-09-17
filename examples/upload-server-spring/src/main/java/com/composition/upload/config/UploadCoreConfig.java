package com.composition.upload.config;

import javax.servlet.ServletContext;
import javax.sql.DataSource;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.DefaultServletHandlerConfigurer;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.composition.upload.service.AuditLog;
import com.composition.upload.service.ExpiredUploadReaper;
import com.composition.upload.service.NoOpUploadScanner;
import com.composition.upload.service.OwnerResolver;
import com.composition.upload.service.SessionOwnerResolver;
import com.composition.upload.service.UploadMetadataParser;
import com.composition.upload.service.UploadScanner;
import com.composition.upload.service.UploadSessionRepository;
import com.composition.upload.service.UploadSessionService;
import com.composition.upload.service.UploadStorage;
import com.composition.upload.web.DownloadController;
import com.composition.upload.web.SessionController;
import com.composition.upload.web.TusController;
import com.composition.upload.web.TusExceptionHandler;
import com.composition.upload.web.TusHeaders;

/**
 * 서비스·컨트롤러 배선. {@link UploadProperties} 와 {@link DataSource} 는 바깥 (운영 {@link UploadWebConfig},
 * 테스트 TestConfig) 이 제공한다. 컴포넌트 스캔 없이 명시 배선 — 의존 그래프가 이 파일 하나에 보인다.
 */
@Configuration
@EnableWebMvc
public class UploadCoreConfig implements WebMvcConfigurer {

    private final UploadProperties properties;

    public UploadCoreConfig(UploadProperties properties) {
        this.properties = properties;
    }

    /** S1 — 웹루트 안 저장 디렉터리는 기동 실패. */
    @Bean
    public StorageDirectoryValidator storageDirectoryValidator(ServletContext servletContext) {
        return new StorageDirectoryValidator(properties, servletContext);
    }

    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @Bean
    public PlatformTransactionManager transactionManager(DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }

    @Bean
    public TransactionTemplate transactionTemplate(PlatformTransactionManager transactionManager) {
        return new TransactionTemplate(transactionManager);
    }

    @Bean
    public UploadSessionRepository uploadSessionRepository(JdbcTemplate jdbcTemplate) {
        return new UploadSessionRepository(jdbcTemplate);
    }

    @Bean
    public UploadStorage uploadStorage(StorageDirectoryValidator validator) {
        return new UploadStorage(validator.storagePath());
    }

    @Bean
    public UploadMetadataParser uploadMetadataParser() {
        return new UploadMetadataParser();
    }

    /** S4 — AV 스캔 연동 지점. 참조 구현은 no-op (APPROVED). */
    @Bean
    public UploadScanner uploadScanner() {
        return new NoOpUploadScanner();
    }

    @Bean
    public OwnerResolver ownerResolver() {
        return new SessionOwnerResolver();
    }

    @Bean
    public AuditLog auditLog() {
        return new AuditLog();
    }

    @Bean
    public UploadSessionService uploadSessionService(UploadSessionRepository repository, UploadStorage storage,
                                                     TransactionTemplate transactionTemplate, UploadScanner scanner,
                                                     AuditLog auditLog) {
        return new UploadSessionService(properties, repository, storage, transactionTemplate, scanner, auditLog);
    }

    /** S7 — TTL GC. 운영 config 의 @EnableScheduling 이 있어야 주기 실행된다 (테스트는 직접 호출). */
    @Bean
    public ExpiredUploadReaper expiredUploadReaper(UploadSessionService service) {
        return new ExpiredUploadReaper(service);
    }

    @Bean
    public TusController tusController(UploadSessionService service, OwnerResolver ownerResolver,
                                       UploadMetadataParser metadataParser) {
        return new TusController(properties, service, ownerResolver, metadataParser);
    }

    @Bean
    public DownloadController downloadController(UploadSessionService service, OwnerResolver ownerResolver) {
        return new DownloadController(service, ownerResolver);
    }

    @Bean
    public SessionController sessionController() {
        return new SessionController(properties);
    }

    @Bean
    public TusExceptionHandler tusExceptionHandler() {
        return new TusExceptionHandler();
    }

    /**
     * §5 CORS — 교차 출처 배포에서만. 명시 origin 목록 + credentials. Spring 5.3 은 "*" + credentials 조합을
     * 거부하므로 설정 오류가 기동 시 드러난다. Expose-Headers 가 빠지면 클라이언트가 Upload-Offset/Location 을
     * 읽지 못해 재개가 불가능하다 — 계약 §5 의 필수 항목.
     */
    /**
     * DispatcherServlet 이 "/" 에 걸려 있어 정적 파일 (JSP 예제의 {@code js/composition-upload.iife.js}) 은
     * 컨테이너 기본 서블릿으로 넘긴다 — 없으면 404 (G5 JSP 실행 2026-09-17 실측).
     */
    @Override
    public void configureDefaultServletHandling(DefaultServletHandlerConfigurer configurer) {
        configurer.enable();
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        if (properties.getCorsAllowedOrigins().isEmpty()) {
            return;
        }
        String[] origins = properties.getCorsAllowedOrigins().toArray(new String[0]);
        registry.addMapping("/upload/**")
            .allowedOrigins(origins)
            .allowCredentials(true)
            .allowedMethods("POST", "HEAD", "PATCH", "DELETE", "OPTIONS")
            .allowedHeaders(TusHeaders.CORS_ALLOWED_HEADERS)
            .exposedHeaders(TusHeaders.CORS_EXPOSED_HEADERS)
            .maxAge(3600);
        registry.addMapping("/files/**")
            .allowedOrigins(origins)
            .allowCredentials(true)
            .allowedMethods("GET", "OPTIONS")
            .exposedHeaders("Content-Disposition");
    }
}
