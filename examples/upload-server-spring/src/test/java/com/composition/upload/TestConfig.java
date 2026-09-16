package com.composition.upload;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import javax.sql.DataSource;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.SimpleDriverDataSource;
import org.springframework.jdbc.datasource.init.DataSourceInitializer;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import com.composition.upload.config.UploadCoreConfig;
import com.composition.upload.config.UploadProperties;

/**
 * 테스트 배선 — H2 in-memory (MODE=Oracle) + java.io.tmpdir 아래 임시 저장 디렉터리. {@link UploadCoreConfig} 를
 * 그대로 import 하므로 서비스·컨트롤러·필터 배선은 운영과 같다. 시스템 프로퍼티 {@code upload.test.storageDir} 로
 * 저장 경로를 바꿀 수 있다 (webroot 거부 테스트).
 */
@Configuration
@Import(UploadCoreConfig.class)
public class TestConfig {

    public static final String STORAGE_DIR_PROPERTY = "upload.test.storageDir";
    public static final long TEST_MAX_SIZE = 1024L * 1024L;
    public static final long TEST_CHUNK_MAX = 64L * 1024L;
    public static final int TEST_MAX_ACTIVE = 5;

    private static final Path DEFAULT_STORAGE = createTempDir();

    @Bean
    public UploadProperties uploadProperties() {
        UploadProperties p = new UploadProperties();
        p.setStorageDir(System.getProperty(STORAGE_DIR_PROPERTY, DEFAULT_STORAGE.toString()));
        p.setMaxSize(TEST_MAX_SIZE);
        p.setChunkMaxBytes(TEST_CHUNK_MAX);
        p.setTtlHours(1L);
        p.setMaxActivePerOwner(TEST_MAX_ACTIVE);
        p.setAllowedExtensions("png,pdf,txt,zip,bin");
        p.setDevLoginEnabled(true);
        return p;
    }

    @Bean
    public DataSource dataSource() {
        SimpleDriverDataSource ds = new SimpleDriverDataSource();
        ds.setDriverClass(org.h2.Driver.class);
        ds.setUrl("jdbc:h2:mem:upload-test;MODE=Oracle;DB_CLOSE_DELAY=-1");
        ds.setUsername("sa");
        ds.setPassword("");
        return ds;
    }

    @Bean
    public DataSourceInitializer dataSourceInitializer(DataSource dataSource) {
        DataSourceInitializer initializer = new DataSourceInitializer();
        initializer.setDataSource(dataSource);
        initializer.setDatabasePopulator(new ResourceDatabasePopulator(new ClassPathResource("schema-h2.sql")));
        return initializer;
    }

    private static Path createTempDir() {
        try {
            Path dir = Files.createTempDirectory("composition-upload-test");
            dir.toFile().deleteOnExit();
            return dir;
        } catch (IOException e) {
            throw new IllegalStateException("cannot create temp storage dir", e);
        }
    }
}
