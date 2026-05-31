import type { AppState, CameraState, Style } from './types.js'

export const SCHEMA_VERSION = 1

export const defaultStyle: Style = {
  stroke: '#1e1e1e',
  fill: 'transparent',
  strokeWidth: 2,
  strokeStyle: 'solid',
  opacity: 1,
  roundness: 0,
  fontSize: 16,
  fontFamily: 'Inter, system-ui, sans-serif',
  textColor: '#1e1e1e',
  textAlign: 'center',
}

export const defaultCamera: CameraState = { x: 0, y: 0, zoom: 1 }

export function defaultAppState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    camera: { ...defaultCamera },
    lastUsedStyle: { ...defaultStyle },
  }
}
