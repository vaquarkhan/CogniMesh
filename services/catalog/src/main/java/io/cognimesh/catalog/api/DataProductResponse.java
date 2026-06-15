package io.cognimesh.catalog.api;

import java.time.Instant;
import java.util.Map;

public record DataProductResponse(
        String id,
        String name,
        String domain,
        String version,
        String status,
        Instant registeredAt,
        Map<String, String> tags
) {}
