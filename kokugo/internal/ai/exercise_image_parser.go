package ai

import "context"

// ExerciseImageParser turns worksheet images into structured exercise data (ParseExercisePages → ordered exercises).
// The default server build uses Gemini one-shot vision.
type ExerciseImageParser interface {
	ParseExercisePages(ctx context.Context, pages []ImagePart) ([]ParsedExercise, error)
}
