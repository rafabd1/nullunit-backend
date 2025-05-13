import { t } from 'elysia';

export const likeSchemas = {
    params: t.Object({
        type: t.String({ 
            enum: ['article', 'project'],
            description: 'Content type' 
        }),
        id: t.String({ 
            format: 'uuid',
            description: 'Content ID' 
        })
    }),

    likeResponse: t.Object({
        liked: t.Boolean({
            description: 'Current like status'
        }),
        count: t.Integer({
            description: 'Total number of likes'
        })
    }),

    countResponse: t.Object({
        count: t.Integer({
            description: 'Total number of likes'
        })
    }),

    errorResponse: t.Object({
        error: t.String({
            description: 'Error message'
        }),
        status: t.Integer({
            description: 'HTTP status code'
        })
    })
};

// Novo schema para a lista de conteúdos curtidos
export const likedContentSchema = t.Object({
    content_id: t.String({
        format: 'uuid',
        description: 'ID of the liked content'
    }),
    content_type: t.String({
        enum: ['article', 'project'],
        description: 'Type of the liked content'
    }),
    liked_at: t.String({
        format: 'date-time',
        description: 'Timestamp when the content was liked'
    })
});

export const userLikesResponseSchema = t.Array(likedContentSchema);
