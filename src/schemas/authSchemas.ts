import { t } from 'elysia';

export const authSchemas = {
    verifyQuery: t.Object({
        email: t.String({ 
            format: 'email',
            description: 'Email to verify' 
        }),
        type: t.String({
            enum: ['signup'],
            description: 'Verification type'
        }),
        access_token: t.String({
            description: 'Access token from email'
        })
    }),

    signup: t.Object({
        email: t.String({ 
            format: 'email',
            description: 'User email address' 
        }),
        password: t.String({ 
            minLength: 8,
            description: 'User password - minimum 8 characters' 
        }),
        username: t.String({ 
            minLength: 3, 
            maxLength: 30,
            description: 'Username - between 3 and 30 characters' 
        })
    }),

    login: t.Object({
        email: t.String({ 
            format: 'email',
            description: 'User email address' 
        }),
        password: t.String({ 
            minLength: 8,
            description: 'User password' 
        })
    }),

    user: t.Object({
        id: t.String({
            description: 'User unique identifier'
        }),
        email: t.String({
            format: 'email',
            description: 'User email address'
        }),
        user_metadata: t.Object({
            username: t.String({
                description: 'Username'
            })
        })
    }),

    session: t.Object({
        access_token: t.String({
            description: 'JWT access token'
        }),
        refresh_token: t.String({
            description: 'JWT refresh token'
        })
    }),

    signupResponse: t.Object({
        message: t.String({
            description: 'Success message'
        }),
        user: t.Object({
            id: t.String(),
            email: t.String(),
            user_metadata: t.Object({
                username: t.String()
            })
        })
    }),

    loginResponse: t.Object({
        user: t.Object({
            id: t.String(),
            email: t.String(),
            user_metadata: t.Object({
                username: t.String()
            })
        }),
        session: t.Object({
            access_token: t.String(),
            refresh_token: t.String()
        })
    }),

    logoutResponse: t.Object({
        message: t.String({
            description: 'Success message'
        })
    }),

    errorResponse: t.Object({
        error: t.String({
            description: 'Error message'
        })
    }),

    updateUserSchema: t.Object({
        email: t.Optional(t.String()),
        password: t.Optional(t.String()),
        username: t.Optional(t.String())
    }),

    updateUserResponse: t.Object({
        user: t.Object({
            id: t.String(),
            email: t.String(),
            user_metadata: t.Object({
                username: t.String()
            })
        }),
        member: t.Object({
            id: t.String(),
            email: t.String(),
            username: t.String(),
            role: t.String(),
            permission: t.String(),
            bio: t.String(),
            avatar_url: t.Optional(t.String()),
            created_at: t.String(),
            updated_at: t.String()
        })
    }),

    deleteUserResponse: t.Object({
        message: t.String(),
        cookie: t.String()
    })
};
