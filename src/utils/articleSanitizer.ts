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

    if (sanitized.length < 3 || sanitized.length > 150) {
        throw new Error('Title must be between 3 and 150 characters');
    }

    return sanitized;
};

/**
 * @description Sanitizes and validates description
 */
const sanitizeDescription = (description?: string): string | undefined => {
    if (description === null || description === undefined) return undefined;

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
 * @description Input type for article data from user (before db specific fields are added)
 */
interface ArticleUserData {
    title: string;
    description?: string;
    content: string;
    // tagNames, published, verified are passed through, not sanitized here
}

/**
 * @description Sanitizes unified article data from user input.
 * tagNames, published, and verified are not sanitized here but passed through.
 */
const sanitizeArticleData = <T extends ArticleUserData>(data: T): Omit<T, 'tagNames' | 'published' | 'verified'> & { title: string; description?: string; content: string } => {
    const sanitizedTitle = sanitizeTitle(data.title);
    const sanitizedDescription = data.description ? sanitizeDescription(data.description) : undefined;
    const sanitizedContent = sanitizeContent(data.content);

    return {
        ...data, // Pass through other fields like tagNames, published, verified
        title: sanitizedTitle,
        description: sanitizedDescription,
        content: sanitizedContent,
    };
};

// Exportar as funções individuais e a composta
export { sanitizeSlug, sanitizeTitle, sanitizeDescription, sanitizeContent, sanitizeArticleData };
