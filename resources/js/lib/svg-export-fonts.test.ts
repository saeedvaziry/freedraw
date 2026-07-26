import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { FONT_URL, setSvgFontFaces } = vi.hoisted(() => ({
    FONT_URL: '/assets/architects-daughter.woff2',
    setSvgFontFaces: vi.fn(),
}));

vi.mock(
    '@fontsource/architects-daughter/files/architects-daughter-latin-400-normal.woff2?url',
    () => ({ default: FONT_URL }),
);

vi.mock('@freedraw/engine', () => ({ setSvgFontFaces }));

const FONT_BYTES = new Uint8Array([1, 2, 3]);

function okResponse(): Response {
    return {
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(FONT_BYTES.buffer),
    } as unknown as Response;
}

async function loadModule(): Promise<() => Promise<void>> {
    vi.resetModules();

    const module = await import('./svg-export-fonts');

    return module.ensureSvgExportFonts;
}

beforeEach(() => {
    setSvgFontFaces.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('ensureSvgExportFonts', () => {
    it('registers the handwritten woff2 as a base64 font face', async () => {
        const fetchMock = vi.fn(() => Promise.resolve(okResponse()));
        vi.stubGlobal('fetch', fetchMock);

        const ensure = await loadModule();
        await ensure();

        expect(fetchMock).toHaveBeenCalledWith(FONT_URL);
        expect(setSvgFontFaces).toHaveBeenCalledWith([
            {
                family: 'Architects Daughter',
                source: `data:font/woff2;base64,${btoa('\x01\x02\x03')}`,
                weight: 400,
                style: 'normal',
            },
        ]);
    });

    it('fetches the font bytes once across repeated exports', async () => {
        const fetchMock = vi.fn(() => Promise.resolve(okResponse()));
        vi.stubGlobal('fetch', fetchMock);

        const ensure = await loadModule();
        await Promise.all([ensure(), ensure()]);
        await ensure();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(setSvgFontFaces).toHaveBeenCalledTimes(1);
    });

    it('resolves without registering a face when the fetch fails', async () => {
        const fetchMock = vi.fn(() => Promise.reject(new Error('offline')));
        vi.stubGlobal('fetch', fetchMock);

        const ensure = await loadModule();

        await expect(ensure()).resolves.toBeUndefined();

        expect(setSvgFontFaces).not.toHaveBeenCalled();
    });

    it('leaves a rejected response retryable on the next export', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
            .mockResolvedValueOnce(okResponse());
        vi.stubGlobal('fetch', fetchMock);

        const ensure = await loadModule();
        await ensure();
        await ensure();

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(setSvgFontFaces).toHaveBeenCalledTimes(1);
    });
});
