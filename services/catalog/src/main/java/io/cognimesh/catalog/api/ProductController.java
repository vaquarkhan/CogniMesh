package io.cognimesh.catalog.api;

import io.cognimesh.catalog.service.ProductRegistry;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/products")
public class ProductController {

    private final ProductRegistry registry;

    public ProductController(ProductRegistry registry) {
        this.registry = registry;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DataProductResponse register(@Valid @RequestBody RegisterProductRequest request) {
        return registry.register(request);
    }

    @GetMapping
    public List<DataProductResponse> list(
            @RequestParam(required = false) String domain) {
        return registry.list(domain);
    }

    @GetMapping("/{id}")
    public DataProductResponse get(@PathVariable String id) {
        return registry.get(id);
    }
}
