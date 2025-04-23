// src/types/memberTypes.ts
export interface MemberInputData {
    username: string;
    role: string;
    bio: string;
    avatar?: File; // Use File type matching the schema
}

export interface MemberUpdateData {
    role?: string;
    bio?: string;
    avatar?: File; // Use File type matching the schema
}

// Represents data structure closer to the database input for creation
export interface MemberDbInput {
    id: string;
    username: string;
    role: string;
    bio: string;
    avatar_url?: string;
}

// Consider adding other member-specific types if needed
