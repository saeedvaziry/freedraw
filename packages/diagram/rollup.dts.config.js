import { nodeResolve } from '@rollup/plugin-node-resolve'
import { dts } from 'rollup-plugin-dts'

export default {
  input: 'dist/types/index.d.ts',
  output: { file: 'dist/index.d.ts', format: 'es' },
  plugins: [
    nodeResolve({ extensions: ['.d.ts', '.ts'] }),
    dts({ respectExternal: true }),
  ],
}
