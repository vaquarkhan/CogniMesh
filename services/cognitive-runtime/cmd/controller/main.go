package main

import (
	"encoding/json"
	"net/http"

	"github.com/cognimesh/cognitive-runtime/pkg/runtime"
)

func main() {
	executor := runtime.NewInMemoryExecutor()
	ctrl := runtime.NewController(executor)
	ctrl.RegisterCompensation("cognimesh.compensation.media-rollback", runtime.MediaRollbackCompensation{})

	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "cognitive-runtime"})
	})

	http.HandleFunc("/v1/commit", func(w http.ResponseWriter, r *http.Request) {
		var job runtime.Job
		if err := json.NewDecoder(r.Body).Decode(&job); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		result, err := ctrl.Commit(r.Context(), job, "cognimesh.compensation.media-rollback")
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnprocessableEntity)
			return
		}
		json.NewEncoder(w).Encode(result)
	})

	http.ListenAndServe(":8081", nil)
}
