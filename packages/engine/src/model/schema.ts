import type { AppState, CameraState, Style } from './types.js'

export const SCHEMA_VERSION = 6

export const FONT_WEIGHT_NORMAL = 400
export const FONT_WEIGHT_BOLD = 700

export const defaultStyle: Style = {
  stroke: '#454545',
  fill: '#ffffff',
  strokeWidth: 2,
  strokeStyle: 'solid',
  opacity: 1,
  roundness: 0,
  sloppiness: 0.5,
  fontSize: 31,
  fontFamily: "'Architects Daughter', cursive",
  fontWeight: FONT_WEIGHT_NORMAL,
  fontStyle: 'normal',
  textColor: '#454545',
  textAlign: 'center',
}

export const defaultCamera: CameraState = { x: 0, y: 0, zoom: 1 }

export function defaultAppState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    camera: { ...defaultCamera },
    lastUsedStyle: { ...defaultStyle },
    snapGuidesEnabled: true,
    slides: [],
  }
}
