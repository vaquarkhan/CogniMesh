package io.cognimesh.catalog.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.util.Map;

public record RegisterProductRequest(
        @NotBlank String name,
        @NotBlank String domain,
        @Pattern(regexp = "^\\d+\\.\\d+\\.\\d+$") String version,
        String description,
        @NotBlank String manifestYaml,
        Map<String, String> tags,
        Boolean integrityGatePassed
) {}
