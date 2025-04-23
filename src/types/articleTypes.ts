// src/types/articleTypes.ts

/**
 * @description Interface for data needed to create a new article module.
 */
export interface ModuleInputData {
    title: string;
    description?: string;
    slug?: string;
}

/**
 * @description Interface for data needed to create a new sub-article.
 */
export interface SubArticleInputData {
    title: string;
    content: string;
    slug?: string;
}

/**
 * @description Interface representing the data structure for creating a module in the database.
 */
export interface ModuleDbInput extends ModuleInputData {
    member_id: string;
}

/**
 * @description Interface representing the data structure for creating a sub-article in the database.
 */
export interface SubArticleDbInput extends SubArticleInputData {
    module_id: string;
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
}
