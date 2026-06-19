export interface RenderLoopHandle {
    start(): void;
    stop(): void;
    markDirty(): void;
}

export function createRenderLoop(onRender: () => void): RenderLoopHandle {
    let needsRender = false;
    let running = false;
    let frameId = 0;

    const tick = (): void => {
        if (!running) return;
        if (needsRender) {
            needsRender = false;
            onRender();
        }
        frameId = requestAnimationFrame(tick);
    };

    return {
        start(): void {
            if (running) return;
            running = true;
            // Paint the first frame synchronously so a freshly mounted canvas (which
            // resize() has just cleared to transparent) shows the scene before the
            // browser's next paint — otherwise the canvas flashes blank for one frame
            // on mount and when swapping boards.
            needsRender = false;
            onRender();
            frameId = requestAnimationFrame(tick);
        },
        stop(): void {
            running = false;
            cancelAnimationFrame(frameId);
        },
        markDirty(): void {
            needsRender = true;
        },
    };
}
