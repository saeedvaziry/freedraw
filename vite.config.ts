import { fileURLToPath, URL } from 'node:url';
import inertia from '@inertiajs/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig } from 'vite';

const pkg = (path: string) => fileURLToPath(new URL(`./packages/${path}`, import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            '@freedraw/engine/connectors': pkg('engine/src/connectors/index.ts'),
            '@freedraw/engine/diagram': pkg('engine/src/diagram/index.ts'),
            '@freedraw/engine/geometry/fit': pkg('engine/src/geometry/fit.ts'),
            '@freedraw/engine/model/factory': pkg('engine/src/model/factory.ts'),
            '@freedraw/engine/model/schema': pkg('engine/src/model/schema.ts'),
            '@freedraw/engine/model/types': pkg('engine/src/model/types.ts'),
            '@freedraw/engine/render/exportScene': pkg('engine/src/render/export-scene.ts'),
            '@freedraw/engine': pkg('engine/src/index.ts'),
            '@freedraw/diagram': pkg('diagram/src/index.ts'),
        },
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        inertia(),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
    ],
});
