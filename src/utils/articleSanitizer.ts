import { escapeHTML } from "bun";
import slugify from 'slugify';

/**
 * @description Sanitizes and creates a valid slug
 */
const sanitizeSlug = (text: string): string => {
    const sanitized = slugify(text.toLowerCase(), {
        strict: true,
        lower: true,
        trim: true
    });

    if (!sanitized) {
        throw new Error('Invalid slug text');
    }

    return sanitized;
};

/**
 * @description Sanitizes and validates title
 */
const sanitizeTitle = (title: string): string => {
    const sanitized = escapeHTML(title.trim())
        .replace(/\s+/g, ' ');

    if (sanitized.length < 3 || sanitized.length > 100) {
        throw new Error('Title must be between 3 and 100 characters');
    }

    return sanitized;
};

/**
 * @description Sanitizes and validates description
 */
const sanitizeDescription = (description?: string): string | undefined => {
    if (!description) return undefined;

    const sanitized = escapeHTML(description.trim())
        .replace(/\s+/g, ' ');

    if (sanitized.length > 500) {
        throw new Error('Description must not exceed 500 characters');
    }

    return sanitized;
};

/**
 * @description Sanitizes and validates article content
 */
const sanitizeContent = (content: string): string => {
    // Allow specific Markdown syntax but escape HTML
    const sanitized = content
        .split('\n')
        .map(line => {
            // Preserve Markdown code blocks
            if (line.startsWith('```')) return line;
            if (line.startsWith('    ')) return line;
            
            // Preserve inline code
            if (line.includes('`')) {
                return line.split('`')
                    .map((part, i) => i % 2 === 0 ? escapeHTML(part) : `\`${part}\``)
                    .join('');
            }

            return escapeHTML(line);
        })
        .join('\n');

    if (sanitized.length < 50) {
        throw new Error('Content must be at least 50 characters long');
    }

    return sanitized;
};

/**
 * @description Sanitizes article module data
 */
export const sanitizeModuleData = (data: {
    title: string;
    slug?: string;
    description?: string;
}) => {
    const title = sanitizeTitle(data.title);
    return {
        title,
        slug: data.slug ? sanitizeSlug(data.slug) : sanitizeSlug(title),
        description: data.description ? sanitizeDescription(data.description) : undefined
    };
};

/**
 * @description Sanitizes sub-article data
 */
export const sanitizeSubArticleData = (data: {
    title: string;
    slug?: string;
    content: string;
}) => {
    const title = sanitizeTitle(data.title);
    return {
        title,
        slug: data.slug ? sanitizeSlug(data.slug) : sanitizeSlug(title),
        content: sanitizeContent(data.content)
    };
};
