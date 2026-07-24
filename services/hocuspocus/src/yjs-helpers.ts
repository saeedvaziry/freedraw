import * as Y from 'yjs'

export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

export function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'))
}

export function encodeDocState(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc)
}

export function collectAssetIds(doc: Y.Doc): string[] {
  const elements = doc.getMap('elements')
  const ids = new Set<string>()

  for (const value of elements.values()) {
    if (!(value instanceof Y.Map)) {
      continue
    }

    if (value.get('type') !== 'image') {
      continue
    }

    const assetId = value.get('assetId')

    if (typeof assetId === 'string' && assetId.length > 0) {
      ids.add(assetId)
    }
  }

  return [...ids]
}
