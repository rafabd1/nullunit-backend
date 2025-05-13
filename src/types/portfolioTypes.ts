import { t } from 'elysia';
import { portfolioInputSchema, portfolioUpdateSchema } from '../schemas/portfolioSchemas';
import { Tag } from './tagTypes'; // Importar Tag

// Interface base para um projeto do portfólio (como vem do DB)
export interface PortfolioProject {
    id: string;
    member_id: string;
    created_at: string;
    updated_at: string | null;
    slug: string;
    title: string;
    description: string | null;
    repo_url: string | null;
    tags?: Tag[]; // Tags associadas ao projeto
    // Poderíamos adicionar dados do usuário aqui se necessário (ex: username)
    // author?: { username: string; avatar_url?: string }; 
}

// Type for input data when creating a project
export type PortfolioInputData = {
    title: string;
    description?: string;
    repo_url?: string;
    tagNames?: string[];
};

// Type for input data when updating a project
export type PortfolioUpdateData = {
    title?: string;
    description?: string;
    repo_url?: string;
    tagNames?: string[];
};

// Tipo para os dados como são inseridos no DB (com member_id)
export interface PortfolioDbInput extends Omit<PortfolioInputData, 'slug' | 'tagNames'> {
    member_id: string;
    slug: string; // Slug é gerado ou validado antes de inserir
    tagNames?: string[]; // Passar tagNames para o service
}

// Tipo para os dados como são atualizados no DB
export type PortfolioDbUpdate = Partial<Omit<PortfolioUpdateData, 'slug' | 'tagNames'>> & { 
    slug?: string; 
    tagNames?: string[]; // Passar tagNames para o service
}; 
