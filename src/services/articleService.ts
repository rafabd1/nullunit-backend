import { supabase } from '../config/supabase';
import { ArticleModule, SubArticle } from '../types/database';

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
        const { data, error } = await supabase
            .from('article_modules')
            .select(this.MODULE_QUERY)
            .eq('slug', slug)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('No module found with slug:', slug);
                return null;
            }
            throw new Error(`Failed to fetch article module: ${error.message}`);
        }

        return data;
    }

    /**
     * @description Create a new article module
     */
    static async createModule(input: CreateArticleModuleInput): Promise<ArticleModule> {
        const { data, error } = await supabase
            .from('article_modules')
            .insert(input)
            .select(this.MODULE_QUERY)
            .single();

        if (error) throw new Error(`Failed to create article module: ${error.message}`);
        return data;
    }

    /**
     * @description Update an article module
     */
    static async updateModule(moduleId: string, input: UpdateArticleModuleInput): Promise<ArticleModule> {
        const { data, error } = await supabase
            .from('article_modules')
            .update(input)
            .eq('id', moduleId)
            .select(this.MODULE_QUERY)
            .single();

        if (error) throw new Error(`Failed to update article module: ${error.message}`);
        return data;
    }

    /**
     * @description Create a new sub-article
     */
    static async createSubArticle(input: CreateSubArticleInput): Promise<SubArticle> {
        const { data, error } = await supabase
            .from('sub_articles')
            .insert(input)
            .select()
            .single();

        if (error) throw new Error(`Failed to create sub-article: ${error.message}`);
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
}
