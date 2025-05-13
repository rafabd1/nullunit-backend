import { supabase } from '../config/supabase';
import { PortfolioProject, PortfolioDbInput, PortfolioDbUpdate } from '../types/portfolioTypes';
import { generateSlug } from '../utils/slugUtils'; // Precisaremos criar este utilitário

export class PortfolioService {
    private static readonly TABLE_NAME = 'portfolio_projects';

    /**
     * @description Get all portfolio projects. 
     * TODO: Implement pagination and potentially joining with member data for author info.
     */
    static async getAll(): Promise<PortfolioProject[]> {
        const { data, error } = await supabase
            .from(this.TABLE_NAME)
            .select('*') // Poderia selecionar explicitamente ou '*, members(username, avatar_url)'
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching all portfolio projects:', error);
            throw new Error('Failed to fetch portfolio projects.');
        }
        return data || [];
    }

    /**
     * @description Get a single portfolio project by its slug.
     */
    static async getBySlug(slug: string): Promise<PortfolioProject | null> {
        const { data, error } = await supabase
            .from(this.TABLE_NAME)
            .select('*') // Poderia selecionar explicitamente ou '*, members(username, avatar_url)'
            .eq('slug', slug)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116: No rows found, which is a valid case (null)
            console.error(`Error fetching portfolio project by slug ${slug}:`, error);
            throw new Error('Failed to fetch portfolio project by slug.');
        }
        return data || null;
    }

    /**
     * @description Create a new portfolio project.
     */
    static async create(input: PortfolioDbInput): Promise<PortfolioProject> {
        const { member_id, title, description, repo_url } = input;
        
        // Gerar slug a partir do título
        let slug = generateSlug(title);
        
        // Verificar se o slug já existe e adicionar sufixo se necessário
        let existingProject = await this.getBySlug(slug);
        let suffix = 1;
        while (existingProject) {
            slug = `${generateSlug(title)}-${suffix}`;
            existingProject = await this.getBySlug(slug);
            suffix++;
        }

        const { data, error } = await supabase
            .from(this.TABLE_NAME)
            .insert({
                member_id,
                title,
                slug, // Usar o slug gerado e verificado
                description,
                repo_url
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating portfolio project:', error);
            // Se o erro for de violação de unicidade do slug (apesar da verificação, pode haver race condition)
            if (error.code === '23505') { // Unique violation
                 throw new Error('A project with a similar title (resulting in a duplicate slug) already exists. Please try a slightly different title.');
            }
            throw new Error('Failed to create portfolio project.');
        }
        return data;
    }

    /**
     * @description Update an existing portfolio project.
     * The slug cannot be updated directly via this method to maintain URL stability.
     * If slug update is needed, it should be a more complex operation.
     */
    static async update(id: string, memberId: string, updates: PortfolioDbUpdate): Promise<PortfolioProject> {
        // Garantir que o slug não seja atualizado aqui, se presente em 'updates'
        const { slug, ...validUpdates } = updates;
        if (slug) {
            console.warn('Attempted to update slug in PortfolioService.update. Slug updates are not directly supported here.');
        }

        if (Object.keys(validUpdates).length === 0) {
            // Se não houver atualizações válidas, busca e retorna o projeto existente
            const project = await this.getById(id); // Precisamos de getById
            if (!project) throw new Error('Project not found for update with no changes.');
            return project;
        }

        const { data, error } = await supabase
            .from(this.TABLE_NAME)
            .update({
                ...validUpdates,
                updated_at: new Date().toISOString() // Manually set updated_at
            })
            .eq('id', id)
            .eq('member_id', memberId) // Ensure the user owns the project they are updating
            .select()
            .single();

        if (error) {
            console.error(`Error updating portfolio project ${id}:`, error);
            throw new Error('Failed to update portfolio project.');
        }
        if (!data) {
            // Isso pode acontecer se o ID do projeto não existir ou o member_id não corresponder
            throw new Error('Project not found or user not authorized to update this project.');
        }
        return data;
    }

    /**
     * @description Get a single portfolio project by its ID.
     */
    static async getById(id: string): Promise<PortfolioProject | null> {
        const { data, error } = await supabase
            .from(this.TABLE_NAME)
            .select('*')
            .eq('id', id)
            .single();
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        return data || null;
    }


    /**
     * @description Delete a portfolio project.
     */
    static async delete(id: string, memberId: string): Promise<{ message: string }> {
        const { error, count } = await supabase
            .from(this.TABLE_NAME)
            .delete()
            .eq('id', id)
            .eq('member_id', memberId); // Ensure the user owns the project they are deleting

        if (error) {
            console.error(`Error deleting portfolio project ${id}:`, error);
            throw new Error('Failed to delete portfolio project.');
        }
        if (count === 0) {
            throw new Error('Project not found or user not authorized to delete this project.');
        }
        return { message: 'Portfolio project deleted successfully.' };
    }
} 