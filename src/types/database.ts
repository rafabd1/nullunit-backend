import { UserPermission, ContentType } from './permissions';

export interface Member {
    id: string;
    username: string;
    role: string;
    permission: UserPermission;
    avatar_url?: string;
    bio: string;
    created_at: string;
    updated_at: string;
}

export interface SocialLink {
    id: string;
    member_id: string;
    platform: string;
    url: string;
}

export interface ArticleModule {
    id: string;
    slug: string;
    title: string;
    description?: string;
    member_id: string;
    created_at: string;
    updated_at: string;
}

export interface SubArticle {
    id: string;
    module_id: string;
    slug: string;
    title: string;
    content: string;
    author_id: string;
    published_date: string;
    created_at: string;
    updated_at: string;
}

export interface Tag {
    id: string;
    name: string;
}

export interface PortfolioProject {
    id: string;
    slug: string;
    title: string;
    description: string;
    repo_url: string;
    member_id: string;
    created_at: string;
    updated_at: string;
}

export interface Like {
    id: string;
    user_id: string;
    content_type: ContentType;
    content_id: string;
    created_at: string;
}
