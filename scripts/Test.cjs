'use strict';
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const modules=path.join(root,'.build/HUD/resources/app/node_modules');
if(!fs.existsSync(path.join(modules,'ws')))throw Error('Run Build.ps1 first to prepare verified runtime dependencies.');
for(const file of ['timing','bridge','control','efficiency','providers','matching','storage','lifetime','version']) {
  const result=spawnSync(process.execPath,[path.join(root,'tests',file+'.cjs')],{
    cwd:root,stdio:'inherit',env:{...process.env,NODE_PATH:modules},
  });
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
console.log('All regression suites passed.');
