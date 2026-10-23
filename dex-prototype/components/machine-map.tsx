"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { MapPin, Navigation } from "lucide-react";
import { type MachineJob, type MachinePoint } from "@/lib/machine";

type FieldFeature = Feature<Polygon | MultiPolygon>;
function fieldRoute(field:FieldFeature):MachinePoint[] {
  const polygons=field.geometry.type==="Polygon"?[field.geometry.coordinates]:field.geometry.coordinates;
  const points=polygons.flat(2),xs=points.map((p)=>p[0]),ys=points.map((p)=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const insideRing=(x:number,y:number,ring:number[][])=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
  const result:MachinePoint[]=[];
  for(let row=0;row<60;row++) {
    const y=(row+.5)/60;
    for(let col=0;col<80;col++) {
      const x=((row%2?79-col:col)+.5)/80,longitude=minX+x*(maxX-minX),latitude=maxY-y*(maxY-minY);
      if(polygons.some((rings)=>insideRing(longitude,latitude,rings[0])&&!rings.slice(1).some((ring)=>insideRing(longitude,latitude,ring))))result.push({x,y});
    }
  }
  return result.length?result:polygons[0][0].map((p)=>({x:(p[0]-minX)/(maxX-minX||1),y:(maxY-p[1])/(maxY-minY||1)}));
}
export function MachineMap({ job, progress, picking=false, position, onPosition, compact=false }: {
  job: MachineJob; progress: number; picking?: boolean; position?: MachinePoint; onPosition?: (p: MachinePoint) => void; compact?: boolean;
}) {
  const [data,setData]=useState<FeatureCollection|null>(null),[error,setError]=useState("");
  const clipId=useId().replaceAll(":","");
  useEffect(()=>{
    const controller=new AbortController();
    fetch((process.env.NEXT_PUBLIC_DEX_BASE_PATH||"")+"/data/field-map-data.geojson",{signal:controller.signal}).then((r)=>{if(!r.ok)throw new Error("Map unavailable");return r.json();}).then(setData).catch((e)=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Map unavailable");});
    return ()=>controller.abort();
  },[]);
  const features=(data?.features||[]).filter((f):f is FieldFeature=>f.geometry?.type==="Polygon"||f.geometry?.type==="MultiPolygon");
  const field=features.find((f)=>String(f.properties?.field_no)===job.item.fieldNo);
  const coordinates=(f:FieldFeature):number[][]=>f.geometry.type==="Polygon"?f.geometry.coordinates.flat():f.geometry.coordinates.flat(2);
  const fieldPoints=useMemo(()=>{const feature=data?.features.find((f)=>String(f.properties?.field_no)===job.item.fieldNo);return feature&&(feature.geometry?.type==="Polygon"||feature.geometry?.type==="MultiPolygon")?fieldRoute(feature as FieldFeature):[];},[data,job.item.fieldNo]);
  const points=field?coordinates(field):features.flatMap(coordinates);
  if(!data)return <div className="mc-map-loading">{error||"Loading estate map…"}</div>;
  if(!points.length)return <div className="mc-map-loading">No estate boundaries available.</div>;
  const xs=points.map((p)=>p[0]),ys=points.map((p)=>p[1]),left=Math.min(...xs),right=Math.max(...xs),bottom=Math.min(...ys),top=Math.max(...ys);
  const width=right-left||.001,height=top-bottom||.001,scale=Math.min(320/width,280/height),ox=(400-width*scale)/2,oy=(360-height*scale)/2;
  const project=(point:number[])=>[ox+(point[0]-left)*scale,oy+(top-point[1])*scale];
  const plot=(p:MachinePoint)=>project([left+p.x*width,top-p.y*height]);
  const path=(f:FieldFeature)=>{
    const polygons=f.geometry.type==="Polygon"?[f.geometry.coordinates]:f.geometry.coordinates;
    return polygons.map((polygon)=>polygon.map((ring)=>ring.map((p,i)=>{const [x,y]=project(p);return(i?"L":"M")+x.toFixed(2)+","+y.toFixed(2);}).join(" ")+"Z").join(" ")).join(" ");
  };
  const route=fieldPoints.slice(0,Math.max(1,Math.ceil(Math.max(0,Math.min(1,progress))*fieldPoints.length))),routePath=route.map((p,i)=>{const [x,y]=plot(p);return(i?"L":"M")+x+","+y;}).join(" ");
  const current=plot(route.at(-1)||{x:.5,y:.5}),pin=position?plot(position):null;
  return <div className={"mc-map "+(compact?"mc-map-compact":"")+(picking?" mc-map-picking":"")}>
    <div className="mc-map-caption"><MapPin size={12}/><strong>{job.item.fieldNo||"Estate map"} · E063</strong><span>Simulated GPS</span></div>
    <svg viewBox="0 0 400 360" role="img" aria-label={"Machine route snapshot for field "+job.item.fieldNo} onClick={picking&&field&&onPosition?(event)=>{
      const rect=event.currentTarget.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*400,y=(event.clientY-rect.top)/rect.height*360;
      onPosition({x:Math.max(0,Math.min(1,(x-ox)/(width*scale))),y:Math.max(0,Math.min(1,(y-oy)/(height*scale)))});
    }:undefined}>
      <defs><pattern id={"grid"+clipId} width="35" height="35" patternUnits="userSpaceOnUse"><path d="M 35 0 L 0 0 0 35" fill="none" stroke="#ffffff" strokeWidth=".5" opacity=".1"/></pattern>{field?<clipPath id={clipId}><path d={path(field)}/></clipPath>:null}</defs>
      <rect width="400" height="360" fill="#163e35"/><rect width="400" height="360" fill={"url(#grid"+clipId+")"}/>
      {features.map((f,index)=><path key={index} d={path(f)} fill={f===field?"#346e4e":"#244c40"} fillOpacity={f===field ? .75 : .45} stroke={f===field?"#a6c993":"#65836d"} strokeWidth={f===field?2:.8} strokeDasharray={f===field?"6 4":undefined}/>)}
      {field?<><path d={routePath} clipPath={"url(#"+clipId+")"} fill="none" stroke="#8af2b0" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
        {job.issues.map((issue,index)=>{const [x,y]=plot(issue.position);return <g key={issue.id} transform={"translate("+x+","+y+")"}><title>{issue.category}</title><circle r="10" fill="#f2bc47" stroke="#4b390e"/><text y="3.5" textAnchor="middle" fontSize="9" fill="#2d260f">{index+1}</text></g>;})}
        <g transform={"translate("+current[0]+","+current[1]+")"}><circle r="17" fill="#8af2b0" opacity=".15"/><circle r="8" fill="#8af2b0" stroke="white" strokeWidth="2"/><path d="M-3 3L0-5L3 3L0 1Z" fill="#16442c"/></g>
        {pin?<g transform={"translate("+pin[0]+","+pin[1]+")"}><circle r="13" fill="#f6c64a" stroke="white" strokeWidth="2"/><text y="5" textAnchor="middle" fontSize="18" fill="#483a17">+</text></g>:null}
      </>:<text x="200" y="180" textAnchor="middle" fill="white" fontSize="12">Field boundary unavailable · estate overview</text>}
    </svg>
    {picking?<p className="mc-map-hint"><Navigation size={12}/>Tap the map to place your issue pin.</p>:null}
  </div>;
}
