// src/schemas/memberSchemas.ts
import { t } from 'elysia';
import { UserPermission } from '../types/permissions';

export const memberSchema = t.Object({
    id: t.String({
        description: 'Member unique identifier'
    }),
    username: t.String({
        description: 'Member username'
    }),
    role: t.String({
        description: 'Member role'
    }),
    permission: t.Enum(UserPermission, {
        description: 'Member permission level'
    }),
    bio: t.String({
        description: 'Member biography'
    }),
    avatar_url: t.Optional(t.String({
        description: 'Member avatar URL'
    })),
    created_at: t.String({
        description: 'Creation timestamp'
    }),
    updated_at: t.String({
        description: 'Last update timestamp'
    })
});

export const memberInputSchema = t.Object({
    username: t.String({ 
        minLength: 3, 
        maxLength: 30,
        description: 'Username must be between 3 and 30 characters'
    }),
    role: t.String({ 
        minLength: 2, 
        maxLength: 50,
        description: 'Role description'
    }),
    bio: t.String({ 
        maxLength: 500,
        description: 'Member biography'
    }),
    avatar: t.Optional(t.Any({
        description: 'Member avatar file'
    }))
});

export const memberUpdateSchema = t.Object({
    role: t.Optional(t.String({ 
        minLength: 2, 
        maxLength: 50,
        description: 'Role description'
    })),
    bio: t.Optional(t.String({ 
        maxLength: 500,
        description: 'Member biography'
    })),
    avatar: t.Optional(t.Any({
        description: 'Member avatar file'
    }))
});

export const permissionUpdateSchema = t.Object({
    permission: t.Enum(UserPermission, {
        description: 'Member permission level'
    })
});

export const errorSchema = t.Object({
    error: t.String({
        description: 'Error identifier'
    }),
    message: t.String({
        description: 'Error message'
    })
});
