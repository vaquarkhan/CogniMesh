package io.cognimesh.catalog.store;

import io.cognimesh.catalog.api.DataProductResponse;
import io.cognimesh.catalog.api.RegisterProductRequest;
import io.cognimesh.catalog.config.CatalogProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.ScanRequest;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Component
@ConditionalOnProperty(name = "cognimesh.catalog.storage", havingValue = "dynamodb")
public class DynamoProductStore implements ProductStore {

    private final DynamoDbClient dynamoDb;
    private final CatalogProperties properties;

    public DynamoProductStore(DynamoDbClient dynamoDb, CatalogProperties properties) {
        this.dynamoDb = dynamoDb;
        this.properties = properties;
    }

    @Override
    public DataProductResponse save(RegisterProductRequest request, String status) {
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();

        Map<String, AttributeValue> item = new HashMap<>();
        item.put("pk", AttributeValue.builder().s("PRODUCT#" + id).build());
        item.put("sk", AttributeValue.builder().s("v" + request.version()).build());
        item.put("id", AttributeValue.builder().s(id).build());
        item.put("name", AttributeValue.builder().s(request.name()).build());
        item.put("domain", AttributeValue.builder().s(request.domain()).build());
        item.put("version", AttributeValue.builder().s(request.version()).build());
        item.put("status", AttributeValue.builder().s(status).build());
        item.put("registeredAt", AttributeValue.builder().s(now.toString()).build());
        if (request.description() != null) {
            item.put("description", AttributeValue.builder().s(request.description()).build());
        }
        if (request.manifestYaml() != null) {
            item.put("manifestYaml", AttributeValue.builder().s(request.manifestYaml()).build());
        }

        dynamoDb.putItem(PutItemRequest.builder()
                .tableName(properties.getTableName())
                .item(item)
                .build());

        return new DataProductResponse(
                id,
                request.name(),
                request.domain(),
                request.version(),
                status,
                now,
                request.tags() != null ? request.tags() : Map.of()
        );
    }

    @Override
    public List<DataProductResponse> findAll(String domain) {
        if (domain != null) {
            var res = dynamoDb.query(QueryRequest.builder()
                    .tableName(properties.getTableName())
                    .indexName("domain-index")
                    .keyConditionExpression("domain = :d")
                    .expressionAttributeValues(Map.of(
                            ":d", AttributeValue.builder().s(domain).build()))
                    .build());
            return res.items().stream().map(this::fromItem).toList();
        }

        var res = dynamoDb.scan(ScanRequest.builder()
                .tableName(properties.getTableName())
                .build());
        return res.items().stream().map(this::fromItem).toList();
    }

    @Override
    public Optional<DataProductResponse> findById(String id) {
        var res = dynamoDb.query(QueryRequest.builder()
                .tableName(properties.getTableName())
                .keyConditionExpression("pk = :pk")
                .expressionAttributeValues(Map.of(
                        ":pk", AttributeValue.builder().s("PRODUCT#" + id).build()))
                .build());
        return res.items().stream().findFirst().map(this::fromItem);
    }

    private DataProductResponse fromItem(Map<String, AttributeValue> item) {
        return new DataProductResponse(
                item.get("id").s(),
                item.get("name").s(),
                item.get("domain").s(),
                item.get("version").s(),
                item.get("status").s(),
                Instant.parse(item.get("registeredAt").s()),
                Map.of()
        );
    }
}
