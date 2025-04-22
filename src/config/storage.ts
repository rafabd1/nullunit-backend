import { supabase } from './supabase';

export interface ImageValidationResult {
    isValid: boolean;
    mimeType?: string;
    error?: string;
}

/**
 * @description Validates image format and structure deeply
 */
export const validateImage = (buffer: Buffer): ImageValidationResult => {
    // JPEG magic numbers and end markers
    const jpegSignatures = [
        { start: [0xFF, 0xD8, 0xFF, 0xE0], end: [0xFF, 0xD9] }, // JFIF
        { start: [0xFF, 0xD8, 0xFF, 0xE1], end: [0xFF, 0xD9] }, // EXIF
        { start: [0xFF, 0xD8, 0xFF, 0xE8], end: [0xFF, 0xD9] }  // SPIFF
    ];

    // PNG signature and IEND chunk
    const pngSignature = {
        start: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
        end: [0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]
    };

    // Size validation
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (buffer.length > maxSize) {
        return { 
            isValid: false, 
            error: 'Image size exceeds 5MB limit.' 
        };
    }

    // Convert buffer to Uint8Array for safer comparisons
    const data = new Uint8Array(buffer);
    
    // Deep JPEG validation
    const isJPEG = jpegSignatures.some(sig => {
        const startArray = new Uint8Array(sig.start);
        const endArray = new Uint8Array(sig.end);
        
        // Check start signature
        const header = data.subarray(0, startArray.length);
        if (!startArray.every((byte, i) => header[i] === byte)) return false;

        // Find EOF marker
        const tail = data.subarray(-2);
        return endArray.every((byte, i) => tail[i] === byte);
    });

    // Deep PNG validation
    const isPNG = (() => {
        const startArray = new Uint8Array(pngSignature.start);
        const endArray = new Uint8Array(pngSignature.end);
        
        // Check header with subarray
        const header = data.subarray(0, startArray.length);
        if (!startArray.every((byte, i) => header[i] === byte)) return false;

        // Validate PNG chunks structure
        let offset = startArray.length;
        let foundIEND = false;
        
        while (offset < data.length - 12) {
            const chunkLength = new DataView(data.buffer).getUint32(offset);
            const chunkType = data.subarray(offset + 4, offset + 8);
            
            // Validate chunk length
            if (chunkLength > data.length - offset) break;
            
            // Check if we found IEND chunk
            if (String.fromCharCode(...chunkType) === 'IEND') {
                const iendData = data.subarray(offset + 8, offset + 8 + chunkLength + 4);
                if (endArray.every((byte, i) => iendData[i] === byte)) {
                    foundIEND = true;
                    break;
                }
            }
            
            offset += 12 + chunkLength;
        }
        
        return foundIEND;
    })();

    if (!isJPEG && !isPNG) {
        return { 
            isValid: false, 
            error: 'Invalid image format. Only JPEG and PNG are allowed.' 
        };
    }

    return {
        isValid: true,
        mimeType: isJPEG ? 'image/jpeg' : 'image/png'
    };
};

/**
 * @description Uploads an avatar image to Supabase storage
 */
export const uploadAvatar = async (file: Buffer, username: string): Promise<string> => {
    const validation = validateImage(file);
    
    if (!validation.isValid) {
        throw new Error(validation.error);
    }

    const fileExt = validation.mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const fileName = `${username}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
            contentType: validation.mimeType,
            cacheControl: '3600',
            upsert: true
        });

    if (uploadError) {
        throw new Error(`Failed to upload avatar: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

    return publicUrl;
};

/**
 * @description Deletes an old avatar from storage
 */
export const deleteOldAvatar = async (url: string | undefined): Promise<void> => {
    if (!url) return;

    const pathMatch = url.match(/avatars\/[^?#]+/);
    if (!pathMatch) return;

    const { error } = await supabase.storage
        .from('avatars')
        .remove([pathMatch[0]]);

    if (error) {
        console.error('Failed to delete old avatar:', error);
    }
};
