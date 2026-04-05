package ai

import "context"

// NativeExerciseSchema selects Gemini response_schema for worksheet JSON steps. Ollama ignores it and uses JSONMode only.
type NativeExerciseSchema int

const (
	NativeExerciseSchemaNone NativeExerciseSchema = iota
	NativeExerciseSchemaPlainParsedExercise
	NativeExerciseSchemaParsedExerciseWithRuby
	// NativeExerciseSchemaParsedPageBundleWithRuby is one page → { "exercises": [ ParsedExercise, ... ] }.
	NativeExerciseSchemaParsedPageBundleWithRuby
)

// ExerciseParseModel is a single-turn generator (text + optional images) used by the one-shot worksheet parser.
// The server wires Gemini; implement for custom backends if you replace ExerciseImageParser.
type ExerciseParseModel interface {
	GenerateExerciseParse(ctx context.Context, op string, systemInstruction string, parts []ContentPart, opts ExerciseParseGenOpts) (string, error)
}

// ExerciseParseGenOpts configures one worksheet-parse model call.
type ExerciseParseGenOpts struct {
	Temperature      float32
	MaxOutputTokens  int32
	VisionHighDetail bool
	ThinkingBudget   *int32
	JSONMode         bool
	NativeSchema     NativeExerciseSchema
}
