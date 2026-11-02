import type { Point } from '../model';

export type Boundary =
  | {type:'circle';cx:number;cy:number;r:number}
  | {type:'ellipse';cx:number;cy:number;rx:number;ry:number}
  | {type:'polygon';pointsMm:number[][]};

const EPS = 1e-8;
function cross(a:Point,b:Point,c:Point){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
function onSegment(a:Point,b:Point,p:Point){return Math.abs(cross(a,b,p))<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;}
function segmentsMeet(a:Point,b:Point,c:Point,d:Point){
  const x1=cross(a,b,c),x2=cross(a,b,d),x3=cross(c,d,a),x4=cross(c,d,b);
  return (x1*x2<0&&x3*x4<0)||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}
function polygonPoints(boundary:Extract<Boundary,{type:'polygon'}>){return boundary.pointsMm.map(([x,y])=>({x,y}));}
function insidePolygon(p:Point,poly:Point[]){
  if(poly.some((a,i)=>onSegment(a,poly[(i+1)%poly.length],p)))return true;
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i].y>p.y)!==(poly[j].y>p.y)&&p.x<(poly[j].x-poly[i].x)*(p.y-poly[i].y)/(poly[j].y-poly[i].y)+poly[i].x)inside=!inside;
  return inside;
}
export function pointInBoundary(p:Point,b:Boundary){
  if(b.type==='circle')return Math.hypot(p.x-b.cx,p.y-b.cy)<=b.r+EPS;
  if(b.type==='ellipse')return ((p.x-b.cx)/b.rx)**2+((p.y-b.cy)/b.ry)**2<=1+EPS;
  return insidePolygon(p,polygonPoints(b));
}
function segmentIntersectsBoundary(a:Point,c:Point,b:Boundary){
  if(pointInBoundary(a,b)||pointInBoundary(c,b))return true;
  if(b.type==='polygon'){
    const v=polygonPoints(b);return v.some((p,i)=>segmentsMeet(a,c,p,v[(i+1)%v.length]));
  }
  const cx=b.cx,cy=b.cy,rx=b.type==='circle'?b.r:b.rx,ry=b.type==='circle'?b.r:b.ry;
  const ax=(a.x-cx)/rx,ay=(a.y-cy)/ry,dx=(c.x-a.x)/rx,dy=(c.y-a.y)/ry;
  const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy)));
  return (ax+t*dx)**2+(ay+t*dy)**2<=1+EPS;
}
export function geometryIntersectsBoundary(points:Point[],closed:boolean,b:Boundary){
  if(points.some(p=>pointInBoundary(p,b)))return true;
  for(let i=0;i<points.length-1;i++)if(segmentIntersectsBoundary(points[i],points[i+1],b))return true;
  if(closed&&points.length>2){
    if(segmentIntersectsBoundary(points.at(-1)!,points[0],b))return true;
    const center=b.type==='polygon'?{x:b.pointsMm.reduce((s,p)=>s+p[0],0)/b.pointsMm.length,y:b.pointsMm.reduce((s,p)=>s+p[1],0)/b.pointsMm.length}:{x:b.cx,y:b.cy};
    return insidePolygon(center,points);
  }
  return false;
}
export function geometryContainedByBoundary(points:Point[],b:Boundary){return points.every(p=>pointInBoundary(p,b));}
export function rectangleBoundary(xMin:number,yMin:number,xMax:number,yMax:number):Boundary{
  return{type:'polygon',pointsMm:[[xMin,yMin],[xMax,yMin],[xMax,yMax],[xMin,yMax]]};
}
