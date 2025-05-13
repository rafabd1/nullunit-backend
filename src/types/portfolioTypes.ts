import { t } from 'elysia';
import { portfolioInputSchema, portfolioUpdateSchema } from '../schemas/portfolioSchemas';

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
    // Poderíamos adicionar dados do usuário aqui se necessário (ex: username)
    // author?: { username: string; avatar_url?: string }; 
}

// Tipo para os dados de entrada ao criar um projeto
export type PortfolioInputData = t.Static<typeof portfolioInputSchema>;

// Tipo para os dados de entrada ao atualizar um projeto
export type PortfolioUpdateData = t.Static<typeof portfolioUpdateSchema>;

// Tipo para os dados como são inseridos no DB (com member_id)
export interface PortfolioDbInput extends Omit<PortfolioInputData, 'slug'> {
    member_id: string;
    slug: string; // Slug é gerado ou validado antes de inserir
}

// Tipo para os dados como são atualizados no DB
export type PortfolioDbUpdate = Partial<Omit<PortfolioUpdateData, 'slug'>> & { slug?: string }; 