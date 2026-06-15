package io.cognimesh.catalog.service;

import io.cognimesh.catalog.api.DataProductResponse;
import io.cognimesh.catalog.api.RegisterProductRequest;
import io.cognimesh.catalog.store.ProductStore;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ProductRegistry {

    private final ProductStore store;

    public ProductRegistry(ProductStore store) {
        this.store = store;
    }

    public DataProductResponse register(RegisterProductRequest request) {
        String status = Boolean.TRUE.equals(request.integrityGatePassed())
                ? "approved"
                : "pending_integrity_gate";
        return store.save(request, status);
    }

    public List<DataProductResponse> list(String domain) {
        return store.findAll(domain);
    }

    public DataProductResponse get(String id) {
        return store.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found: " + id));
    }
}
