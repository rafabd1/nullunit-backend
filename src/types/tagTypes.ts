import { t } from 'elysia';
import { 
    tagSchema, 
    tagInputSchema, 
    tagUpdateSchema 
} from '../schemas/tagSchemas';

// Type for Tag object (based on response schema)
export type Tag = typeof tagSchema._type;

// Type for input data when creating a new Tag
export type TagInputData = typeof tagInputSchema._type;

// Type for input data when updating a Tag (partial)
export type TagUpdateData = typeof tagUpdateSchema._type;

// Interface para uma tag como armazenada no banco de dados (pode ser idêntica a Tag)
export interface TagDb extends Tag {}

// Interface para dados de input no banco ao criar (pode ser idêntica a TagInputData)
export interface TagDbInput extends TagInputData {}

// Interface para dados de input no banco ao atualizar (pode ser idêntica a TagUpdateData)
// ou pode precisar de campos específicos do DB se houver lógica de atualização diferente
export interface TagDbUpdate extends TagUpdateData {}

// Tipos para as tabelas de associação (apenas para referência, 
// a API de tags não manipulará diretamente a criação dessas associações,
// mas o serviço precisará interagir com elas para deleção em cascata e consultas)

export interface ArticleModuleTag {
    article_module_id: string;
    tag_id: string;
}

export interface SubArticleTag {
    sub_article_id: string;
    tag_id: string;
}

export interface ProjectTag {
    project_id: string;
    tag_id: string;
} 