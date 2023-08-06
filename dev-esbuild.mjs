import * as esbuild from 'esbuild'

let ctx = await esbuild.build({
  entryPoints: ['src-es/index.js'],
  outfile: 'site/assets/galaxyjs/galaxy.es.js',
  bundle: true,
  format: 'esm',

  metafile: true,
  // format: 'iife',
})

// await ctx.watch()
console.log('watching...')
