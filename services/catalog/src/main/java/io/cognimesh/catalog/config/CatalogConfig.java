package io.cognimesh.catalog.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;

@Configuration
@EnableConfigurationProperties(CatalogProperties.class)
public class CatalogConfig {

    @Bean
    @ConditionalOnProperty(name = "cognimesh.catalog.storage", havingValue = "dynamodb")
    public DynamoDbClient dynamoDbClient(CatalogProperties properties) {
        return DynamoDbClient.builder()
                .region(Region.of(properties.getAwsRegion()))
                .build();
    }
}
