import type { Candidate, Carrier, CarrierRef, Point, SurfacePattern } from '../../model';
import { FORMAL_FAN_CARRIER_V1 } from '../../data/formalFanCarrier';
import { extractImageContour } from './imageContour.mjs';
import { extractSurfaceRegions } from './surfaceRegions.mjs';
import type { GeneratedImagePreview } from './imageTextApi';

export async function candidateFromGeneratedImage(preview: GeneratedImagePreview, carrier: Carrier, carrierRef: CarrierRef | null, generationRevision: number): Promise<Candidate> {
  const image = await loadImage(preview.imageUrl);
  const canvas = document.createElement('canvas');
  const sampleSize = 512;
  canvas.width = sampleSize; canvas.height = sampleSize;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('浏览器无法读取生成图片。');
  context.fillStyle = '#FFFFFF'; context.fillRect(0,0,sampleSize,sampleSize);
  const scale = Math.min(sampleSize/image.naturalWidth,sampleSize/image.naturalHeight);
  const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
  context.drawImage(image,(sampleSize-width)/2,(sampleSize-height)/2,width,height);
  const imageData=context.getImageData(0,0,sampleSize,sampleSize);
  const generationId=crypto.randomUUID();
  const sourceInputId=`generated-image-${preview.assetId}`;
  if(carrier==='fan'){
    if(!carrierRef)throw new Error('缺少扇面载体版本。');
    const surface=extractSurfaceRegions(imageData);
    const allPoints=surface.regions.flatMap(region=>[...region.points,...region.holes.flat()]);
    const place=fitTransform(allPoints,'fan');
    const palette=[...new Set([surface.backgroundColor,...surface.regions.map(region=>region.color)])]
      .map((color,index)=>({paletteId:`image-color-${index}`,color}));
    const paletteId=(color:string)=>palette.find(entry=>entry.color===color)!.paletteId;
    const elements:SurfacePattern['elements']=[];
    for(const [index,region] of surface.regions.entries()){
      elements.push({elementId:`${generationId}-region-${index}`,sourceInputId,kind:'polygon',paletteId:paletteId(region.color),zIndex:index*2+1,pointsMm:region.points.map(place)});
      for(const [holeIndex,hole] of region.holes.entries())elements.push({elementId:`${generationId}-hole-${index}-${holeIndex}`,sourceInputId,kind:'polygon',paletteId:paletteId(surface.backgroundColor),zIndex:index*2+2,pointsMm:hole.map(place)});
    }
    return {generationId,generationRevision,inputVersionId:preview.inputVersionId,status:'succeeded',generatorVersion:'image-surface-v0.3',issues:[],label:'图文生成表面图样候选',
      pointsMm:allPoints.map(place).map(point=>({x:point.x/210*260,y:point.y/297*150})),color:surface.regions[0].color,
      carrierRef,resultType:'surface_pattern',result:{patternId:`${generationId}-pattern`,
      coordinateSpace:FORMAL_FAN_CARRIER_V1.coordinateSpace,palette,elements,
      transform:{scale:1,rotationDeg:0,offsetMm:{x:0,y:0}}}};
  }
  const contour=extractImageContour(imageData, { smoothForCarrier: true });
  const pointsMm=fitContour(contour.points,carrier);
  const common={generationId,generationRevision,inputVersionId:preview.inputVersionId,status:'succeeded' as const,
    generatorVersion:'image-contour-v0.4',issues:[],label:'图文生成载体形状候选',
    pointsMm:pointsMm.map(point=>({x:point.x/210*260,y:point.y/297*150})),color:contour.color};
  return {...common,carrierRef:null,resultType:'carrier_shape',result:{shapeId:`${generationId}-shape`,
    coordinateSpace:FORMAL_FAN_CARRIER_V1.coordinateSpace,fillRule:'evenodd',
    components:[{componentId:`${generationId}-component-001`,outerBoundary:{closed:true,pointsMm},holes:[]}]}};
}

function fitContour(points:Point[],carrier:Carrier):Point[]{
  const place=fitTransform(points,carrier);
  return points.map(place);
}

function fitTransform(points:Point[],carrier:Carrier):(point:Point)=>Point{
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const width=maxX-minX,height=maxY-minY;
  if(width<8||height<8)throw new Error('识别出的轮廓过窄，无法形成有效图样。');
  const target=carrier==='fan'?{cx:105,cy:110,maxWidth:105,maxHeight:105}:{cx:105,cy:148.5,maxWidth:160,maxHeight:210};
  const scale=Math.min(target.maxWidth/width,target.maxHeight/height);
  return point=>({x:Math.round((target.cx+(point.x-(minX+maxX)/2)*scale)*100)/100,
    y:Math.round((target.cy+(point.y-(minY+maxY)/2)*scale)*100)/100});
}

function loadImage(url:string):Promise<HTMLImageElement>{
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error('生成图片无法加载。'));
    image.src=url;
  });
}
