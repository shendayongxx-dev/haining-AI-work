import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSurfaceRegions } from './surfaceRegions.mjs';

test('fan image keeps adjoining light and dark parts plus separate details', () => {
  const width=120,height=120,data=new Uint8ClampedArray(width*height*4);
  const paint=(x,y,color)=>{const at=(y*width+x)*4;data.set([...color,255],at);};
  const background=[250,250,252],orange=[230,170,108],cream=[244,233,223];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let color=background;
    if(x>=20&&x<100&&y>=20&&y<95)color=y<58?orange:cream;
    if(x>=46&&x<74&&y>=68&&y<79)color=orange;
    if((x>=35&&x<43||x>=77&&x<85)&&y>=42&&y<50)color=background;
    paint(x,y,color);
  }
  const result=extractSurfaceRegions({data,width,height});
  const colors=new Set(result.regions.map(region=>region.color));
  assert.ok(colors.has('#E6AA6C'));
  assert.ok(colors.has('#F4E9DF'));
  assert.ok(result.regions.some(region=>region.holes.length>=2));
  assert.ok(result.regions.some(region=>region.color==='#E6AA6C'&&region.pixels>2500));
  assert.ok(result.regions.some(region=>region.color==='#F4E9DF'&&region.pixels>2500));
});

test('white face enclosed by a thin dark outline is retained on a white page', () => {
  const width=120,height=120,data=new Uint8ClampedArray(width*height*4);
  const paint=(x,y,color)=>data.set([...color,255],(y*width+x)*4);
  const white=[252,252,252],black=[0,0,1];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let color=white;
    if(x>=20&&x<=100&&y>=20&&y<=95){
      if(y<58||x===20||x===100||y===95)color=black;
    }
    if(x>=55&&x<=65&&y>=65&&y<=71)color=black;
    if(x>=40&&x<=46&&y>=40&&y<=46)color=white;
    paint(x,y,color);
  }
  const result=extractSurfaceRegions({data,width,height});
  assert.ok(result.regions.some(region=>region.color==='#FCFCFC'&&region.pixels>2000));
  assert.ok(result.regions.some(region=>region.color==='#000001'&&region.pixels>2000));
});
