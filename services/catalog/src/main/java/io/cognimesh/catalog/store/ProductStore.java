package io.cognimesh.catalog.store;

import io.cognimesh.catalog.api.DataProductResponse;
import io.cognimesh.catalog.api.RegisterProductRequest;

import java.util.List;
import java.util.Optional;

public interface ProductStore {
    DataProductResponse save(RegisterProductRequest request, String status);

    List<DataProductResponse> findAll(String domain);

    Optional<DataProductResponse> findById(String id);
}
