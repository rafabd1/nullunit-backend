export class DatabaseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}

export class ForbiddenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ForbiddenError';
    }
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

// Você pode adicionar outros tipos de erro customizados aqui se necessário
// Exemplo:
// export class NotFoundError extends Error {
//     constructor(message: string) {
//         super(message);
//         this.name = 'NotFoundError';
//     }
// }

// export class ValidationError extends Error {
//     constructor(message: string) {
//         super(message);
//         this.name = 'ValidationError';
//     }
// } 