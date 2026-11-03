// Extract a small palette of flat, connected color regions for a fan motif.
// Reject photos and gradients that cannot be represented as a few polygons.
export function extractSurfaceRegions({ data, width, height }) {
  if (!data || data.length !== width * height * 4) throw new Error('生成图片无法读取。');
  const corners=[0,width-1,(height-1)*width,height*width-1];
  const background=[0,1,2].map(channel=>Math.round(corners.reduce((sum,index)=>sum+data[index*4+channel],0)/4));
  const foreground=new Uint8Array(width*height);
  const bins=new Map();
  let foregroundCount=0;
  for(let i=0;i<foreground.length;i++){
    const offset=i*4;
    if(data[offset+3]<100||distance(data,offset,background)<18)continue;
    foreground[i]=1;foregroundCount++;
    if(i%4)continue;
    const key=((data[offset]>>4)<<8)|((data[offset+1]>>4)<<4)|(data[offset+2]>>4);
    const bin=bins.get(key)||{count:0,sum:[0,0,0]};
    bin.count++;
    for(let channel=0;channel<3;channel++)bin.sum[channel]+=data[offset+channel];
    bins.set(key,bin);
  }
  if(foregroundCount<width*height*.015)throw new Error('图样主体过小或颜色太接近背景，请换主体更大的参考图。');
  if(foregroundCount>width*height*.7)throw new Error('图样主体与背景无法可靠区分。');
  const seeds=[];
  for(const bin of [...bins.values()].sort((a,b)=>b.count-a.count)){
    const color=bin.sum.map(sum=>sum/bin.count);
    if(seeds.every(seed=>colorDistance(color,seed)>45))seeds.push(color);
    if(seeds.length===6)break;
  }
  if(!seeds.length)throw new Error('没有识别到可编辑的图样色块。');
  let centers=seeds;
  for(let pass=0;pass<5;pass++){
    const sums=centers.map(()=>[0,0,0]),counts=centers.map(()=>0);
    for(let i=0;i<foreground.length;i+=4){
      if(!foreground[i])continue;
      const index=nearest(data,i*4,centers);
      counts[index]++;
      for(let channel=0;channel<3;channel++)sums[index][channel]+=data[i*4+channel];
    }
    centers=centers.map((center,index)=>counts[index]?sums[index].map(sum=>sum/counts[index]):center);
  }
  const masks=centers.map(()=>new Uint8Array(foreground.length));
  for(let i=0;i<foreground.length;i++)if(foreground[i])masks[nearest(data,i*4,centers)][i]=1;
  const minPixels=Math.max(45,Math.round(width*height*.00035));
  const regions=[];
  let keptPixels=0;
  for(let cluster=0;cluster<masks.length;cluster++){
    const components=componentsOf(masks[cluster],width,height,minPixels);
    for(const component of components){
      const points=trace(component,width,height);
      if(points.length<4)continue;
      const holes=holesOf(component,width,height,Math.max(25,Math.round(width*height*.0001)))
        .map(hole=>trace(hole,width,height)).filter(points=>points.length>=4);
      regions.push({points,holes,color:toHex(centers[cluster]),pixels:component.length});
      keptPixels+=component.length;
    }
  }
  // A light area can match the page background exactly yet still be part of
  // the motif when a thin outline encloses it (for example, a white dog face).
  // Close tiny gaps in that outline before finding interior background islands.
  for(const component of enclosedBackground(foreground,width,height,minPixels)){
    const points=trace(component,width,height);
    if(points.length<4)continue;
    const holes=holesOf(component,width,height,Math.max(25,Math.round(width*height*.0001)))
      .map(hole=>trace(hole,width,height)).filter(points=>points.length>=4);
    regions.push({points,holes,color:toHex(background),pixels:component.length});
  }
  if(!regions.length||regions.length>24||keptPixels<foregroundCount*.85)
    throw new Error('图样有过多细节或渐变，无法可靠转成完整的可编辑色块。');
  regions.sort((a,b)=>b.pixels-a.pixels);
  return {regions,backgroundColor:toHex(background)};
}

function enclosedBackground(foreground,width,height,minPixels){
  let closed=foreground;
  for(let pass=0;pass<2;pass++)closed=dilate(closed,width,height);
  for(let pass=0;pass<2;pass++)closed=erode(closed,width,height);
  const background=new Uint8Array(closed.length);
  for(let i=0;i<closed.length;i++)background[i]=closed[i]?0:1;
  const components=componentsOf(background,width,height,minPixels);
  return components.filter(component=>component.every(index=>{
    const x=index%width,y=Math.floor(index/width);
    return x>0&&x<width-1&&y>0&&y<height-1;
  }));
}

function dilate(mask,width,height){
  const out=new Uint8Array(mask.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const at=y*width+x;
    if(mask[at]){out[at]=1;continue;}
    for(let yy=Math.max(0,y-1);yy<=Math.min(height-1,y+1)&&!out[at];yy++)
      for(let xx=Math.max(0,x-1);xx<=Math.min(width-1,x+1);xx++)if(mask[yy*width+xx]){out[at]=1;break;}
  }
  return out;
}

function erode(mask,width,height){
  const out=new Uint8Array(mask.length);
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    let full=true;
    for(let yy=y-1;yy<=y+1&&full;yy++)for(let xx=x-1;xx<=x+1;xx++)if(!mask[yy*width+xx]){full=false;break;}
    if(full)out[y*width+x]=1;
  }
  return out;
}

function distance(data,offset,color){
  return Math.hypot(data[offset]-color[0],data[offset+1]-color[1],data[offset+2]-color[2]);
}
function colorDistance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}
function nearest(data,offset,centers){
  let chosen=0,best=Infinity;
  for(let i=0;i<centers.length;i++){
    const score=distance(data,offset,centers[i]);
    if(score<best){best=score;chosen=i;}
  }
  return chosen;
}
function toHex(color){return `#${color.map(value=>Math.round(value).toString(16).padStart(2,'0')).join('').toUpperCase()}`;}

function componentsOf(mask,width,height,minPixels){
  const seen=new Uint8Array(mask.length),result=[];
  for(let start=0;start<mask.length;start++){
    if(!mask[start]||seen[start])continue;
    const queue=[start];seen[start]=1;
    for(let head=0;head<queue.length;head++){
      const at=queue[head],x=at%width,y=Math.floor(at/width);
      for(const next of [x?at-1:-1,x<width-1?at+1:-1,y?at-width:-1,y<height-1?at+width:-1])
        if(next>=0&&mask[next]&&!seen[next]){seen[next]=1;queue.push(next);}
    }
    if(queue.length>=minPixels)result.push(queue);
  }
  return result;
}

function holesOf(component,width,height,minPixels){
  let minX=width,maxX=0,minY=height,maxY=0;
  for(const index of component){
    const x=index%width,y=Math.floor(index/width);
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);
    minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  const selected=new Uint8Array(width*height),seen=new Uint8Array(width*height),result=[];
  for(const index of component)selected[index]=1;
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const start=y*width+x;
    if(selected[start]||seen[start])continue;
    const queue=[start];seen[start]=1;let touchesEdge=false;
    for(let head=0;head<queue.length;head++){
      const at=queue[head],cx=at%width,cy=Math.floor(at/width);
      if(cx===minX||cx===maxX||cy===minY||cy===maxY)touchesEdge=true;
      for(const next of [cx>minX?at-1:-1,cx<maxX?at+1:-1,cy>minY?at-width:-1,cy<maxY?at+width:-1])
        if(next>=0&&!selected[next]&&!seen[next]){seen[next]=1;queue.push(next);}
    }
    if(!touchesEdge&&queue.length>=minPixels)result.push(queue);
  }
  return result;
}

function trace(component,width,height){
  const selected=new Uint8Array(width*height),edges=new Map();
  for(const index of component)selected[index]=1;
  const add=(ax,ay,bx,by)=>{const key=`${ax},${ay}`,list=edges.get(key)||[];list.push([bx,by]);edges.set(key,list);};
  for(const index of component){
    const x=index%width,y=Math.floor(index/width);
    if(!y||!selected[index-width])add(x,y,x+1,y);
    if(x===width-1||!selected[index+1])add(x+1,y,x+1,y+1);
    if(y===height-1||!selected[index+width])add(x+1,y+1,x,y+1);
    if(!x||!selected[index-1])add(x,y+1,x,y);
  }
  const start=[...edges.keys()].sort((a,b)=>{
    const [ax,ay]=a.split(',').map(Number),[bx,by]=b.split(',').map(Number);
    return ay-by||ax-bx;
  })[0];
  if(!start)return [];
  const ring=[];let key=start;
  for(let step=0;step<width*height*4;step++){
    const [x,y]=key.split(',').map(Number);ring.push({x,y});
    const next=edges.get(key)?.shift();
    if(!next)throw new Error('图样色块轮廓不连续。');
    key=`${next[0]},${next[1]}`;
    if(key===start)break;
  }
  if(key!==start)throw new Error('图样色块轮廓无法闭合。');
  const stride=Math.max(1,Math.ceil(ring.length/160));
  const sampled=ring.filter((_,index)=>index%stride===0);
  return [...sampled,sampled[0]];
}
