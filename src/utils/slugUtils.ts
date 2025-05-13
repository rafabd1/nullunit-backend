/**
 * Generates a URL-friendly slug from a string.
 * - Converts to lowercase.
 * - Replaces spaces and non-alphanumeric characters (except hyphens) with hyphens.
 * - Removes leading/trailing hyphens.
 * - Collapses multiple hyphens into a single one.
 * @param text The text to slugify.
 * @returns A URL-friendly slug.
 */
export function generateSlug(text: string): string {
    if (!text) return 'n-a'; // Default slug for empty text

    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-') // Replace spaces with -
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars except hyphens
        .replace(/\-\-+/g, '-') // Replace multiple - with single -
        .replace(/^-+/, '') // Trim - from start of text
        .replace(/-+$/, ''); // Trim - from end of text
} 