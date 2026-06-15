package io.cognimesh.catalog.store;

import io.cognimesh.catalog.api.DataProductResponse;
import io.cognimesh.catalog.api.RegisterProductRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
@ConditionalOnProperty(name = "cognimesh.catalog.storage", havingValue = "memory", matchIfMissing = true)
public class InMemoryProductStore implements ProductStore {

    private final Map<String, DataProductResponse> products = new ConcurrentHashMap<>();

    @Override
    public DataProductResponse save(RegisterProductRequest request, String status) {
        String id = UUID.randomUUID().toString();
        DataProductResponse product = new DataProductResponse(
                id,
                request.name(),
                request.domain(),
                request.version(),
                status,
                Instant.now(),
                request.tags() != null ? request.tags() : Map.of()
        );
        products.put(id, product);
        return product;
    }

    @Override
    public List<DataProductResponse> findAll(String domain) {
        List<DataProductResponse> result = new ArrayList<>();
        for (DataProductResponse p : products.values()) {
            if (domain == null || domain.equals(p.domain())) {
                result.add(p);
            }
        }
        return result;
    }

    @Override
    public Optional<DataProductResponse> findById(String id) {
        return Optional.ofNullable(products.get(id));
    }
}
