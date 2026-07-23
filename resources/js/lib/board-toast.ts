import { toast } from 'sonner';

export type BoardToastVariant = 'success' | 'error';

export function boardToast(
    message: string,
    variant: BoardToastVariant = 'success',
): void {
    toast[variant](message);
}
