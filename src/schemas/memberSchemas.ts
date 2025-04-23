// src/schemas/memberSchemas.ts
import { t } from 'elysia';

// Schema for the member data returned by the API
export const memberSchema = t.Object({
    id: t.String(),
    username: t.String(),
    role: t.String(),
    bio: t.String(),
    avatar_url: t.Optional(t.String()),
    created_at: t.String(), // Consider t.Date() if you prefer Date objects
    updated_at: t.String()  // Consider t.Date()
});

// Schema for validating member creation input (request body)
export const memberInputSchema = t.Object({
    username: t.String({ minLength: 3, maxLength: 30 }),
    role: t.String({ minLength: 2, maxLength: 50 }),
    bio: t.String({ maxLength: 500 }),
    avatar: t.Optional(t.File({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxSize: '5m' })) // Use t.File for uploads
});

// Schema for validating member update input (request body)
export const memberUpdateSchema = t.Object({
    role: t.Optional(t.String({ minLength: 2, maxLength: 50 })),
    bio: t.Optional(t.String({ maxLength: 500 })),
    avatar: t.Optional(t.File({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxSize: '5m' })) // Use t.File for uploads
});

// You can define reusable error schemas here too if needed
// export const memberNotFoundError = t.Object({ error: t.Literal('Member not found') });
