package ai

import "context"

// ExerciseImageParser turns worksheet images into structured exercise data (Parse(Image…) → ParsedExercise).
// Implement with Gemini, Ollama, or a fully custom pipeline.
type ExerciseImageParser interface {
	ParseExercisePages(ctx context.Context, pages []ImagePart) (*ParsedExercise, error)
}
