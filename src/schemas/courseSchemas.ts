import { t } from 'elysia';
import { tagSchema } from './tagSchemas'; // Assumindo que tagSchema já existe e é adequado

// Schema para Course (Output)
export const courseSchema = t.Object({
    id: t.String({ format: 'uuid' }),
    created_at: t.String({ format: 'date-time' }),
    updated_at: t.Optional(
        t.String({
            format: 'date-time',
            description: 'Last update timestamp (nullable)',
            nullable: true
        })
    ),
    slug: t.String(),
    title: t.String(),
    description: t.Optional(t.String({
        maxLength: 5000,
        description: 'Course description (nullable)',
        nullable: true
    })),
    member_id: t.String({ format: 'uuid' }), // Instructor
    is_paid: t.Boolean(),
    published: t.Boolean(),
    verified: t.Boolean(),
    tags: t.Optional(t.Array(tagSchema, { description: 'Tags associated with the course' }))
});

// Schema para Course (Input - Criação)
export const courseInputSchema = t.Object({
    title: t.String({ minLength: 3, maxLength: 150 }),
    description: t.Optional(t.String({ maxLength: 5000 })),
    // member_id será pego do usuário autenticado/contexto da requisição
    is_paid: t.Optional(t.Boolean({ default: false })),
    tagNames: t.Optional(t.Array(t.String({ minLength: 1, maxLength: 50 })))
});

// Schema para Course (Input - Atualização)
export const courseUpdateSchema = t.Partial(
    t.Object({
        title: t.String({ minLength: 3, maxLength: 150 }),
        description: t.Optional(t.String({ maxLength: 5000 })),
        is_paid: t.Boolean(),
        tagNames: t.Optional(t.Array(t.String({ minLength: 1, maxLength: 50 })))
    }),
    { minProperties: 1 } // Garante que pelo menos uma propriedade seja fornecida para atualização
);


// Schema para CourseModule (Output)
export const courseModuleSchema = t.Object({
    id: t.String({ format: 'uuid' }),
    course_id: t.String({ format: 'uuid' }),
    created_at: t.String({ format: 'date-time' }),
    updated_at: t.Optional(
        t.String({
            format: 'date-time',
            nullable: true
        })
    ),
    title: t.String(),
    description: t.Optional(t.String({
        maxLength: 2000,
        description: 'Course module description (nullable)',
        nullable: true
    })),
    order: t.Unsafe<number>({ type: 'integer', format: 'int32', description: 'Module display order' })
});

// Schema para CourseModule (Input - Criação)
export const courseModuleInputSchema = t.Object({
    // course_id será pego do parâmetro da rota (e.g. /courses/:courseId/modules)
    title: t.String({ minLength: 3, maxLength: 150 }),
    description: t.Optional(t.String({ maxLength: 2000 })),
    order: t.Integer({ minimum: 0 })
});

// Schema para CourseModule (Input - Atualização)
export const courseModuleUpdateSchema = t.Partial(
    t.Object({
        title: t.String({ minLength: 3, maxLength: 150 }),
        description: t.Optional(t.String({ maxLength: 2000 })),
        order: t.Integer({ minimum: 0 })
    }),
    { minProperties: 1 }
);


// Schema para Lesson (Output)
export const lessonSchema = t.Object({
    id: t.String({ format: 'uuid' }),
    course_module_id: t.String({ format: 'uuid' }),
    created_at: t.String({ format: 'date-time' }),
    updated_at: t.Optional(
        t.String({
            format: 'date-time',
            nullable: true
        })
    ),
    order: t.Unsafe<number>({ type: 'integer', format: 'int32', description: 'Lesson display order' }),

    question_prompt: t.String({ description: 'The primary text/prompt for the exercise.' }),
    exercise_type: t.String({ description: 'Defines the type of exercise (e.g., flag, text_input).' }),
    expected_answer: t.String({ description: 'The correct answer for the exercise (sensitive, consider if this should be in all GET responses).' }),
    options_data: t.Optional(t.Any({ description: 'JSON data for exercise options (e.g., for multiple choice).'})),
    answer_placeholder: t.Optional(t.String({ description: 'A placeholder for the answer format/length.' })),
    answer_format_hint: t.Optional(t.String({ description: 'Optional hint for the answer format.' }))
});

// Schema para Lesson (Input - Criação)
export const lessonInputSchema = t.Object({
    // course_module_id será pego do parâmetro da rota
    order: t.Integer({ minimum: 0 }),

    question_prompt: t.String({ minLength: 5, description: 'The primary text/prompt for the exercise.' }),
    exercise_type: t.String({ minLength: 3, description: 'Defines the type of exercise (e.g., flag, text_input).' }),
    expected_answer: t.String({ minLength: 1, description: 'The correct answer for the exercise.' }),
    options_data: t.Optional(t.Any({ description: 'JSON data for exercise options.'})),
    answer_placeholder: t.Optional(t.String({ maxLength: 100, description: 'Optional placeholder for the answer format/length.' })),
    answer_format_hint: t.Optional(t.String({ maxLength: 200, description: 'Optional hint for the answer format.' }))
});

// Schema para Lesson (Input - Atualização)
export const lessonUpdateSchema = t.Partial(
    t.Object({
        order: t.Integer({ minimum: 0 }),

        question_prompt: t.String({ minLength: 5 }),
        exercise_type: t.String({ minLength: 3 }),
        expected_answer: t.String({ minLength: 1 }),
        options_data: t.Any(),
        answer_placeholder: t.String({ maxLength: 100 }),
        answer_format_hint: t.String({ maxLength: 200 })
    }),
    { minProperties: 1 }
);

/**
 * Schema for error responses
 */
export const errorSchema = t.Object({
    error: t.String(),
    message: t.String()
}); 