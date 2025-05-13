import { supabase } from '../config/supabase';
import { ArticleModule, SubArticle } from '../types/database';
import { generateSlug } from '../utils/slugUtils';

interface CreateArticleModuleInput {
    member_id: string;
    slug: string;
    title: string;
    description?: string;
}

interface CreateSubArticleInput {
    module_id: string;
    slug: string;
    title: string;
    content: string;
}

interface UpdateArticleModuleInput {
    title?: string;
    description?: string;
    slug?: string;
}

/**
 * @description Service layer for article management
 */
export class ArticleService {
    private static readonly MODULE_QUERY = `
        *,
        sub_articles (
            id,
            slug,
            title,
            content,
            created_at,
            updated_at
        )`;

    /**
     * @description Get all article modules with their sub-articles
     */
    static async getAllModules(): Promise<ArticleModule[]> {
        const { data, error } = await supabase
            .from('article_modules')
            .select(this.MODULE_QUERY)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch article modules: ${error.message}`);
        return data;
    }

    /**
     * @description Get a specific article module by its slug
     */
    static async getModuleBySlug(slug: string): Promise<ArticleModule | null> {
        const { data: moduleExists } = await supabase
            .from('article_modules')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();

        if (!moduleExists) {
            return null;
        }

        console.log('Found module ID:', moduleExists.id);

        const { data, error } = await supabase
            .from('article_modules')
            .select(this.MODULE_QUERY)
            .eq('slug', slug)
            .single();

        if (error) {
            throw new Error(`Failed to fetch article module: ${error.message}`);
        }

        return data;
    }

    /**
     * @description Create a new article module
     */
    static async createModule(input: Omit<CreateArticleModuleInput, 'slug'>): Promise<ArticleModule> {
        const { member_id, title, description } = input;
        
        let slug = generateSlug(title);

        let existingModule = await this.getModuleBySlug(slug);
        let suffix = 1;
        while (existingModule) {
            slug = `${generateSlug(title)}-${suffix}`;
            existingModule = await this.getModuleBySlug(slug);
            suffix++;
        }

        const { data, error } = await supabase
            .from('article_modules')
            .insert({ 
                member_id,
                title, 
                description,
                slug
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating article module:', error);
            if (error.code === '23505') {
                throw new Error('A module with a similar title (resulting in a duplicate slug) already exists. Please try a slightly different title.');
            }
            throw new Error('Failed to create article module.');
        }
        return data;
    }

    /**
     * @description Update an article module
     */
    static async updateModule(moduleId: string, input: UpdateArticleModuleInput): Promise<ArticleModule> {
        const { slug, ...validUpdates } = input as any;
        if (slug) {
            console.warn('Attempted to update slug in ArticleService.updateModule. Slug updates are not directly supported here.');
        }
        if (Object.keys(validUpdates).length === 0) {
            const module = await this.getModuleById(moduleId);
            if (!module) throw new Error('Module not found for update with no changes');
            return module;
        }
        const { data, error } = await supabase
            .from('article_modules')
            .update({ ...validUpdates, updated_at: new Date().toISOString() })
            .eq('id', moduleId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * @description Create a new sub-article
     */
    static async createSubArticle(input: Omit<CreateSubArticleInput, 'slug'>): Promise<SubArticle> {
        const { module_id, title, content } = input;
        
        let slug = generateSlug(title);

        let existingArticle = await this.getSubArticleByModuleIdAndSlug(module_id, slug);
        let suffix = 1;
        while (existingArticle) {
            slug = `${generateSlug(title)}-${suffix}`;
            existingArticle = await this.getSubArticleByModuleIdAndSlug(module_id, slug);
            suffix++;
        }

        const { data, error } = await supabase
            .from('sub_articles')
            .insert({ 
                module_id, 
                title, 
                content,
                slug
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating sub-article:', error);
            if (error.code === '23505') {
                throw new Error('A sub-article with a similar title (resulting in a duplicate slug) already exists within this module. Please try a slightly different title.');
            }
            throw new Error('Failed to create sub-article.');
        }
        return data;
    }

    /**
     * @description Get a specific sub-article by its slug and module slug
     */
    static async getSubArticleBySlug(moduleSlug: string, subArticleSlug: string): Promise<SubArticle | null> {
        const { data: module, error: moduleError } = await supabase
            .from('article_modules')
            .select('id')
            .eq('slug', moduleSlug)
            .single();

        if (moduleError) throw new Error(`Failed to fetch module: ${moduleError.message}`);
        if (!module) return null;

        const { data, error } = await supabase
            .from('sub_articles')
            .select('*')
            .eq('module_id', module.id)
            .eq('slug', subArticleSlug)
            .single();

        if (error && error.code !== 'PGRST116') throw new Error(`Failed to fetch sub-article: ${error.message}`);
        return data;
    }

    /**
     * @description Delete an article module and all its sub-articles
     */
    static async deleteModule(moduleId: string): Promise<void> {
        const { error } = await supabase
            .from('article_modules')
            .delete()
            .eq('id', moduleId);

        if (error) throw new Error(`Failed to delete article module: ${error.message}`);
    }

    /**
     * @description Update a sub-article
     */
    static async updateSubArticle(articleId: string, input: { 
        title?: string;
        content?: string;
        slug?: string;
    }): Promise<SubArticle> {
        const { data, error } = await supabase
            .from('sub_articles')
            .update(input)
            .eq('id', articleId)
            .select()
            .single();

        if (error) throw new Error(`Failed to update sub-article: ${error.message}`);
        return data;
    }

    /**
     * @description Delete a sub-article
     */
    static async deleteSubArticle(articleId: string): Promise<void> {
        const { error } = await supabase
            .from('sub_articles')
            .delete()
            .eq('id', articleId);

        if (error) throw new Error(`Failed to delete sub-article: ${error.message}`);
    }

    static async getSubArticleByModuleIdAndSlug(moduleId: string, slug: string): Promise<SubArticle | null> {
        const { data, error } = await supabase
            .from('sub_articles')
            .select('id')
            .eq('module_id', moduleId)
            .eq('slug', slug)
            .maybeSingle();

        if (error) {
            console.error('Error checking sub-article slug uniqueness:', error);
            throw new Error('Database error checking sub-article slug.');
        }
        return data;
    }

    static async getModuleById(id: string): Promise<ArticleModule | null> {
        const { data, error } = await supabase
            .from('article_modules')
            .select('*, sub_articles(*)')
            .eq('id', id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    static async getSubArticleById(id: string): Promise<SubArticle | null> {
        const { data, error } = await supabase
            .from('sub_articles')
            .select('*')
            .eq('id', id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }
}
