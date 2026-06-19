import type { Auth } from '@/types/auth';
import type { Organization } from '@/types/organizations';
import type { BoardAccess, BoardPage } from '@/types/pages';

declare module 'react' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            boardPage: BoardPage | null;
            boardPages: BoardPage[];
            boardAccess: BoardAccess | null;
            sidebarOpen: boolean;
            currentOrganization: Organization | null;
            organizations: Organization[];
            [key: string]: unknown;
        };
    }
}
