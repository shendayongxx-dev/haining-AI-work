// Conservative single-subject extraction for simple, high-contrast generated images.
// A rejected image stays on the confirmation page for revision; no sample geometry is substituted.
export function extractImageContour({ data, width, height }, { smoothForCarrier = false } = {}) {
  if (!data || width < 16 || height < 16 || data.length !== width * height * 4) throw new Error('生成图片无法读取。');
  const corners = [[0,0],[width-1,0],[0,height-1],[width-1,height-1]];
  const background = [0,1,2].map(channel => Math.round(corners.reduce((sum,[x,y]) => sum + data[(y*width+x)*4+channel],0)/4));
  const mask = new Uint8Array(width*height);
  for (let i=0;i<mask.length;i++) {
    const j=i*4;
    const distance=Math.hypot(data[j]-background[0],data[j+1]-background[1],data[j+2]-background[2]);
    if (data[j+3] > 100 && distance > 65) mask[i]=1;
  }
  const seen=new Uint8Array(mask.length);
  let best=[];
  let otherLarge=0;
  for(let i=0;i<mask.length;i++) {
    if(!mask[i]||seen[i])continue;
    const component=[]; const queue=[i]; seen[i]=1;
    for(let q=0;q<queue.length;q++){
      const at=queue[q]; component.push(at);
      const x=at%width,y=Math.floor(at/width);
      for(const next of [x>0?at-1:-1,x<width-1?at+1:-1,y>0?at-width:-1,y<height-1?at+width:-1])
        if(next>=0&&mask[next]&&!seen[next]){seen[next]=1;queue.push(next);}
    }
    if(component.length>best.length){if(best.length>width*height*.01)otherLarge++;best=component;}
    else if(component.length>width*height*.01)otherLarge++;
  }
  if(best.length<width*height*.015)throw new Error('没有识别到足够清晰的主体轮廓，请换背景更简单的参考图。');
  if(best.length>width*height*.75)throw new Error('图片主体与背景无法可靠区分，请简化图片后重试。');
  if(otherLarge)throw new Error('图片包含多个明显分离的主体，首版请使用单个主体。');
  const selected=new Uint8Array(mask.length); for(const index of best)selected[index]=1;
  const edges=new Map();
  function add(ax,ay,bx,by){const key=`${ax},${ay}`;const list=edges.get(key)||[];list.push([bx,by]);edges.set(key,list);}
  for(const at of best){const x=at%width,y=Math.floor(at/width);
    if(y===0||!selected[at-width])add(x,y,x+1,y);
    if(x===width-1||!selected[at+1])add(x+1,y,x+1,y+1);
    if(y===height-1||!selected[at+width])add(x+1,y+1,x,y+1);
    if(x===0||!selected[at-1])add(x,y+1,x,y);
  }
  const start=[...edges.keys()].sort((a,b)=>{const [ax,ay]=a.split(',').map(Number),[bx,by]=b.split(',').map(Number);return ay-by||ax-bx;})[0];
  if(!start)throw new Error('无法提取主体外轮廓。');
  const ring=[];let key=start;
  for(let step=0;step<width*height*4;step++){
    const [x,y]=key.split(',').map(Number);ring.push({x,y});
    const next=edges.get(key)?.shift();
    if(!next)throw new Error('主体轮廓不连续。');
    key=`${next[0]},${next[1]}`;
    if(key===start)break;
  }
  if(ring.length<8||key!==start)throw new Error('主体轮廓无法闭合。');
  const contourForUse=smoothForCarrier?smoothClosedRing(ring):ring;
  const simplified=simplifyClosed(contourForUse,smoothForCarrier?2.5:1.25);
  if(simplified.length<3)throw new Error('主体轮廓过于简单。');
  const rounded=smoothForCarrier?roundClosed(simplified,2):simplified;
  const points=[...rounded,rounded[0]];
  const color=[0,1,2].map(channel=>Math.round(best.reduce((sum,i)=>sum+data[i*4+channel],0)/best.length));
  return { points, color:`#${color.map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase()}`, imageSize:{width,height} };
}

function simplifyClosed(points,tolerance){
  // Keep the most distant point from the start, then simplify both arcs by
  // geometric error. Uniform subsampling discarded narrow tips and notches.
  let opposite=1;
  for(let i=2;i<points.length;i++)
    if(distanceSquared(points[0],points[i])>distanceSquared(points[0],points[opposite]))opposite=i;
  const first=points.slice(0,opposite+1);
  const second=[...points.slice(opposite),points[0]];
  let simplified=[];
  for(let allowedError=tolerance;allowedError<=6;allowedError*=1.4){
    simplified=[...simplifyOpen(first,allowedError),...simplifyOpen(second,allowedError).slice(1,-1)];
    if(simplified.length<=256)break;
  }
  return simplified;
}

function smoothClosedRing(points){
  // The raster boundary has one point per pixel edge. A short circular
  // Gaussian pass removes fur-scale steps while retaining broad peaks.
  const radius=9,sigma=3.5,weights=[];
  for(let offset=-radius;offset<=radius;offset++)weights.push(Math.exp(-(offset*offset)/(2*sigma*sigma)));
  const total=weights.reduce((sum,value)=>sum+value,0);
  return points.map((_,index)=>{
    let x=0,y=0;
    for(let offset=-radius;offset<=radius;offset++){
      const point=points[(index+offset+points.length)%points.length];
      const weight=weights[offset+radius];
      x+=point.x*weight;y+=point.y*weight;
    }
    return {x:x/total,y:y/total};
  });
}

function roundClosed(points,passes){
  let current=points;
  for(let pass=0;pass<passes;pass++){
    const next=[];
    for(let i=0;i<current.length;i++){
      const a=current[i],b=current[(i+1)%current.length];
      next.push({x:a.x*.75+b.x*.25,y:a.y*.75+b.y*.25});
      next.push({x:a.x*.25+b.x*.75,y:a.y*.25+b.y*.75});
    }
    current=next;
  }
  return current;
}

function simplifyOpen(points,tolerance){
  const keep=new Uint8Array(points.length);
  keep[0]=1;keep[points.length-1]=1;
  const stack=[[0,points.length-1]];
  const limit=tolerance*tolerance;
  while(stack.length){
    const [start,end]=stack.pop();
    let farthest=-1,maxDistance=limit;
    for(let i=start+1;i<end;i++){
      const distance=segmentDistanceSquared(points[i],points[start],points[end]);
      if(distance>maxDistance){maxDistance=distance;farthest=i;}
    }
    if(farthest>=0){keep[farthest]=1;stack.push([start,farthest],[farthest,end]);}
  }
  return points.filter((_,i)=>keep[i]);
}

function segmentDistanceSquared(point,start,end){
  const dx=end.x-start.x,dy=end.y-start.y;
  const length=dx*dx+dy*dy;
  if(!length)return distanceSquared(point,start);
  const t=Math.max(0,Math.min(1,((point.x-start.x)*dx+(point.y-start.y)*dy)/length));
  return distanceSquared(point,{x:start.x+t*dx,y:start.y+t*dy});
}

function distanceSquared(a,b){
  const dx=a.x-b.x,dy=a.y-b.y;
  return dx*dx+dy*dy;
}
