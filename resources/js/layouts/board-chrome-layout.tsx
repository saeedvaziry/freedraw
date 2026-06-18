import type { ReactNode } from 'react';
import { BoardSidebar } from '@/components/board/board-sidebar';

/**
 * Shared chrome for authenticated, non-board pages (settings, organizations).
 *
 * Renders the same floating board sidebar over the left edge that the home board
 * uses, so moving between the board and these pages doesn't shift the sidebar.
 * Page content lives in the panel area and is offset by the sidebar's reserved
 * width (the `--board-sidebar-width` variable the sidebar maintains).
 */
export default function BoardChromeLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <div className="relative min-h-svh bg-background">
            <div className="pointer-events-none fixed top-3 bottom-3 left-3 z-10 hidden sm:block">
                <BoardSidebar />
            </div>
            <div className="min-h-svh transition-[padding] duration-200 ease-linear sm:pl-[calc(0.75rem+var(--board-sidebar-width,0px))]">
                {children}
            </div>
        </div>
    );
}
