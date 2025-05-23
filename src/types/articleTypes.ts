import { moduleInputSchema, subArticleInputSchema } from '../schemas/articleSchemas';
import { Tag } from './tagTypes'; // Importar o tipo Tag

// Input types derived from Schemas for validation consistency
export type ModuleInputData = typeof moduleInputSchema._type & {
    tagNames?: string[]; // Tags a serem associadas/atualizadas
};
export type SubArticleInputData = typeof subArticleInputSchema._type & {
    tagNames?: string[]; // Tags a serem associadas/atualizadas
};

/**
 * @description Interface representing the data structure for creating a module in the database.
 */
export interface ModuleDbInput extends ModuleInputData { // Agora ModuleInputData é o tipo do schema
    member_id: string;
    slug: string; // Será gerado pelo serviço
}

/**
 * @description Interface representing the data structure for creating a sub-article in the database.
 */
export interface SubArticleDbInput extends SubArticleInputData { // Agora SubArticleInputData é o tipo do schema
    module_id: string;
    slug: string; // Será gerado pelo serviço
}

/**
 * @description Interface representing an article module from the database
 */
export interface ArticleModule {
    id: string;
    created_at: string;
    updated_at: string | null;
    slug: string;
    title: string;
    description?: string;
    member_id: string;
    tags?: Tag[]; // Tags associadas ao módulo
    sub_articles?: SubArticle[];
}

/**
 * @description Interface representing a sub-article from the database
 */
export interface SubArticle {
    id: string;
    created_at: string;
    updated_at: string | null;
    module_id: string;
    slug: string;
    title: string;
    content: string;
    tags?: Tag[]; // Tags associadas ao sub-artigo
}

// Tipos para atualização também usam os tipos derivados dos schemas
export type ModuleDbUpdate = Partial<ModuleInputData>; 
export type SubArticleDbUpdate = Partial<SubArticleInputData>; 
