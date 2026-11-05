'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const source=fs.readFileSync(path.resolve(__dirname,'../.build/payload/spotify-lyrics-hud.js'),'utf8');
let socket,button;const sent=[];let title='Wait 4 U',artist='Westwood';
class FakeSocket {
 static OPEN=1;
 constructor(){socket=this;this.readyState=1;}
 send(raw){const m=JSON.parse(raw);sent.push(m);if(m.type==='request')queueMicrotask(()=>{
  let result;if(m.op==='md5')result=crypto.createHash('md5').update(m.args).digest('hex');
  else if(m.args.url.includes('lrclib.net'))result={trackName:title,artistName:artist,duration:180,syncedLyrics:'[00:01.00]First line\n[00:02.00]Second line'};
  else result={};this.onmessage?.({data:JSON.stringify({type:'reply',id:m.id,result})});
 });}
 close(){this.readyState=3;this.onclose?.();}
}
const player={data:{item:{uri:'spotify:track:fixture',metadata:{title,artist_name:artist}}},isPlaying:()=>true,getProgress:()=>1200,getDuration:()=>180000,addEventListener(){},removeEventListener(){}};
const sandbox={URL,TextDecoder,Uint8Array,atob,AbortController,console:{error(){}},setTimeout,clearTimeout,WebSocket:FakeSocket,document:{body:{},querySelector(){return null;}},Spicetify:{Player:player,Playbar:{Button:class {constructor(label,icon,click){this.click=click;this.element={};button=this;}}}},window:{addEventListener(){}}};
sandbox.window.Spicetify=sandbox.Spicetify;vm.runInNewContext(source,sandbox);socket.onopen();
const wait=()=>new Promise(r=>setTimeout(r,30));
(async()=>{await wait();let lyrics=sent.find(m=>m.type==='lyrics');assert.equal(lyrics.key,JSON.stringify([title,artist,180]));assert.equal(lyrics.lines.length,2);assert.equal(lyrics.source,'lrclib');
 button.click();assert.deepEqual(sent.at(-1),{type:'setEnabled',enabled:true});
 const before=sent.filter(m=>m.type==='request').length;socket.onmessage({data:'{"type":"getPlayback"}'});await wait();assert.equal(sent.filter(m=>m.type==='request').length,before);
 title='Another track';player.data.item.metadata.title=title;socket.onmessage({data:'{"type":"getPlayback"}'});await wait();assert.equal(sent.at(-1).key,JSON.stringify([title,artist,180]));
 console.log('PASS browser provider bundle: original strict matching, native RPC, current-track identity, cache, Spotify A toggle and playback bridge');
})().catch(e=>{console.error(e);process.exitCode=1;});
