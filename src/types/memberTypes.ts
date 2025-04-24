import { UserPermission } from './permissions';

export interface Member {
    id: string;
    username: string;
    email: string;
    permission: UserPermission;
    bio?: string;
    avatar_url?: string;
    created_at: string;
    updated_at: string;
}

export interface MemberInputData {
    username: string;
    role?: string;
    bio?: string;
    avatar?: File | Buffer;
}

export interface MemberUpdateData {
    role?: string;
    bio?: string;
    avatar?: File | Buffer;
}

export interface MemberProfileUpdate {
    role?: string;
    bio?: string;
    avatar_url?: string;
}

export interface MemberDbInput {
    id: string;
    email: string;
    username: string;
    role: string;
    permission?: UserPermission;
    bio: string;
    avatar_url?: string;
}

export interface MemberResponse {
    id: string;
    username: string;
    role: string;
    permission: UserPermission;
    bio: string;
    avatar_url?: string;
    created_at: string;
    updated_at: string;
}

export interface MemberWithPermission {
    id: string;
    permission: UserPermission;
}
