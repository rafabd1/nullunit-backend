/**
 * @description User permission levels
 */
export enum UserPermission {
    ADMIN = 'admin',    // Can manage users, content, and permissions
    AUTHOR = 'author',  // Can create and manage their own content
    GUEST = 'guest'     // Can interact with existing content
}

/**
 * @description Content types that can receive likes
 */
export enum ContentType {
    ARTICLE = 'article_module',
    PROJECT = 'project'
}

/**
 * @description Like data structure
 */
export interface Like {
    id: string;
    user_id: string;
    content_type: ContentType;
    content_id: string;
    created_at: string;
}
