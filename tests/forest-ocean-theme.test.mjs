import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const css=await readFile(new URL('../public/css/website-theme.css',import.meta.url),'utf8');
const palette=mode=>{
 const pattern=mode==='light'?/html\[data-theme\] \{([\s\S]*?)\}/:/html\[data-theme="dark"\] \{([\s\S]*?)\}/;
 return Object.fromEntries([...css.match(pattern)[1].matchAll(/(--[a-z-]+):\s*(#[0-9a-f]+);/g)].map(m=>[m[1],m[2]]));
};
function luminance(hex){if(hex.length===4)hex='#'+[...hex.slice(1)].map(c=>c+c).join('');const v=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];}
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
for(const mode of ['light','dark'])test(mode+' forest/ocean color pairs are readable',()=>{
 const p=palette(mode);
 for(const [ink,surface]of [['--ps-ink','--ps-canvas'],['--ps-ink','--ps-surface'],['--ps-muted','--ps-surface'],['--ps-muted','--ps-field'],['--ps-on-accent','--ps-accent'],['--ps-on-accent','--ps-accent-hover'],['--ps-selected-ink','--ps-selected-bg'],['--ps-ocean','--ps-surface'],['--ps-ocean','--ps-ocean-tint'],['--ps-header-ink','--ps-header-bg'],['--ps-header-highlight','--ps-header-bg']])assert.ok(ratio(p[ink],p[surface])>=4.5,mode+' '+ink+' on '+surface);
 assert.ok(ratio(p['--ps-control-border'],p['--ps-field'])>=3);
 assert.equal(p['--planning-text'],p['--ps-ink'],'Legacy planner foreground stays paired with its surface');
});
test('print remains neutral and primary actions use paired tokens',()=>{assert.match(css,/--planning-paper:white/);assert.match(css,/var\(--ps-on-accent\)/);assert.notEqual(palette('light')['--ps-canvas'],palette('dark')['--ps-canvas']);});
