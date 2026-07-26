import fontUrl from '@fontsource/architects-daughter/files/architects-daughter-latin-400-normal.woff2?url';
import { setSvgFontFaces } from '@freedraw/engine';

const HANDWRITTEN_FAMILY = 'Architects Daughter';
const BASE64_CHUNK = 0x8000;

let pending: Promise<void> | null = null;

export function ensureSvgExportFonts(): Promise<void> {
    pending ??= registerHandwrittenFace().catch((error: unknown) => {
        pending = null;
        console.warn('Font embedding unavailable', error);
    });

    return pending;
}

async function registerHandwrittenFace(): Promise<void> {
    const response = await fetch(fontUrl);

    if (!response.ok) {
        throw new Error(`Font request failed with status ${response.status}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());

    setSvgFontFaces([
        {
            family: HANDWRITTEN_FAMILY,
            source: `data:font/woff2;base64,${encodeBase64(bytes)}`,
            weight: 400,
            style: 'normal',
        },
    ]);
}

function encodeBase64(bytes: Uint8Array): string {
    let binary = '';

    for (let index = 0; index < bytes.length; index += BASE64_CHUNK) {
        binary += String.fromCharCode(
            ...bytes.subarray(index, index + BASE64_CHUNK),
        );
    }

    return btoa(binary);
}
