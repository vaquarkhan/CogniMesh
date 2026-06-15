package io.cognimesh.catalog.api;

import io.cognimesh.catalog.service.ProductRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void registerProduct() throws Exception {
        String body = """
                {
                  "name": "customer-orders-cdc",
                  "domain": "commerce",
                  "version": "1.0.0",
                  "manifestYaml": "apiVersion: cognimesh.io/v1",
                  "tags": {"tier": "gold"},
                  "integrityGatePassed": true
                }
                """;

        mockMvc.perform(post("/api/v1/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("customer-orders-cdc"))
                .andExpect(jsonPath("$.status").value("approved"));
    }
}
