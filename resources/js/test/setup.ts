import { cleanup } from '@testing-library/react';
import { Storage } from 'happy-dom';
import { afterEach } from 'vitest';

// Node 25 exposes an incomplete localStorage unless --localstorage-file is set.
// Replace it with happy-dom's implementation so the browser test environment
// remains consistent across supported Node versions.
const localStorageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
);

if (typeof localStorageDescriptor?.value?.getItem !== 'function') {
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: new Storage(),
    });
}

afterEach(() => {
    cleanup();
});
