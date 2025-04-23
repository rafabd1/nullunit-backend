// src/types/articleTypes.ts

/**
 * Interface for data needed to create a new article module.
 */
export interface ModuleInputData {
    title: string;
    description?: string;
    slug?: string; // Usually generated, but can be provided
}

/**
 * Interface for data needed to create a new sub-article.
 */
export interface SubArticleInputData {
    title: string;
    content: string;
    slug?: string; // Usually generated, but can be provided
}

/**
 * Interface representing the data structure for creating a module in the database.
 */
export interface ModuleDbInput extends ModuleInputData {
    member_id: string; // Added field for the creator's ID
}

/**
 * Interface representing the data structure for creating a sub-article in the database.
 */
export interface SubArticleDbInput extends SubArticleInputData {
    module_id: string;
    author_id: string;
}

// Add other article-related types if necessary
