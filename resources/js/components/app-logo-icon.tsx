import { useId } from 'react';
import type { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    // Unique gradient ids per instance so multiple logos on one page don't collide.
    const uid = useId().replace(/:/g, '');
    const tileGrad = `tile-${uid}`;
    const nodeGrad = `node-${uid}`;

    return (
        <svg
            {...props}
            viewBox="0 0 512 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient
                    id={tileGrad}
                    x1="0.8535533905932737"
                    y1="0.1464466094067262"
                    x2="0.14644660940672627"
                    y2="0.8535533905932737"
                >
                    <stop offset="0" stopColor="#8B5CFF" />
                    <stop offset="0.55" stopColor="#6C3CE9" />
                    <stop offset="1" stopColor="#4318C9" />
                </linearGradient>
                <linearGradient
                    id={nodeGrad}
                    x1="0.8535533905932737"
                    y1="0.1464466094067262"
                    x2="0.14644660940672627"
                    y2="0.8535533905932737"
                >
                    <stop offset="0" stopColor="#FFFFFF" />
                    <stop offset="1" stopColor="#EDE7FF" />
                </linearGradient>
            </defs>
            {/* gradient tile */}
            <path
                d="M114 0H398C486.11218459088 0 512 25.887815409119995 512 114V398C512 486.11218459088 486.11218459088 512 398 512H114C25.887815409119995 512 0 486.11218459088 0 398V114C0 25.887815409119995 25.887815409119995 0 114 0Z"
                fill={`url(#${tileGrad})`}
            />
            {/* connector edges */}
            <g transform="rotate(115.6,208,250)">
                <path
                    d="M 105.1 242 H 310.9 A 8 8 0 0 1 318.9 250 V 250 A 8 8 0 0 1 310.9 258 H 105.1 A 8 8 0 0 1 97.1 250 V 250 A 8 8 0 0 1 105.1 242 Z"
                    fill="rgba(255,255,255,0.85)"
                />
            </g>
            <g transform="rotate(64.4,304,250)">
                <path
                    d="M 201.1 242 H 406.9 A 8 8 0 0 1 414.9 250 V 250 A 8 8 0 0 1 406.9 258 H 201.1 A 8 8 0 0 1 193.1 250 V 250 A 8 8 0 0 1 201.1 242 Z"
                    fill="rgba(255,255,255,0.85)"
                />
            </g>
            <path
                d="M 168 342 H 344 A 8 8 0 0 1 352 350 V 350 A 8 8 0 0 1 344 358 H 168 A 8 8 0 0 1 160 350 V 350 A 8 8 0 0 1 168 342 Z"
                fill="rgba(255,255,255,0.85)"
            />
            {/* nodes */}
            <path
                d="M 234 98 H 278 C 301.1874169976 98 308 104.8125830024 308 128 V 172 C 308 195.1874169976 301.1874169976 202 278 202 H 234 C 210.8125830024 202 204 195.1874169976 204 172 V 128 C 204 104.8125830024 210.8125830024 98 234 98 Z"
                fill={`url(#${nodeGrad})`}
            />
            <ellipse cx="160" cy="350" rx="44" ry="44" fill={`url(#${nodeGrad})`} />
            <ellipse cx="352" cy="350" rx="44" ry="44" fill={`url(#${nodeGrad})`} />
        </svg>
    );
}
