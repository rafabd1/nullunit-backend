import { t } from 'elysia';

// Schema para validação de parâmetro ID (UUID)
export const paramIdSchema = t.Object({
    id: t.String({ 
        format: 'uuid', 
        error: 'Invalid UUID format for ID parameter' 
    })
});

// Schema para validação de parâmetro ID genérico (usado para module/sub-article/project IDs)
export const genericParamIdSchema = (paramName: string) => t.Object({
    [paramName]: t.String({ 
        format: 'uuid', // Assumindo que todos os IDs relacionados são UUIDs
        error: `Invalid UUID format for ${paramName} parameter` 
    })
});

// Schema para o objeto Tag retornado pela API
export const tagSchema = t.Object({
    id: t.String({ format: 'uuid' }),
    name: t.String()
});

// Schema para input de criação de Tag
export const tagInputSchema = t.Object({
    name: t.String({
        minLength: 2,
        maxLength: 50,
        error: 'Tag name must be between 2 and 50 characters'
    })
});

// Schema para input de atualização de Tag
// Name é opcional aqui, mas a validação no serviço/rota deve garantir que algo seja enviado
export const tagUpdateSchema = t.Partial(tagInputSchema); 

// Schema genérico para erros
export const errorSchema = t.Object({
    error: t.String(),
    message: t.Optional(t.String())
});

// Schema para resposta de deleção bem-sucedida
export const deleteSuccessSchema = t.Object({
    message: t.String()
}); 