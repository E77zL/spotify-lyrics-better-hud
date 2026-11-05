'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const runtime=path.join(root,'.build/HUD');
const app=path.join(runtime,'resources/app');
const archive=path.join(runtime,'resources/app.asar');
const buf=fs.readFileSync(archive);
const header=JSON.parse(buf.subarray(16,16+buf.readUInt32LE(12)));
const base=8+buf.readUInt32LE(4);
// Reuse only the verified upstream runtime dependencies. App code lives here
// once, under app/, and is copied without patching strings inside upstream code.
function unpack(node,relative='') {
  for(const [name,entry]of Object.entries(node.files||{})) {
    if(name==='..'||/[\\/]/.test(name)||entry.link||entry.unpacked)throw Error('Unexpected ASAR entry');
    const next=relative?relative+'/'+name:name;
    if(next!=='node_modules'&&!next.startsWith('node_modules/'))continue;
    if(entry.files)unpack(entry,next);
    else {
      const offset=base+Number(entry.offset);
      if(!Number.isSafeInteger(offset)||offset<base||offset+entry.size>buf.length)throw Error('Invalid ASAR offset');
      const target=path.join(app,next);fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.writeFileSync(target,buf.subarray(offset,offset+entry.size));
    }
  }
}
unpack(header);
fs.unlinkSync(archive);
fs.cpSync(path.join(root,'app'),app,{recursive:true});
fs.cpSync(path.join(root,'.build/ws/package'),path.join(app,'node_modules/ws'),{recursive:true});
for(const name of ['HUD-LICENSE.txt'])fs.copyFileSync(path.join(root,'licenses',name),path.join(runtime,name));
fs.copyFileSync(path.join(root,'NOTICE.txt'),path.join(runtime,'INTEGRATION-NOTICE.txt'));
fs.cpSync(path.join(root,'licenses'),path.join(runtime,'licenses'),{recursive:true});
console.log('Prepared Companion 1.2.2 using upstream HUD runtime 5.1.0.');
