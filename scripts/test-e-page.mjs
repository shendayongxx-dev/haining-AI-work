import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url),viteRequire=createRequire(require.resolve('vite'));
mkdirSync('.e-craft-tests',{recursive:true});
await viteRequire('esbuild').build({entryPoints:['scripts/e-page-acceptance.test.ts'],bundle:true,platform:'node',format:'esm',outfile:'.e-craft-tests/page-acceptance.test.mjs'});
process.exitCode=spawnSync(process.execPath,['--test','.e-craft-tests/page-acceptance.test.mjs'],{stdio:'inherit',windowsHide:true}).status??1;
