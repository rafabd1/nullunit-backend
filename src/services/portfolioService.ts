import { supabase } from '../config/supabase';
import { PortfolioProject, PortfolioDbInput, PortfolioDbUpdate } from '../types/portfolioTypes';
import { generateSlug } from '../utils/slugUtils'; // Precisaremos criar este utilitário
import { TagService } from './tagService'; // Importar TagService
import { Tag } from '../types/tagTypes'; // Importar Tag
import { DatabaseError } from '../utils/errors'; // Importar DatabaseError

const TABLE_PROJECT_TAGS = 'project_tags';

export class PortfolioService {
    private static readonly TABLE_NAME = 'portfolio_projects';
    private static readonly PROJECT_FIELDS = 'id, member_id, created_at, updated_at, slug, title, description, repo_url';

    // Helper para buscar tags de um projeto
    private static async _getProjectTags(projectId: string): Promise<Tag[]> {
        try {
            return await TagService.getTagsByProjectId(projectId);
        } catch (error) {
            console.error(`Error fetching tags for project ${projectId}:`, error);
            return []; // Retornar array vazio em caso de erro
        }
    }

    // Helper para gerenciar associações de tags (reutilizado de ArticleService com pequenas adaptações se necessário)
    // Ou pode ser um utilitário compartilhado se a lógica for idêntica.
    // Por enquanto, vamos duplicar e simplificar para este contexto.
    private static async _manageTags(tagNames: string[] | undefined | null, projectId: string): Promise<string[]> {
        if (!tagNames || tagNames.length === 0) {
            const { error: deleteError } = await supabase
                .from(TABLE_PROJECT_TAGS)
                .delete()
                .eq('project_id', projectId);
            if (deleteError) {
                console.error(`Error clearing tags for project ${projectId}:`, deleteError);
            }
            return [];
        }

        const uniqueTagNames = [...new Set(tagNames.map(name => name.trim()).filter(Boolean))];
        if (uniqueTagNames.length === 0) return [];

        const tagPromises = uniqueTagNames.map(name => TagService.createTag({ name }));
        const tags = await Promise.all(tagPromises);
        const tagIds = tags.map(tag => tag.id);

        await supabase.from(TABLE_PROJECT_TAGS).delete().eq('project_id', projectId);
        
        const associations = tagIds.map(tagId => ({
            project_id: projectId,
            tag_id: tagId
        }));

        const { error: insertError } = await supabase.from(TABLE_PROJECT_TAGS).insert(associations);
        if (insertError) {
            console.error(`Error inserting new tags for project ${projectId}:`, insertError);
            throw new DatabaseError(`Failed to associate tags with project: ${insertError.message}`);
        }
        return tagIds;
    }

    /**
     * @description Get all portfolio projects, including tags.
     */
    static async getAll(): Promise<PortfolioProject[]> {
        const { data, error } = await supabase
            .from(this.TABLE_NAME)
            .select(this.PROJECT_FIELDS)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching all portfolio projects:', error);
            throw new DatabaseError('Failed to fetch portfolio projects.');
        }
        if (!data) return [];

        const projectsWithTags = await Promise.all(data.map(async (project) => ({
            ...project,
            tags: await this._getProjectTags(project.id)
        })));

        return projectsWithTags;
    }

    /**
     * @description Get a single portfolio project by its slug, including tags.
     */
    static async getBySlug(slug: string): Promise<PortfolioProject | null> {
        const { data, error } = await supabase
            .from(this.TABLE_NAME)
            .select(this.PROJECT_FIELDS)
            .eq('slug', slug)
            .maybeSingle(); // Use maybeSingle

        if (error) { 
            console.error(`Error fetching portfolio project by slug ${slug}:`, error);
            throw new DatabaseError('Failed to fetch portfolio project by slug.');
        }
        if (!data) return null;

        const tags = await this._getProjectTags(data.id);
        return { ...data, tags };
    }

    /**
     * @description Create a new portfolio project, managing tags.
     */
    static async create(input: PortfolioDbInput): Promise<PortfolioProject> {
        const { member_id, title, description, repo_url, tagNames } = input;
        
        let slug = generateSlug(title);
        let existingProject = await this.getBySlugInternal(slug); // Usar helper interno
        let suffix = 1;
        while (existingProject) {
            slug = `${generateSlug(title)}-${suffix}`;
            existingProject = await this.getBySlugInternal(slug);
            suffix++;
        }

        const { data: newProject, error } = await supabase
            .from(this.TABLE_NAME)
            .insert({
                member_id,
                title,
                slug,
                description,
                repo_url
            })
            .select(this.PROJECT_FIELDS)
            .single();

        if (error || !newProject) {
            console.error('Error creating portfolio project:', error);
            if (error?.code === '23505') { 
                 throw new DatabaseError('A project with a similar title (resulting in a duplicate slug) already exists. Please try a slightly different title.');
            }
            throw new DatabaseError('Failed to create portfolio project.');
        }

        const tagIds = await this._manageTags(tagNames, newProject.id);
        const tags = tagIds.length > 0 ? await TagService.getTagsByIds(tagIds) : [];

        return { ...newProject, tags };
    }

    /**
     * @description Update an existing portfolio project, managing tags.
     */
    static async update(id: string, memberId: string, updates: PortfolioDbUpdate): Promise<PortfolioProject> {
        const { slug, tagNames, ...validUpdates } = updates;
        if (slug) {
            console.warn('Attempted to update slug in PortfolioService.update. Slug updates are not directly supported here.');
        }

        let updatedProjectData: PortfolioProject | null = null;

        if (Object.keys(validUpdates).length > 0) {
            const { data, error } = await supabase
                .from(this.TABLE_NAME)
                .update({
                    ...validUpdates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .eq('member_id', memberId)
                .select(this.PROJECT_FIELDS)
                .single();

            if (error) {
                 if (error.code === 'PGRST116') throw new DatabaseError('Project not found or user not authorized.');
                console.error(`Error updating portfolio project ${id}:`, error);
                throw new DatabaseError('Failed to update portfolio project data.');
            }
             updatedProjectData = data;
        } else {
             updatedProjectData = await this.getByIdInternal(id);
             if (!updatedProjectData) throw new DatabaseError('Project not found.');
        }
        
        // Verificar se o memberId corresponde ao projeto se não houve updates nos dados
        if (updatedProjectData.member_id !== memberId) {
            throw new DatabaseError('User not authorized to update this project.');
        }

        const tagIds = await this._manageTags(tagNames, id);
        const tags = tagIds.length > 0 ? await TagService.getTagsByIds(tagIds) : [];

        return { ...updatedProjectData, tags };
    }

    /**
     * @description Get a single portfolio project by its ID, including tags.
     */
    static async getById(id: string): Promise<PortfolioProject | null> {
        const projectData = await this.getByIdInternal(id);
        if (!projectData) return null;

        const tags = await this._getProjectTags(projectData.id);
        return { ...projectData, tags };
    }

    // ---- Funções Internas ----
    static async getBySlugInternal(slug: string): Promise<PortfolioProject | null> {
        const { data, error } = await supabase
            .from(this.TABLE_NAME)
            .select(this.PROJECT_FIELDS)
            .eq('slug', slug)
            .maybeSingle();
        if (error) {
            console.error(`Internal error fetching project by slug ${slug}:`, error);
            return null;
        }
        return data;
    }

    static async getByIdInternal(id: string): Promise<PortfolioProject | null> {
        const { data, error } = await supabase
            .from(this.TABLE_NAME)
            .select(this.PROJECT_FIELDS)
            .eq('id', id)
            .maybeSingle();
        if (error) {
            console.error(`Internal error fetching project by ID ${id}:`, error);
            return null;
        }
        return data;
    }


    /**
     * @description Delete a portfolio project.
     * (ON DELETE CASCADE should handle tag associations)
     */
    static async delete(id: string, memberId: string): Promise<{ message: string }> {
        // Verificar propriedade antes de deletar para retornar erro mais específico se não autorizado
        const project = await this.getByIdInternal(id);
        if (!project) {
            throw new DatabaseError('Project not found.');
        }
        if (project.member_id !== memberId) {
            throw new DatabaseError('User not authorized to delete this project.');
        }

        // ON DELETE CASCADE deve cuidar da remoção das tags de project_tags
        const { error, count } = await supabase
            .from(this.TABLE_NAME)
            .delete()
            .eq('id', id)
            .eq('member_id', memberId); 

        if (error) {
            console.error(`Error deleting portfolio project ${id}:`, error);
            throw new DatabaseError('Failed to delete portfolio project.');
        }
        // O count aqui deveria ser 1 se a deleção acima e a verificação de memberId foram bem sucedidas
        // A verificação de count === 0 pode ser redundante devido à checagem de propriedade acima.
        // Mas mantemos por segurança.
        if (count === 0 && project) { // Se o projeto existia mas o count é 0, algo estranho aconteceu.
             console.warn(`Project ${id} was found but delete operation returned count 0.`);
             throw new DatabaseError('Failed to delete project, or it was already deleted.');
        }

        return { message: 'Portfolio project deleted successfully.' };
    }
} 