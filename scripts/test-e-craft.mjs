import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url),viteRequire=createRequire(require.resolve('vite'));
const {build}=viteRequire('esbuild');
mkdirSync('.e-craft-tests',{recursive:true});
await build({entryPoints:['scripts/validation.test.ts'],bundle:true,platform:'node',format:'esm',outfile:'.e-craft-tests/validation.test.mjs'});
const r=spawnSync(process.execPath,['--test','.e-craft-tests/validation.test.mjs'],{stdio:'inherit',windowsHide:true});
process.exitCode=r.status??1;
