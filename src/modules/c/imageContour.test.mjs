import test from 'node:test';
import assert from 'node:assert/strict';
import { extractImageContour } from './imageContour.mjs';

function image(width,height,paint){
  const data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    const color=paint(x,y)?[40,100,55]:[255,255,255];
    data.set([...color,255],i);
  }
  return {data,width,height};
}

test('extracts a closed outline from a single clear subject',()=>{
  const result=extractImageContour(image(64,64,(x,y)=>x>=16&&x<48&&y>=12&&y<52));
  assert.equal(result.color,'#286437');
  assert.deepEqual(result.points[0],result.points.at(-1));
  assert.ok(result.points.length>=5);
});

test('rejects absent or ambiguous foreground instead of inventing geometry',()=>{
  assert.throws(()=>extractImageContour(image(64,64,()=>false)),/清晰/);
  assert.throws(()=>extractImageContour(image(64,64,(x,y)=>x>2&&x<61&&y>2&&y<61)),/背景|主体/);
});

test('carrier smoothing removes small edge wiggles while keeping overall size',()=>{
  const rough=image(128,128,(x,y)=>{
    const radius=38+(Math.floor(y/3)%2?2:0);
    return Math.hypot(x-64,y-64)<radius;
  });
  const raw=extractImageContour(rough);
  const smooth=extractImageContour(rough,{smoothForCarrier:true});
  const bounds=points=>({width:Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),height:Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))});
  assert.ok(smooth.points.length<raw.points.length);
  assert.ok(Math.abs(bounds(raw.points).width-bounds(smooth.points).width)<6);
  assert.ok(Math.abs(bounds(raw.points).height-bounds(smooth.points).height)<6);
  assert.deepEqual(smooth.points[0],smooth.points.at(-1));
});

test('all custom carrier corners become rounded points',()=>{
  const rectangle=image(128,128,(x,y)=>x>=20&&x<108&&y>=24&&y<104);
  const result=extractImageContour(rectangle,{smoothForCarrier:true});
  const ring=result.points.slice(0,-1);
  const maxTurn=Math.max(...ring.map((point,i)=>{
    const prev=ring[(i-1+ring.length)%ring.length],next=ring[(i+1)%ring.length];
    const ax=point.x-prev.x,ay=point.y-prev.y,bx=next.x-point.x,by=next.y-point.y;
    return Math.acos(Math.max(-1,Math.min(1,(ax*bx+ay*by)/(Math.hypot(ax,ay)*Math.hypot(bx,by)))));
  }));
  assert.ok(maxTurn<Math.PI/3);
  assert.deepEqual(result.points[0],result.points.at(-1));
});
