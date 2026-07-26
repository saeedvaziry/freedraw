import type { PresenceLaserTrail, PresencePoint } from './awareness';
import { PRESENCE_MAX_LASER_POINTS } from './awareness';

export const LASER_TRAIL_MS = 900;
export const LASER_MIN_DISTANCE = 0.75;

export interface LaserTrailOptions {
    trailMs?: number;
    maxPoints?: number;
    minDistance?: number;
    now?: () => number;
}

export interface LaserTrailFrame {
    points: PresencePoint[];
    alpha: number;
}

export interface PresenceLaserSource {
    read(at: number): LaserTrailFrame | null;
    subscribe(listener: () => void): () => void;
}

export interface LaserStore extends PresenceLaserSource {
    readonly trailMs: number;
    push(point: PresencePoint, at?: number): void;
    prune(at?: number): void;
    clear(): void;
    isEmpty(): boolean;
    toTrail(at?: number): PresenceLaserTrail | null;
}

interface LaserSample {
    x: number;
    y: number;
    at: number;
}

function distance(a: LaserSample, b: PresencePoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export function createLaserStore(options: LaserTrailOptions = {}): LaserStore {
    const clock = options.now ?? Date.now;
    const trailMs = Math.max(1, options.trailMs ?? LASER_TRAIL_MS);
    const maxPoints = Math.max(
        2,
        Math.min(
            options.maxPoints ?? PRESENCE_MAX_LASER_POINTS,
            PRESENCE_MAX_LASER_POINTS,
        ),
    );
    const minDistance = Math.max(0, options.minDistance ?? LASER_MIN_DISTANCE);
    const listeners = new Set<() => void>();
    let samples: LaserSample[] = [];

    const notify = (): void => {
        listeners.forEach((listener) => listener());
    };

    const drop = (at: number): boolean => {
        const kept = samples.filter((sample) => at - sample.at < trailMs);

        if (kept.length === samples.length) {
            return false;
        }

        samples = kept;

        return true;
    };

    const frame = (at: number): LaserTrailFrame | null => {
        const visible = samples.filter((sample) => at - sample.at < trailMs);
        const newest = visible[visible.length - 1];

        if (newest === undefined) {
            return null;
        }

        const alpha = Math.max(0, Math.min(1, 1 - (at - newest.at) / trailMs));

        if (alpha <= 0) {
            return null;
        }

        return {
            points: visible.map((sample) => ({ x: sample.x, y: sample.y })),
            alpha,
        };
    };

    return {
        trailMs,
        read: frame,
        subscribe(listener) {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        push(point, at = clock()) {
            if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
                return;
            }

            drop(at);

            const newest = samples[samples.length - 1];

            if (newest !== undefined && distance(newest, point) < minDistance) {
                newest.at = at;
                notify();

                return;
            }

            samples.push({ x: point.x, y: point.y, at });

            if (samples.length > maxPoints) {
                samples = samples.slice(samples.length - maxPoints);
            }

            notify();
        },
        prune(at = clock()) {
            if (drop(at)) {
                notify();
            }
        },
        clear() {
            if (samples.length === 0) {
                return;
            }

            samples = [];
            notify();
        },
        isEmpty() {
            return samples.length === 0;
        },
        toTrail(at = clock()) {
            const visible = frame(at);

            return visible === null
                ? null
                : { points: visible.points, alpha: visible.alpha };
        },
    };
}
