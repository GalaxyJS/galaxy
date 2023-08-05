import * as esbuild from 'esbuild'

let ctx = await esbuild.build({
  entryPoints: ['src-es/index.js'],
  outfile: 'dist/galaxy.es.js',
  bundle: true,
  format: 'esm',
  // format: 'iife',
})

// await ctx.watch()
console.log('watching...')
