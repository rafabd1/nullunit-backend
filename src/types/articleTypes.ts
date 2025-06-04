import { articleInputSchema } from '../schemas/articleSchemas'; // Será atualizado depois
import { Tag } from './tagTypes';

// Input type derived from Schema for validation consistency
export type ArticleInputData = typeof articleInputSchema._type & {
    tagNames?: string[]; // Tags a serem associadas/atualizadas
};

/**
 * @description Interface representing the data structure for creating an article in the database.
 * published e verified serão definidos pelo serviço, não virão do input.
 */
export interface ArticleDbInput extends ArticleInputData {
    member_id: string;
    slug?: string; // Torna o slug opcional, pois será gerado pelo serviço
}

/**
 * @description Interface representing an Article from the database
 */
export interface Article {
    id: string;
    created_at: string;
    updated_at: string | null;
    slug: string;
    title: string;
    description?: string; // Um resumo/meta-descrição opcional
    content: string; // Conteúdo completo do artigo
    member_id: string;
    published: boolean;
    verified: boolean;
    tags?: Tag[]; // Tags associadas ao artigo
}

/**
 * @description Tipo para atualização. published e verified não são atualizáveis por esta rota.
 */
export type ArticleDbUpdate = Partial<Omit<ArticleInputData, 'tagNames'>> & {
    tagNames?: string[] | null; // Permitir null para indicar remoção de todas as tags
    // published e verified foram removidos daqui, não serão atualizáveis via ArticleService.updateArticle
};
