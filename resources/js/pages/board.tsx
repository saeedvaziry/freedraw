import { Head } from '@inertiajs/react';
import { useEffect } from 'react';
import { BoardRoute } from '@/components/board/board-route';
import { ToastProvider } from '@/components/board/ui-kit';

export default function Board() {
    useEffect(() => {
        document.documentElement.classList.add('board-page');

        return () => document.documentElement.classList.remove('board-page');
    }, []);

    return (
        <>
            <Head title="Home" />
            <ToastProvider>
                <BoardRoute />
            </ToastProvider>
        </>
    );
}
