package api

import "context"

type ctxKey int

const ctxKeyUserID ctxKey = 1

// WithUserID attaches the authenticated user id to the request context.
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, ctxKeyUserID, userID)
}

// UserIDFromCtx returns the tenant user id or empty string.
func UserIDFromCtx(ctx context.Context) string {
	v := ctx.Value(ctxKeyUserID)
	if v == nil {
		return ""
	}
	s, _ := v.(string)
	return s
}
