import { Head } from '@inertiajs/react';
import { useEffect } from 'react';
import { BoardRoute } from '@/components/board/board-route';

export default function Board() {
    useEffect(() => {
        document.documentElement.classList.add('board-page');

        return () => document.documentElement.classList.remove('board-page');
    }, []);

    return (
        <>
            <Head title="Home" />
            <BoardRoute />
        </>
    );
}
