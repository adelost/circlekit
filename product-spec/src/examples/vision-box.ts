import { assertContractPayload, derive, field, port } from '../index.js';

/** Four distinct formats: shared numbers do not make their units or field meanings interchangeable. */
export const boxPx = {
  id:'vision.box',kind:'snapshot',boundary:'service-internal',
  fields:[field('left','number',{unit:'px'}),field('top','number',{unit:'px'}),
    field('right','number',{unit:'px',gteField:'left'}),
    field('bottom','number',{unit:'px',gteField:'top'})],
} as const;
export const xyxyPx = {...boxPx,id:'vision.xyxy.px'} as const;
export const xywhPx = {
  id:'vision.xywh.px',kind:'snapshot',boundary:'service-internal',
  fields:[field('x','number',{unit:'px'}),field('y','number',{unit:'px'}),
    field('width','number',{unit:'px',min:0}),field('height','number',{unit:'px',min:0})],
} as const;
export const yoloRatio = {
  id:'vision.yolo.cxcywh.ratio',kind:'snapshot',boundary:'service-internal',
  fields:[field('cx','number',{unit:'ratio',min:0,max:1}),field('cy','number',{unit:'ratio',min:0,max:1}),
    field('w','number',{unit:'ratio',min:0,max:1}),field('h','number',{unit:'ratio',min:0,max:1})],
} as const;
export const imageSizePx = {
  id:'vision.image-size.px',kind:'snapshot',boundary:'service-internal',
  fields:[field('width','number',{unit:'px',min:0}),field('height','number',{unit:'px',min:0})],
} as const;
export const visionContracts=[boxPx,xyxyPx,xywhPx,yoloRatio,imageSizePx] as const;

const runtime={stateOwner:'none',lifetime:'call',durability:'transient',clockDomain:'none',contextInputs:[],effects:[]} as const;
export const visionNormalizers=[
  derive({id:'vision.normalize-xyxy',inputs:[port('source',xyxyPx)],outputs:[port('box',boxPx)],runtime}),
  derive({id:'vision.normalize-xywh',inputs:[port('source',xywhPx)],outputs:[port('box',boxPx)],runtime}),
  derive({id:'vision.normalize-yolo',inputs:[port('source',yoloRatio),port('image',imageSizePx)],
    outputs:[port('box',boxPx)],runtime}),
] as const;

export type BoxPx={left:number;top:number;right:number;bottom:number};
export type XywhPx={x:number;y:number;width:number;height:number};
export type YoloRatio={cx:number;cy:number;w:number;h:number};
export type ImageSizePx={width:number;height:number};

export function normalizeXyxy(value:BoxPx):BoxPx {
  assertContractPayload(xyxyPx,value);
  const box={...value};assertContractPayload(boxPx,box);return box;
}
export function normalizeXywh(value:XywhPx):BoxPx {
  assertContractPayload(xywhPx,value);
  const box={left:value.x,top:value.y,right:value.x+value.width,bottom:value.y+value.height};
  assertContractPayload(boxPx,box);return box;
}
export function normalizeYolo(value:YoloRatio,image:ImageSizePx):BoxPx {
  assertContractPayload(yoloRatio,value);assertContractPayload(imageSizePx,image);
  const box={left:(value.cx-value.w/2)*image.width,top:(value.cy-value.h/2)*image.height,
    right:(value.cx+value.w/2)*image.width,bottom:(value.cy+value.h/2)*image.height};
  assertContractPayload(boxPx,box);return box;
}
