import { escapeHTML } from "bun";

/**
 * @description Sanitizes and validates username format
 */
const sanitizeUsername = (username: string): string => {
    // Remove any character that isn't lowercase alphanumeric or hyphen
    const sanitized = username.toLowerCase()
        .replace(/[^a-z0-9-]/g, '');

    if (sanitized !== username.toLowerCase()) {
        throw new Error('Username contains invalid characters');
    }

    return sanitized;
};

/**
 * @description Sanitizes and validates role
 */
const sanitizeRole = (role: string): string => {
    // Only allow letters, numbers, spaces and basic punctuation
    const sanitized = role.trim()
        .replace(/[^\w\s-.]/g, '')
        .replace(/\s+/g, ' ');

    if (sanitized.length < 2 || sanitized.length > 50) {
        throw new Error('Role must be between 2 and 50 characters');
    }

    return sanitized;
};

/**
 * @description Sanitizes and validates bio text
 */
const sanitizeBio = (bio: string): string => {
    // Escape HTML and sanitize
    const sanitized = escapeHTML(bio)
        .trim()
        .replace(/\s+/g, ' ');

    if (sanitized.length < 10 || sanitized.length > 500) {
        throw new Error('Bio must be between 10 and 500 characters');
    }

    return sanitized;
};

/**
 * @description Validates and sanitizes member data
 */
export const sanitizeMemberData = (data: {
    username?: string;
    role?: string;
    bio?: string;
}) => {
    const sanitized: Record<string, string> = {};

    if (data.username) {
        sanitized.username = sanitizeUsername(data.username);
    }

    if (data.role) {
        sanitized.role = sanitizeRole(data.role);
    }

    if (data.bio) {
        sanitized.bio = sanitizeBio(data.bio);
    }

    return sanitized;
};
