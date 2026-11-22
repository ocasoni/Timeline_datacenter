'use strict';
// Source: supplied SVG. Original x/y positions, text, image crops and links are preserved.
// Orthographic camera; x = chronology, y = categories, z = vertical images.
const DATA=window.TIMELINE_DATA;
const $=id=>document.getElementById(id),canvas=$('scene');let ctx=canvas.getContext('2d');const baseCtx=ctx,foregroundCanvas=$('foregroundScene'),foregroundCtx=foregroundCanvas.getContext('2d');
const camera={angle:Math.PI/6,elevation:Math.PI/7.5,zoom:1,panX:0,panY:0};
let width=innerWidth,height=innerHeight,scale=1,selected=null,hover=null,hits=[],moveMode=false,dirty=true,ready=false;
const categories=['Infrastrutture e risorse','Ecosistemi e clima','Comunità e decisioni'];
DATA.events.forEach((e,i)=>{e.index=i;e.category=e.category||categories[e.y<547?0:e.y<1085?1:2]});
const ordered=[...DATA.events].sort((a,b)=>a.x-b.x||a.y-b.y);
function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Impossibile leggere una delle immagini incorporate.'));im.src=src})}
function resize(){width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;foregroundCanvas.width=width*dpr;foregroundCanvas.height=height*dpr;baseCtx.setTransform(dpr,0,0,dpr,0,0);foregroundCtx.setTransform(dpr,0,0,dpr,0,0);fit();dirty=true}
function project(x,y,z=0){x-=2081;y=DATA.sceneHeight/2-y;const ca=Math.cos(camera.angle),sa=Math.sin(camera.angle),se=Math.sin(camera.elevation),ce=Math.cos(camera.elevation);const u=ca*x-sa*y,v=sa*x+ca*y;return {x:width/2+camera.panX+u*scale,y:height*.55+camera.panY+(-se*v-ce*(z-DATA.datacenters.z/2))*scale,depth:ce*v-se*z}}
function fit(){
 // Frame once against the default orientation: rotation must never change scale.
 const angle=Math.PI/6,elevation=Math.PI/7.5,ca=Math.cos(angle),sa=Math.sin(angle);
 const bw=ca*4450+sa*(DATA.sceneHeight+166),bh=Math.sin(elevation)*(sa*4450+ca*(DATA.sceneHeight+166))+Math.cos(elevation)*(450-DATA.datacenters.z);
 scale=Math.max(.025,Math.min((width-70)/bw,(height-165)/bh))*camera.zoom;
}
let wallOccluders=[],captureWallOccluders=false;
function recordWallOccluder(points){if(captureWallOccluders&&points.length>2&&points.every(p=>Number.isFinite(p.depth)))wallOccluders.push(points)}
function path(points,stroke,fill,lineWidth=1){if(fill)recordWallOccluder(points);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(points.length>2)ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke()}}
function texture(im,a,b,d){recordWallOccluder([a,b,{x:b.x+d.x-a.x,y:b.y+d.y-a.y,depth:b.depth+d.depth-a.depth},d]);ctx.save();ctx.transform((b.x-a.x)/im.width,(b.y-a.y)/im.width,(d.x-a.x)/im.height,(d.y-a.y)/im.height,a.x,a.y);ctx.drawImage(im,0,0);ctx.restore()}
function groundLabel(label){ctx.save();ctx.font=`${label.weight} ${label.size}px Inter`;const y=label.bandFrom!==undefined?(label.bandFrom+label.bandTo)/2+ctx.measureText(label.text).width/2:label.y;const theta=label.rotation*Math.PI/180,cs=Math.cos(theta),sn=Math.sin(theta),a=project(label.x,y,label.z||0),b=project(label.x+cs,y+sn,label.z||0),d=project(label.x-sn,y+cs,label.z||0);ctx.transform(b.x-a.x,b.y-a.y,d.x-a.x,d.y-a.y,a.x,a.y);ctx.fillStyle=label.color||'#ffffff';ctx.textAlign=label.align||'left';ctx.fillText(label.text,0,0);ctx.restore()}
// Direct links determine red outlines; connected components determine arrow navigation.
let activeCrossLayerNavigation=null;
function crossLayerCards(wire){const first=DATA.events.find(e=>e.id===wire.source);const second=wire.targetLayer===2?co2DataCard:wire.targetLayer===5?mapCard():datacenterCard(DATA.datacenters.towns.find(t=>t.code===wire.town));return [first,second]}
function crossLayerHitCard(index){const wire=crossLayerWireState[index],cards=crossLayerCards(wire),target=cards[1].title+(wire.targetTown?' · '+wire.targetTown:'');return {id:'cross-wire-'+index,wireIndex:index,category:'Collegamento · Layer 1 → Layer '+wire.targetLayer,title:cards[0].title+' → '+target}}
function openCrossLayerConnection(index){const wire=crossLayerWireState[index];if(!wire)return;activeCrossLayerNavigation={wireIndex:index,endpoint:0};openEvent(crossLayerCards(wire)[0],true)}
function neighbors(id){const ids=new Set();for(const link of DATA.connections)for(let i=1;i<link.events.length;i++){const a=link.events[i-1],b=link.events[i];if(a===id)ids.add(b);if(b===id)ids.add(a)}return ids}
function linkedGroup(id){const seen=new Set([id]),queue=[id];for(let i=0;i<queue.length;i++)for(const next of neighbors(queue[i]))if(!seen.has(next)){seen.add(next);queue.push(next)}const ordered=[];for(const link of DATA.connections)for(const key of link.events)if(seen.has(key)&&!ordered.includes(key))ordered.push(key);return ordered.length?ordered:[id]}
function isHighlighted(e){return !!selected&&(selected.id===e.id||neighbors(selected.id).has(e.id))}
function updateLinkedNav(){if(activeCrossLayerNavigation){const {wireIndex,endpoint}=activeCrossLayerNavigation,cards=crossLayerCards(crossLayerWireState[wireIndex]);$('linkedNav').hidden=false;$('linkedPrev').disabled=endpoint===0;$('linkedNext').disabled=endpoint===1;$('linkedPrev').title=cards[0].title;$('linkedNext').title=cards[1].title;return}const group=selected?linkedGroup(selected.id):[],i=selected?group.indexOf(selected.id):-1;$('linkedNav').hidden=group.length<2;$('linkedPrev').disabled=i<=0;$('linkedNext').disabled=i>=group.length-1;for(const [button,offset] of [['linkedPrev',-1],['linkedNext',1]]){const target=DATA.events.find(e=>e.id===group[i+offset]);$(button).title=target?target.title:''}}
function navigateLinked(direction){if(activeCrossLayerNavigation){const next=activeCrossLayerNavigation.endpoint+direction;if(next<0||next>1)return;activeCrossLayerNavigation.endpoint=next;openEvent(crossLayerCards(crossLayerWireState[activeCrossLayerNavigation.wireIndex])[next],true);return}if(!selected)return;const group=linkedGroup(selected.id),i=group.indexOf(selected.id),id=group[i+direction];if(id)openEvent(DATA.events.find(e=>e.id===id))}
$('linkedPrev').onclick=()=>navigateLinked(-1);$('linkedNext').onclick=()=>navigateLinked(1);
function billboard(e){
 const w=e.image?e.w:260,h=e.image?e.h:108,cx=e.image?e.x+e.w/2:e.x+130,base=project(cx,e.y,0);
 const left=base.x-w*scale/2,top=base.y-h*scale;
 const poly=[{x:left,y:top},{x:left+w*scale,y:top},{x:left+w*scale,y:base.y},{x:left,y:base.y}];
 // Screen-facing up vector expressed in world coordinates; link anchors use the same geometry.
 const se=Math.sin(camera.elevation),ce=Math.cos(camera.elevation),sa=Math.sin(camera.angle),ca=Math.cos(camera.angle);
 return {e,w,h,cx,base,poly,anchor:{x:cx+h*se*sa,y:e.y-h*se*ca,z:h*ce},depth:base.depth};
}
function titleLines(text,maxWidth){const words=text.split(/\s+/),lines=[];let line='';for(const word of words){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>maxWidth){lines.push(line);line=word}else line=next}if(line)lines.push(line);return lines}
function co2GrowthTarget(){
 // Spread the full growth over the whole tilt from overhead to the default axonometric view.
 const progress=Math.max(0,Math.min(1,(Math.PI/2-camera.elevation)/(Math.PI/2-Math.PI/7.5)));
 return progress*progress*progress*(progress*(progress*6-15)+10);
}
let co2Growth=co2GrowthTarget(),co2AnimationTime=Date.now();
let co2VolumeState={factor:co2Growth,minZ:DATA.co2.z,maxZ:DATA.co2.z};
let energyVolumeState={factor:co2Growth,minZ:DATA.energy.z,maxZ:DATA.energy.z};
let populationVolumeState={factor:co2Growth,minZ:DATA.population.z,maxZ:DATA.population.z};
function volumeGeometry(kind){
 const energy=kind==='energy',population=kind==='population',graph=population?DATA.population:energy?DATA.energy:DATA.co2,z=graph.z,factor=co2Growth;
 const points=population?graph.points.map(p=>[p.x,p.y]):energy?graph.markers.map(p=>[p.x,p.y]):graph.paths.filter(p=>p.seasonal).flatMap(p=>p.points).sort((a,b)=>a[0]-b[0]);
 const baseline=(energy||population)?graph.bottom:Number(graph.ticks.find(t=>t.text==='300').y),peak=energy?graph.top:Math.min(...points.map(p=>p[1]));
 const vertices=points.map(([x,y])=>{const relative=Math.max(0,Math.min(1,(baseline-y)/(baseline-peak)));return {x,y,z:z+(-DATA.co2.z)*.8*relative*factor}});
 const state={factor,targetFactor:co2GrowthTarget(),heightCap:.8,minZ:z,maxZ:Math.max(z,...vertices.map(v=>v.z)),vertexCount:vertices.length};
 if(population)populationVolumeState=state;else if(energy)energyVolumeState=state;else co2VolumeState=state;
 return {kind,z,vertices,factor,color:graph.color,rgb:(energy||population)?graph.rgb:'36,99,255'};
}
const co2DataCard={id:'graph-co2-indicators',category:'Layer 2 · Dati e indicatori',title:'Curva di Keeling',texts:[DATA.co2.description,"Indicatore: concentrazione atmosferica di anidride carbonica a livello globale.\nUnità di misura: parti per milione (ppm)."]};
const energySourceCard={id:'graph-energy-sources',category:'Layer 3 · Dati e indicatori',title:'Consumo di elettricità dei data center',texts:[DATA.energy.sources[3],'Simboli dei rilevamenti\n● Koomey\n■ Masanet et al.\n▲ IEA']};
const populationSourceCard={id:'graph-population-sources',category:'Layer 4 · Dati e indicatori',title:'Aumento demografico',texts:[DATA.population.sources[1],DATA.population.sources[0]]};
function energyMarker(point,kind,size,color=DATA.energy.color){ctx.beginPath();if(kind==='circle')ctx.arc(point.x,point.y,size,0,Math.PI*2);else if(kind==='square')ctx.rect(point.x-size,point.y-size,size*2,size*2);else{ctx.moveTo(point.x,point.y-size*1.2);ctx.lineTo(point.x+size,point.y+size*.8);ctx.lineTo(point.x-size,point.y+size*.8);ctx.closePath()}ctx.fillStyle=color;ctx.fill()}
function renderVolumes(){
 const volumes=[volumeGeometry('co2'),volumeGeometry('energy'),volumeGeometry('population')],faces=[];
 for(const volume of volumes){if(volume.factor<.001)continue;for(let i=1;i<volume.vertices.length;i++){const a=volume.vertices[i-1],b=volume.vertices[i];faces.push({a,b,volume,depth:project((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z+2*volume.z)/4).depth})}}
 faces.sort((a,b)=>b.depth-a.depth);
 for(const {a,b,volume:v} of faces){const poly=[project(a.x,a.y,v.z),project(b.x,b.y,v.z),project(b.x,b.y,b.z),project(a.x,a.y,a.z)];path(poly,null,`rgba(${v.rgb},${.24*v.factor})`);if(v.kind==='co2')hits.push({e:co2DataCard,poly});else if(v.kind==='energy')hits.push({e:energySourceCard,poly});else if(v.kind==='population')hits.push({e:populationSourceCard,poly})}
 for(const volume of volumes){const {vertices,z,factor,color,rgb,kind}=volume;if(factor<.001)continue;
  for(let i=0;i<vertices.length;i+=kind==='energy'?1:kind==='population'?2:12){const v=vertices[i];path([project(v.x,v.y,z),project(v.x,v.y,v.z)],`rgba(${rgb},${.36*factor})`,null,.8)}
  ctx.beginPath();vertices.forEach((v,i)=>{const p=project(v.x,v.y,v.z);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y)});ctx.strokeStyle=color;ctx.lineWidth=Math.max(1.3,5*scale);if(kind==='energy')ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);
  for(const v of [vertices[0],vertices[vertices.length-1]])path([project(v.x,v.y,z),project(v.x,v.y,v.z)],color,null,1.1);
  if(kind==='energy')vertices.forEach((v,i)=>energyMarker(project(v.x,v.y,v.z),DATA.energy.markers[i].kind,Math.max(2,10*scale)));
  if(kind==='population')for(const v of [vertices[0],vertices[vertices.length-1]])energyMarker(project(v.x,v.y,v.z),'circle',Math.max(2,10*scale),color);
 }
}
function renderEnergyFloor(){const z=DATA.energy.z;path([[0,0],[4162,0],[4162,DATA.sceneHeight],[0,DATA.sceneHeight]].map(p=>project(p[0],p[1],z)),'#ffffff30',planeFill())}
function renderEnergyGraph(){
 const graph=DATA.energy,z=graph.z;
 for(let i=0;i<=5;i++){const value=i*100,y=graph.bottom+(graph.top-graph.bottom)*i/5;path([project(140,y,z),project(4100,y,z)],'#4ebbff22',null,.6);groundLabel({text:String(value),x:118,y:y+13,z,rotation:0,size:36,weight:'500',align:'right',color:graph.color})}
 for(const year of graph.yearLabels){path([project(year.x,250,z),project(year.x,2230,z)],'#4ebbff18',null,.6);groundLabel({...year,z})}
 groundLabel({text:'Consumo di elettricità dei data center',x:-420,y:0,z,rotation:-90,size:44,weight:'800',bandFrom:250,bandTo:2230,color:graph.color});
 groundLabel({text:'(TWH/anno) - globale',x:-360,y:0,z,rotation:-90,size:44,weight:'800',bandFrom:250,bandTo:2230,color:graph.color});
 ctx.beginPath();for(const vertex of graph.segments){const p=project(vertex.x,vertex.y,z);if(vertex.move)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y)}ctx.strokeStyle=graph.color;ctx.lineWidth=Math.max(1.2,5*scale);ctx.stroke();
 for(const [i,marker] of graph.markers.entries()){const p=project(marker.x,marker.y,z);energyMarker(p,marker.kind,Math.max(2,10*scale));hits.push({e:energySourceCard,p,r:10});if(i){const previous=graph.markers[i-1];hits.push({e:energySourceCard,a:project(previous.x,previous.y,z),b:p,r:9})}}
 for(const label of graph.values)groundLabel({...label,z,rotation:0,size:34,weight:'800',color:graph.color});

}
function overheadBlend(){const t=Math.max(0,Math.min(1,(camera.elevation-65*Math.PI/180)/(25*Math.PI/180)));return t*t*(3-2*t)}
function planeFill(normalOpacity=1){return `rgba(41,43,48,${normalOpacity+(.035-normalOpacity)*overheadBlend()})`}
function renderPopulationFloor(){const z=DATA.population.z;path([[0,0],[4162,0],[4162,DATA.sceneHeight],[0,DATA.sceneHeight]].map(p=>project(p[0],p[1],z)),'#ffffff30',planeFill())}
function renderPopulationGraph(){
 const graph=DATA.population,z=graph.z;
 for(let value=0;value<=8;value++){const y=graph.bottom+(graph.top-graph.bottom)*value/8;path([project(140,y,z),project(4100,y,z)],'#8aa6ff22',null,.6);groundLabel({text:String(value),x:118,y:y+13,z,rotation:0,size:36,weight:'500',align:'right',color:graph.color})}
 for(const year of graph.yearLabels){path([project(year.x,250,z),project(year.x,2230,z)],'#8aa6ff18',null,.6);groundLabel({...year,z})}
 groundLabel({text:'Popolazione mondiale',x:-690,y:0,z,rotation:-90,size:44,weight:'800',bandFrom:250,bandTo:2230,color:graph.color});
 groundLabel({text:'(Miliardi di persone)',x:-630,y:0,z,rotation:-90,size:44,weight:'800',bandFrom:250,bandTo:2230,color:graph.color});
 ctx.beginPath();graph.points.forEach((v,i)=>{const p=project(v.x,v.y,z);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y)});ctx.strokeStyle=graph.color;ctx.lineWidth=Math.max(1.2,5*scale);ctx.stroke();
 for(let i=1;i<graph.points.length;i++){const a=graph.points[i-1],b=graph.points[i];hits.push({e:populationSourceCard,a:project(a.x,a.y,z),b:project(b.x,b.y,z),r:9})}
 for(const marker of graph.markers){const p=project(marker.x,marker.y,z);energyMarker(p,'circle',Math.max(2,10*scale),graph.color);hits.push({e:populationSourceCard,p,r:10})}
 for(const label of graph.values)groundLabel({...label,z,rotation:0,size:34,weight:'800',color:graph.color});
}
function renderCo2(){
 const z=DATA.co2.z,corners=[[0,0],[4162,0],[4162,DATA.sceneHeight],[0,DATA.sceneHeight]].map(p=>project(p[0],p[1],z));
 path(corners,'#ffffff30',planeFill());
 for(const tick of DATA.co2.ticks){path([project(140,tick.y,z),project(4100,tick.y,z)],'#ffffff22',null,.7);groundLabel({text:tick.text,x:118,y:tick.y+13,z,rotation:0,size:38,weight:'500',align:'right'})}
 for(const year of DATA.co2.yearLabels){path([project(year.x,250,z),project(year.x,2230,z)],'#ffffff20',null,.7);groundLabel({...year,z})}
 groundLabel({text:'Quantità di anidride carbonica',x:-150,y:0,z,rotation:-90,size:44,weight:'800',bandFrom:250,bandTo:2230});
 groundLabel({text:'(Parti per milione)  - golobale',x:-90,y:0,z,rotation:-90,size:44,weight:'800',bandFrom:250,bandTo:2230});
 for(const curve of [...DATA.co2.paths].sort((a,b)=>a.seasonal-b.seasonal)){ctx.beginPath();curve.points.forEach(([x,y],i)=>{const p=project(x,y,z);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y)});ctx.strokeStyle=DATA.co2.color;ctx.globalAlpha=curve.seasonal?1:.65;ctx.lineWidth=Math.max(curve.seasonal?1.1:1.5,(curve.seasonal?4:5)*scale);ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();ctx.globalAlpha=1}

 for(const curve of DATA.co2.paths)for(let i=1;i<curve.points.length;i++){const a=curve.points[i-1],b=curve.points[i];hits.push({e:co2DataCard,a:project(a[0],a[1],z),b:project(b[0],b[1],z),r:8})}
 // Shared vertical guides make the stack legible without moving the chronological axes.
 ctx.setLineDash([3,6]);for(const [x,y] of [[0,0],[4162,0],[4162,DATA.sceneHeight],[0,DATA.sceneHeight]])path([project(x,y,0),project(x,y,DATA.population.z)],'#ffffff24',null,.8);ctx.setLineDash([]);
}
let activeMapView=0;
let dcColumnState={factor:co2Growth,phaseHeights:[],parts:0,maxZ:DATA.datacenters.z};
function datacenterCard(town=null){return {id:'layer6-datacenters',category:'Layer 6 · Data center - Finlandia',title:DATA.datacenters.title,focusTown:town?.code||null,texts:[...DATA.datacenters.sources,...DATA.datacenters.notes]}}
function renderDatacenterFloor(){
 const graph=DATA.datacenters,z=graph.z,corners=[[0,0],[4162,0],[4162,DATA.sceneHeight],[0,DATA.sceneHeight]].map(p=>project(p[0],p[1],z));path(corners,'#ffffff30',planeFill());
 path(graph.countryPoints.map(p=>project(p[0],p[1],z)),'#8B99B3','#303845',.8);

 hits.push({e:datacenterCard(),poly:corners});
 for(const town of graph.towns)for(const part of town.parts){const phase=graph.phases[part.phase],poly=part.worldPoints.map(p=>project(p[0],p[1],z));path(poly,'#ffffff44',phase.color,.5);hits.push({e:datacenterCard(town),poly})}
 ctx.setLineDash([3,8]);for(const [x,y] of [[0,0],[4162,0],[4162,DATA.sceneHeight],[0,DATA.sceneHeight]])path([project(x,y,DATA.maps.z),project(x,y,z)],'#ffffff20',null,.8);ctx.setLineDash([]);
}
function renderDatacenterColumns(section){
 const graph=DATA.datacenters,z=graph.z,divider=DATA.maps.z,faces=[],factor=co2Growth;
 dcColumnState={factor,phaseHeights:graph.phases.map(p=>p.height*factor),parts:graph.towns.reduce((n,t)=>n+t.parts.length,0),maxZ:z+Math.max(...graph.phases.map(p=>p.height))*factor,layerGap:divider-z};
 if(factor<.0001)return;
 for(const town of graph.towns)for(const part of town.parts){
  const phase=graph.phases[part.phase],top=z+phase.height*factor,low=section==='lower'?z:Math.max(z,divider),high=section==='lower'?Math.min(top,divider):top;
  if(high<=low+.0001)continue;const points=part.worldPoints;
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(Math.hypot(a[0]-b[0],a[1]-b[1])<.001)continue;faces.push({town,phase,poly:[project(a[0],a[1],low),project(b[0],b[1],low),project(b[0],b[1],high),project(a[0],a[1],high)],depth:project((a[0]+b[0])/2,(a[1]+b[1])/2,(low+high)/2).depth,top:false})}
  if(Math.abs(high-top)<.001){const center=town.worldCenter;faces.push({town,phase,poly:points.map(p=>project(p[0],p[1],top)),depth:project(center[0],center[1],top).depth,top:true})}
 }
 faces.sort((a,b)=>b.depth-a.depth);
 for(const face of faces){ctx.save();ctx.globalAlpha=face.top ? .98 : .78;path(face.poly,'#dce8ff66',face.phase.color,face.top ? .9 : .45);ctx.restore();hits.push({e:datacenterCard(face.town),poly:face.poly})}
}
function mapCard(){const view=DATA.maps.views[activeMapView];return {id:'layer5-map',category:'Layer 5 · Cincia alpestre - Finlandia',title:'Nidificazione della cincia alpestre',subtitle:view.title.replace('ATLANTE ORNITOLOGICO ',''),image:view.portraitImage,links:DATA.maps.links,texts:[DATA.maps.description,...view.sources]}}
function renderMapLayer(){
 const z=DATA.maps.z,view=DATA.maps.views[activeMapView];const corners=[[0,0],[4162,0],[4162,DATA.sceneHeight],[0,DATA.sceneHeight]].map(p=>project(p[0],p[1],z));path(corners,'#ffffff30',planeFill());
 groundLabel({text:'CINCIA ALPESTRE · FINLANDIA',x:220,y:145,z,rotation:0,size:60,weight:'700'});
 groundLabel({text:view.title,x:220,y:230,z,rotation:0,size:44,weight:'500'});
 groundLabel({text:'Parus montanus · celle 10 × 10 km',x:220,y:295,z,rotation:0,size:34,weight:'400'});
 const mapRect=[[480,400],[3680,400],[3680,2232],[480,2232]].map(p=>project(p[0],p[1],z));texture(view.bitmap,mapRect[0],mapRect[1],mapRect[3]);
 path([project(3710,290,z),project(3880,290,z)],'#B7D2FF',null,1.1);path([project(3850,270,z),project(3880,290,z),project(3850,310,z)],'#B7D2FF',null,1.1);groundLabel({text:'N',x:3915,y:302,z,rotation:0,size:36,weight:'700'});
 const names=['Confermata','Probabile','Possibile'];for(let i=0;i<3;i++){const x=250+i*1050;path([[x,2310],[x+48,2310],[x+48,2358],[x,2358]].map(p=>project(p[0],p[1],z)),null,DATA.maps.colors[i]);groundLabel({text:names[i]+' · '+view.counts[i],x:x+75,y:2350,z,rotation:0,size:40,weight:'500'})}
 groundLabel({text:'Totale · '+view.counts[3]+' celle',x:3430,y:2350,z,rotation:0,size:38,weight:'500'});
 hits.push({e:mapCard(),poly:corners});
 ctx.setLineDash([3,8]);for(const [x,y] of [[0,0],[4162,0],[4162,DATA.sceneHeight],[0,DATA.sceneHeight]])path([project(x,y,DATA.population.z),project(x,y,z)],'#ffffff20',null,.8);ctx.setLineDash([]);
}
function syncMapControls(){$('mapView1').checked=activeMapView===0;$('mapView2').checked=activeMapView===1;$('mapCompare').setAttribute('aria-expanded',String(selected?.id==='layer5-comparison'&&!$('detail').hidden))}
function selectMapView(index){activeMapView=index;if(selected?.id==='layer5-map')openEvent(mapCard(),!!activeCrossLayerNavigation);syncMapControls();hideTip();dirty=true}
$('mapView1').onchange=()=>selectMapView(0);$('mapView2').onchange=()=>selectMapView(1);
function openMapComparison(){DATA.maps.views.forEach((view,i)=>{$('mapComparisonImage'+(i+1)).src=view.portraitImage});openEvent({id:'layer5-comparison',category:'Layer 5 · Cincia alpestre - Finlandia',title:'Nidificazione della cincia alpestre',subtitle:'2006–2010 / 2022–2025',links:DATA.maps.links,texts:[DATA.maps.description,...new Set(DATA.maps.views.flatMap(v=>v.sources))]});$('detail').setAttribute('data-layout','comparison');$('mapComparePanel').hidden=false;syncMapControls()}
$('mapCompare').onclick=()=>{if(selected?.id==='layer5-comparison'&&!$('detail').hidden)closeDetail();else openMapComparison()};
let crossLayerWireState=[];
function buildCrossLayerWires(){
 const levels=[0,DATA.co2.z,DATA.energy.z,DATA.population.z,DATA.maps.z,DATA.datacenters.z];
 return DATA.crossLayerConnections.map(spec=>{
  const event=DATA.events.find(e=>e.id===spec.source),start=billboard(event).anchor;
  const town=spec.town?DATA.datacenters.towns.find(t=>t.code===spec.town):null;
  const target=town?{x:town.worldCenter[0],y:town.worldCenter[1],z:DATA.datacenters.z+Math.max(...town.parts.map(p=>DATA.datacenters.phases[p.phase].height))*co2Growth}:{x:spec.targetX??2200,y:spec.targetY??0,z:spec.targetLayer===2?DATA.co2.z:DATA.maps.z};
  const nextPlane=levels.filter(z=>z>target.z+.001).sort((a,b)=>a-b)[0];
  const clearance=Math.min(420,Math.max(.1,((nextPlane??(target.z+400))-target.z)*.4));
  const upperZ=Math.max(240,start.z+130),entryZ=target.z+clearance,behind=spec.side==='behind',outsideX=spec.side==='left'?-spec.offset:4162+spec.offset;
  const exit=behind?{x:start.x,y:-spec.offset,z:upperZ}:{x:outsideX,y:start.y,z:upperZ};
  const entry=behind?{x:target.x,y:-spec.offset,z:entryZ}:{x:outsideX,y:target.y,z:entryZ};
  const departure=[start,{...start,z:upperZ},exit];
  const descent=[exit,{...exit,z:entryZ},entry];
  const landing=[entry,{...target,z:entryZ},target];
  return {...spec,targetTown:town?.name||null,start,target,segments:[departure,descent,landing]};
 });
}
function strokeCrossLayerSegments(segments,wireIndex){
 ctx.beginPath();const start=project(segments[0][0].x,segments[0][0].y,segments[0][0].z);ctx.moveTo(start.x,start.y);
 for(const segment of segments)for(const point of segment.slice(1)){const p=project(point.x,point.y,point.z);ctx.lineTo(p.x,p.y)}
 ctx.lineCap='butt';ctx.lineJoin='miter';ctx.miterLimit=3;ctx.strokeStyle='#3B330A';ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle='#FFD600';ctx.lineWidth=hover?.wireIndex===wireIndex?1.6:.95;ctx.stroke();
 if(wireIndex!==undefined){const e=crossLayerHitCard(wireIndex);for(const segment of segments)for(let i=1;i<segment.length;i++)hits.push({e,a:project(segment[i-1].x,segment[i-1].y,segment[i-1].z),b:project(segment[i].x,segment[i].y,segment[i].z),r:7})}
}
function strokeCrossLayerSegment(segment,wireIndex){strokeCrossLayerSegments([segment],wireIndex)}
function renderCrossLayerWires(pass){
 if(pass==='behind'){crossLayerWireState=buildCrossLayerWires();for(const [index,wire] of crossLayerWireState.entries())if(wire.side==='behind')strokeCrossLayerSegment(wire.segments[1],index);return}
 for(const [index,wire] of crossLayerWireState.entries()){if(wire.side!=='behind')strokeCrossLayerSegments(wire.segments,index);else{strokeCrossLayerSegment(wire.segments[0],index);strokeCrossLayerSegment(wire.segments[2],index)}
  for(const point of [wire.start,wire.target]){const p=project(point.x,point.y,point.z);ctx.beginPath();ctx.arc(p.x,p.y,1.7,0,Math.PI*2);ctx.fillStyle='#FFD600';ctx.fill()}
 }
}
let macroBlockTitleState=[];
function renderMacroBlockTitles(){
 const groups=[{text:'Eventi',z:0},{text:'Dati e indicatori',z:(DATA.co2.z+DATA.energy.z+DATA.population.z)/3},{text:'Non-humans',z:(DATA.maps.z+DATA.datacenters.z)/2}];
 const opacity=1-overheadBlend(),fontSize=Math.min(52,Math.max(20,220*scale));
 ctx.save();ctx.font=`600 ${fontSize}px Inter`;ctx.textAlign='left';ctx.textBaseline='middle';ctx.globalAlpha=opacity;ctx.fillStyle='#999DA7';ctx.shadowColor='#17181bcc';ctx.shadowBlur=7;ctx.shadowOffsetY=1;
 const labelWidth=Math.max(...groups.map(g=>ctx.measureText(g.text).width)),distance=labelWidth/scale+600;
 // A billboard extends to the left of a fixed layer corner, along the camera's horizontal axis.
 // Its world height matches the layer, so the title cannot drift vertically when rotating.
 const worldX=-distance*Math.cos(camera.angle),worldY=-distance*Math.sin(camera.angle);
 macroBlockTitleState=groups.map(group=>{const worldZ=group.z,point=project(worldX,worldY,worldZ);ctx.fillText(group.text,point.x,point.y);return {...group,worldX,worldY,worldZ,x:point.x,y:point.y,fontSize,opacity}});
 ctx.restore();
}
let imaginationWallState=[];
function nearerWallPolygons(center,rect){
 const result=[];
 for(const points of wallOccluders){
  if(Math.max(...points.map(p=>p.x))<rect.left||Math.min(...points.map(p=>p.x))>rect.right||Math.max(...points.map(p=>p.y))<rect.top||Math.min(...points.map(p=>p.y))>rect.bottom)continue;
  const clipped=[];
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=a.depth-center.depth,db=b.depth-center.depth;if(da<=0)clipped.push(a);if((da<=0)!==(db<=0)){const t=da/(da-db);clipped.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})}}
  if(clipped.length>2)result.push(clipped);
 }
 return result;
}
function renderImaginationWall(front=false){
 imaginationWallState=[];
 const panels=DATA.imaginary.events.map(e=>({e,center:project(e.x,e.y,e.z)})).sort((a,b)=>b.center.depth-a.center.depth);
 for(const {e,center} of panels){const left=center.x-e.w*scale/2,top=center.y-e.h*scale/2,poly=[{x:left,y:top},{x:left+e.w*scale,y:top},{x:left+e.w*scale,y:top+e.h*scale},{x:left,y:top+e.h*scale}];
  const occluders=front?nearerWallPolygons(center,{left,top,right:left+e.w*scale,bottom:top+e.h*scale}):[];
  ctx.save();if(front)for(const polygon of occluders){ctx.beginPath();ctx.rect(left-2,top-2,e.w*scale+4,e.h*scale+4);polygon.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip('evenodd')}
  texture(e.bitmap,poly[0],poly[1],poly[3]);path(poly,null,'rgba(20,77,217,.28)');path(poly,selected===e?'#ff6b6b':hover===e?'#ffffff':'#2463FF',null,selected===e?1.8:.7);ctx.restore();if(front)hits.push({e,poly,occluders});
  if(e.video){const overlay=$('imaginationVideoOverlay'),frame=$('imaginationWallVideo');overlay.hidden=false;overlay.style.left=left+'px';overlay.style.top=top+'px';overlay.style.width=e.w*scale+'px';overlay.style.height=e.h*scale+'px';overlay.style.borderColor=selected===e?'#ff6b6b':hover===e?'#ffffff':'#2463FF';if(frame.src!==e.video.wallEmbed)frame.src=e.video.wallEmbed;}
  imaginationWallState.push({id:e.id,year:e.year,x:e.x,y:e.y,z:e.z,w:e.w,h:e.h,row:e.row,poly});
 }
}
function render(){if(!ready)return;ctx=baseCtx;foregroundCtx.clearRect(0,0,width,height);ctx.clearRect(0,0,width,height);ctx.fillStyle='#25262a';ctx.fillRect(0,0,width,height);hits=[];
 // Draw the wall under transparent surfaces, then reveal only pixels closer to the camera.
 wallOccluders=[];captureWallOccluders=false;renderImaginationWall();captureWallOccluders=true;
 renderCrossLayerWires('behind');
 renderDatacenterFloor();renderDatacenterColumns('lower');renderMapLayer();renderDatacenterColumns('upper');groundLabel({text:'DATA CENTER CENSITI E IN PROGRAMMA IN FINLANDIA',x:220,y:2380,z:DATA.datacenters.z,rotation:0,size:60,weight:'700'});renderPopulationFloor();renderEnergyFloor();renderCo2();renderEnergyGraph();renderPopulationGraph();renderVolumes();
 const corners=[[0,0],[4162,0],[4162,DATA.sceneHeight],[0,DATA.sceneHeight]].map(p=>project(...p));path(corners,'#ffffff30',planeFill(.82));texture(DATA.groundImage,corners[0],corners[1],corners[3]);for(const label of DATA.groundLabels||[])groundLabel(label);
 captureWallOccluders=false;renderImaginationWall(true);ctx=foregroundCtx;
 const cards=DATA.events.map(billboard).sort((a,b)=>b.depth-a.depth),byId=new Map(cards.map(card=>[card.e.id,card]));
 const ribbonGeometry=[];
 for(const ribbon of DATA.ribbons||[]){const card=byId.get(ribbon.event);if(!card)continue;const {e,cx,w,h}=card,ca=Math.cos(camera.angle),sa=Math.sin(camera.angle),se=Math.sin(camera.elevation),ce=Math.cos(camera.elevation);
  // Start on the right edge of the event panel and extend along chronological X.
  const start={x:cx+w*ca/2,y:e.y+w*sa/2},end={x:Math.max(start.x+20,ribbon.endX),y:start.y},up={x:h*se*sa,y:-h*se*ca,z:h*ce};
  const poly=[project(start.x+up.x,start.y+up.y,up.z),project(end.x+up.x,end.y+up.y,up.z),project(end.x,end.y),project(start.x,start.y)];
  path(poly,isHighlighted(e)?'#ff6b6b70':'#b8bcc42b',isHighlighted(e)?'#b7bac12e':'#b7bac126',1);hits.push({e,poly});ribbonGeometry.push({event:e.id,poly});
 }
 for(const card of cards){const {e,poly,w,h}=card,[a,b,c,d]=poly;
  if(e.image){texture(e.bitmap,a,b,d);path(poly,null,'rgba(20,77,217,.28)')}
  else{path(poly,null,'#303a53');ctx.save();ctx.translate(a.x,a.y);ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.font='20px Inter';ctx.textBaseline='middle';const lines=titleLines(e.title,w-22);const lh=Math.min(22,(h-16)/lines.length);lines.forEach((line,i)=>ctx.fillText(line,11,h/2+(i-(lines.length-1)/2)*lh));ctx.restore()}
  path(poly,isHighlighted(e)?'#ff6b6b':hover===e?'#79a1ff':'#2463FF',null,isHighlighted(e)?2.5:1);hits.push({e,poly});
 }
 const anchors=[];
 for(const link of DATA.connections){for(let i=1;i<link.events.length;i++){
  const from=byId.get(link.events[i-1]),to=byId.get(link.events[i]);if(!from||!to)continue;
  const a=from.anchor,b=to.anchor,p=project(a.x,a.y,a.z),q=project(b.x,b.y,b.z),rise=420+35*(i-1),c1=project(a.x,a.y,rise),c2=project(b.x,b.y,rise);
  ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.bezierCurveTo(c1.x,c1.y,c2.x,c2.y,q.x,q.y);ctx.lineCap='round';ctx.strokeStyle='#3b151c';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='#ff4d59';ctx.lineWidth=1.8;ctx.stroke();
  for(const point of [p,q]){ctx.beginPath();ctx.arc(point.x,point.y,2.5,0,Math.PI*2);ctx.fillStyle='#ff6771';ctx.fill()}
  anchors.push({from:from.e.id,to:to.e.id,start:p,end:q});
 }}
 renderCrossLayerWires('front');
 renderMacroBlockTitles();
 ctx=baseCtx;
 window.timelineState={imaginaryWall:imaginationWallState,crossLayerNavigation:activeCrossLayerNavigation,macroBlockTitles:macroBlockTitleState,crossLayerWires:crossLayerWireState,overheadTransparency:overheadBlend(),planeOpacity:1+(.035-1)*overheadBlend(),co2Volume:co2VolumeState,energyVolume:energyVolumeState,populationVolume:populationVolumeState,layerCount:6,datacenterColumns:dcColumnState,layer6Z:DATA.datacenters.z,activeMapView:activeMapView+1,mapNorth:DATA.maps.north,layer5Z:DATA.maps.z,layer2Z:DATA.co2.z,layer3Z:DATA.energy.z,layer4Z:DATA.population.z,yearAlignment:DATA.co2.yearLabels.map(label=>({year:label.text,upper:project(label.x,label.y,0),lower:project(label.x,label.y,DATA.co2.z),energy:project(label.x,label.y,DATA.energy.z),population:project(label.x,label.y,DATA.population.z)})),events:DATA.events.length,photos:cards.filter(c=>c.e.image).length,labels:cards.filter(c=>!c.e.image).length,links:DATA.connections.length,ribbons:ribbonGeometry,scale,highlighted:DATA.events.filter(isHighlighted).map(e=>e.id),anchors,selected:selected?.id,camera:{...camera},hits};
}
function loop(){
 const now=Date.now(),dt=Math.max(1,Math.min(50,now-co2AnimationTime));co2AnimationTime=now;
 const target=co2GrowthTarget(),difference=target-co2Growth;
 if(Math.abs(difference)>.0001){co2Growth+=difference*(1-Math.exp(-dt/220));dirty=true}
 else if(co2Growth!==target){co2Growth=target;dirty=true}
 if(dirty){dirty=false;render()}requestAnimationFrame(loop)
}
function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){let a=poly[i],b=poly[j];if((a.y>p.y)!=(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes}return yes}
function distanceToSegment(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/length)):0;return Math.hypot(x-a.x-t*dx,y-a.y-t*dy)}
function hit(x,y){for(let i=hits.length-1;i>=0;i--){const h=hits[i];if(h.occluders?.some(poly=>inside({x,y},poly)))continue;if(h.poly?inside({x,y},h.poly):h.a?distanceToSegment(x,y,h.a,h.b)<h.r:Math.hypot(x-h.p.x,y-h.p.y)<h.r)return h.e}return null}
function hideTip(){hover=null;$('tooltip').hidden=true;dirty=true}
function showTip(e,x,y){hover=e;const tip=$('tooltip');tip.replaceChildren();const small=document.createElement('small');small.textContent=e.category;tip.append(small,document.createTextNode(e.title));tip.hidden=false;tip.style.left=Math.max(10,Math.min(x+17,width-tip.offsetWidth-12))+'px';tip.style.top=Math.max(10,Math.min(y+17,height-tip.offsetHeight-12))+'px';dirty=true}
function renderGraphPreview(kind){
 const graph=kind==='co2'?DATA.co2:kind==='energy'?DATA.energy:DATA.population;
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const X=x=>90+(x-80)/4020*760,Y=y=>60+(y-250)/1980*425,n=v=>Number(v).toFixed(2);
 const color=graph.color;
 const unitLabel=kind==='co2'?'CO₂ · parti per milione':kind==='energy'?'Elettricità · TWh/anno':'Popolazione · miliardi di persone';
 const label=(text,x,y,fill='#eef2fa',size=28,anchor='start')=>`<text x="${n(x)}" y="${n(y)}" fill="${fill}" font-size="${size}" text-anchor="${anchor}">${esc(text)}</text>`;
 const line=(x1,y1,x2,y2,stroke='#ffffff22')=>`<path d="M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}" stroke="${stroke}" fill="none"/>`;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" role="img" aria-label="${esc(unitLabel)}: grafico visto dall’alto" font-family="Inter,sans-serif"><title>${esc(unitLabel)} · vista dall’alto</title>`;
 svg+=label(unitLabel,24,29,'#e9efff',28);
 const ticks=kind==='co2'?graph.ticks:Array.from({length:kind==='energy'?6:9},(_,i)=>({text:String(kind==='energy'?i*100:i),y:graph.bottom+(graph.top-graph.bottom)*i/(kind==='energy'?5:8)}));
 for(const tick of ticks){const y=Y(tick.y);svg+=line(90,y,850,y)+label(tick.text,72,y+9,'#cbd4e5',27,'end')}
 for(const year of graph.yearLabels){const x=X(year.x);svg+=line(x,60,x,485,'#ffffff18')+label(year.text,x,Y(year.y)+8,'#eef2fa',26,'middle')}
 svg+=line(90,485,850,485,'#ffffff44')+label('Anni',850,583,'#b8c5df',25,'end');
 if(kind==='co2')for(const curve of [...graph.paths].sort((a,b)=>a.seasonal-b.seasonal)){const path=curve.points.map(([x,y],i)=>(i?'L':'M')+n(X(x))+' '+n(Y(y))).join('');svg+=`<path d="${path}" fill="none" stroke="${color}" stroke-width="2.8" opacity="${curve.seasonal?1:.65}" stroke-linejoin="round"/>`}
 else if(kind==='energy'){const path=graph.segments.map(p=>(p.move?'M':'L')+n(X(p.x))+' '+n(Y(p.y))).join('');svg+=`<path d="${path}" fill="none" stroke="${color}" stroke-width="3"/>`}
 else{const path=graph.points.map((p,i)=>(i?'L':'M')+n(X(p.x))+' '+n(Y(p.y))).join('');svg+=`<path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`}
 for(const marker of graph.markers||[]){const x=X(marker.x),y=Y(marker.y),r=6;svg+=marker.kind==='square'?`<rect x="${n(x-r)}" y="${n(y-r)}" width="12" height="12" fill="${color}"/>`:marker.kind==='triangle'?`<path d="M${n(x)} ${n(y-r-2)}L${n(x+r+1)} ${n(y+r)}L${n(x-r-1)} ${n(y+r)}Z" fill="${color}"/>`:`<circle cx="${n(x)}" cy="${n(y)}" r="6" fill="${color}"/>`}
 for(const value of graph.values||[])svg+=label(value.text,X(value.x),Y(value.y)-5,color,27);
 svg+='</svg>';$('graphPreviewPlot').innerHTML=svg;
}
function openEvent(e,preserveCrossLayer=false){if(e.wireIndex!==undefined){openCrossLayerConnection(e.wireIndex);return}if(!preserveCrossLayer)activeCrossLayerNavigation=null;const dc=e.id==='layer6-datacenters';$('dcInfoPanel').hidden=!dc;$('detail').setAttribute('data-dc',String(dc));if(dc){const town=DATA.datacenters.towns.find(t=>t.code===e.focusTown);$('dcSelection').textContent=town?'Comune selezionato: '+town.code+' · '+town.name:''}const graphKind={'graph-co2-indicators':'co2','graph-energy-sources':'energy','graph-population-sources':'population'}[e.id];$('detail').setAttribute('data-graph',String(!!graphKind));$('graphPreview').hidden=!graphKind;if(graphKind)renderGraphPreview(graphKind);else $('graphPreviewPlot').replaceChildren();$('mapSingleLegend').hidden=e.id!=='layer5-map';if(e.id==='layer5-map')DATA.maps.views[activeMapView].counts.forEach((count,i)=>{$('singleMapCount'+i).textContent=count});$('detail').setAttribute('data-map',String(e.id==='layer5-map'||e.id==='layer6-datacenters'));$('detail').removeAttribute('data-layout');$('mapComparePanel').hidden=true;selected=e;hideTip();$('detail').hidden=false;$('category').textContent=(DATA.events.includes(e)?'Layer 1 · ':'')+e.category+(e.case?' · Caso studio':'');$('title').textContent=e.title;$('detailSubtitle').hidden=!e.subtitle;$('detailSubtitle').textContent=e.subtitle||'';$('detailVideoWrap').hidden=!e.video;if(e.video){if($('detailVideo').src!==e.video.cardEmbed)$('detailVideo').src=e.video.cardEmbed}else{$('detailVideo').src='about:blank'}$('photo').hidden=!!e.video||!e.image;if(e.image&&!e.video){$('photo').src=e.image;$('photo').alt=e.title}else{$('photo').removeAttribute('src')}$('description').replaceChildren(...e.texts.map(text=>{const p=document.createElement('p');p.className='copy';p.textContent=text;return p}));for(const link of e.links||[]){const p=document.createElement('p'),a=document.createElement('a');p.className='copy';a.textContent=link.label;a.setAttribute('href',link.href);a.setAttribute('target','_blank');a.setAttribute('rel','noopener noreferrer');p.append(a);$('description').append(p)}updateLinkedNav();syncMapControls();dirty=true}
function closeDetail(){$('detailVideoWrap').hidden=true;$('detailVideo').src='about:blank';activeCrossLayerNavigation=null;$('detailSubtitle').hidden=true;$('dcInfoPanel').hidden=true;$('detail').removeAttribute('data-dc');$('graphPreview').hidden=true;$('detail').removeAttribute('data-graph');$('mapSingleLegend').hidden=true;$('detail').removeAttribute('data-layout');$('mapComparePanel').hidden=true;selected=null;$('detail').hidden=true;updateLinkedNav();syncMapControls();dirty=true}
$('close').onclick=()=>{closeDetail();canvas.focus()};
function reset(){Object.assign(camera,{angle:Math.PI/6,elevation:Math.PI/7.5,zoom:1,panX:0,panY:0});fit();hideTip();dirty=true}
function closeViewMenu(){$('viewMenu').hidden=true;$('view').setAttribute('aria-expanded','false')}
$('view').onclick=()=>{const open=$('viewMenu').hidden;$('viewMenu').hidden=!open;$('view').setAttribute('aria-expanded',String(open))};
$('reset').onclick=()=>{reset();closeViewMenu()};$('plan').onclick=()=>{reset();camera.angle=0;camera.elevation=Math.PI/2;fit();dirty=true;closeViewMenu()};$('front').onclick=()=>{reset();camera.angle=0;camera.elevation=.12;fit();dirty=true;closeViewMenu()};
function zoom(f){camera.zoom=Math.max(.4,Math.min(10,camera.zoom*f));fit();hideTip();dirty=true}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#detail')&&!e.target.closest('#mapTools'))closeDetail();if(!e.target.closest('.toolbar'))closeViewMenu()});
const pointers=new Map();let drag=null,pinch=null,lastEmptyTap=null;
canvas.addEventListener('pointerdown',e=>{const doublePan=!!lastEmptyTap&&!hit(e.clientX,e.clientY)&&Date.now()-lastEmptyTap.time<400&&Math.hypot(e.clientX-lastEmptyTap.x,e.clientY-lastEmptyTap.y)<24;lastEmptyTap=null;canvas.focus();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,pan:doublePan||moveMode||e.shiftKey||e.button===2||e.button===1};if(pointers.size===2){const[a,b]=[...pointers.values()];pinch={dist:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2}}hideTip();canvas.style.cursor='grabbing'});
canvas.addEventListener('pointermove',e=>{if(pointers.has(e.pointerId)){pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinch){const[a,b]=[...pointers.values()],dist=Math.hypot(a.x-b.x,a.y-b.y),x=(a.x+b.x)/2,y=(a.y+b.y)/2;zoom(dist/Math.max(1,pinch.dist));camera.panX+=x-pinch.x;camera.panY+=y-pinch.y;pinch={dist,x,y};drag.moved=true;dirty=true;return}if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>4)drag.moved=true;if(drag.pan){camera.panX+=dx;camera.panY+=dy}else{camera.angle+=dx*.006;camera.elevation=Math.max(.12,Math.min(Math.PI/2, camera.elevation+dy*.005));fit()}drag.x=e.clientX;drag.y=e.clientY;dirty=true}return}const target=hit(e.clientX,e.clientY);canvas.style.cursor=target?'pointer':'grab';if(target)showTip(target,e.clientX,e.clientY);else hideTip()});
function endPointer(e,cancel=false){const click=!cancel&&drag&&!drag.moved&&pointers.size===1;pointers.delete(e.pointerId);if(click){const target=hit(e.clientX,e.clientY);if(target)openEvent(target);else lastEmptyTap={time:Date.now(),x:e.clientX,y:e.clientY}}drag=null;pinch=null;canvas.style.cursor='grab'}
canvas.addEventListener('pointerup',e=>endPointer(e));canvas.addEventListener('pointercancel',e=>endPointer(e,true));canvas.addEventListener('pointerleave',hideTip);canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.001))},{passive:false});
canvas.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')camera.angle-=.12;else if(e.key==='ArrowRight')camera.angle+=.12;else if(e.key==='ArrowUp')camera.elevation=Math.min(Math.PI/2,camera.elevation+.08);else if(e.key==='ArrowDown')camera.elevation=Math.max(.12,camera.elevation-.08);else if(e.key==='+'||e.key==='=')zoom(1.2);else if(e.key==='-')zoom(1/1.2);else if(e.key==='Home')reset();else return;e.preventDefault();fit();dirty=true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDetail();closeViewMenu();hideTip()}});window.addEventListener('resize',resize);
(async()=>{try{if(document.fonts){await document.fonts.load('400 20px Inter');await document.fonts.load('800 48px Inter')}DATA.groundImage=await loadImage(DATA.ground);await Promise.all([...DATA.events.filter(e=>e.image),...DATA.maps.views,...DATA.imaginary.events].map(async e=>{e.bitmap=await loadImage(e.image)}));ready=true;syncMapControls();resize();$('loading').hidden=true;loop()}catch(e){$('loading').textContent=e.message}})();
