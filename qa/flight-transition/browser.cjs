'use strict';
process.env.FINAL_REVIEW_OUT='docs/flight-transition';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process'),{chromium}=require('playwright'),{pour}=require('../four-maps/browser.cjs');
const out=path.resolve('docs/flight-transition'),scratch=fs.mkdtempSync('/private/tmp/flight-review-'),maps=['classic','twinfold','cascade','rhythm'];
// Identical real mouse/touch input helper, waiting at captured release instead of race.
const release=new Function('assert','path','out','return '+pour.toString().replace("CosmicPinball.app.status==='running'","!!window.FlightReview.state"))(assert,path,out);
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),report={source:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),errors:[],cases:[]};
try{for(const mode of (process.env.REVIEW_MODE?[process.env.REVIEW_MODE]:['desktop','mobile','reduced']))for(const map of maps.filter(m=>!process.env.REVIEW_MAP||m===process.env.REVIEW_MAP)){
 const startedAt=Date.now();const width=mode==='mobile'?390:1280,height=mode==='mobile'?844:800,count=mode==='desktop'?50:6;
 const context=await browser.newContext({viewport:{width,height},isMobile:mode==='mobile',hasTouch:mode==='mobile'}),page=await context.newPage();page.on('pageerror',e=>report.errors.push({map,mode,error:e.message}));await page.goto('http://127.0.0.1:8810/');
 await page.addScriptTag({path:'qa/flight-transition/baseline-hand-flight.js'});await page.evaluate(()=>Object.setPrototypeOf(CosmicPinball.app.handFlight,CosmicPinball.HandFlight.prototype));await page.addScriptTag({path:'qa/flight-transition/prototype.js'});await page.addScriptTag({path:'qa/flight-transition/review.js'});
 await page.locator('#intro-start-button').click();await page.locator('[data-map="'+map+'"]').click();await page.evaluate(({count,mode})=>{const u=CosmicPinball.app.ui;u.load({...u.readSettings(),names:'빨강*'+(count/3)+',초록*'+(count/3)+',파랑*'+(count/3),seed:'transition-review',speed:1,sound:false,reducedMotion:mode==='reduced'});if(count===50)u.load({...u.readSettings(),names:'빨강*17,초록*17,파랑*16'});u.emit('change',u.readSettings());FlightReview.capture=true;FlightReview.select('proposal');},{count,mode});
 await page.waitForFunction(()=>!!CosmicPinball.app.renderer.mapBackground());await page.locator('#start-button').click();await release(page,mode==='mobile');await page.waitForFunction(()=>FlightReview.pause&&FlightReview.pending.length>0);
 const row={map,mode,count,variants:[]};
 const committed=await page.evaluate(()=>JSON.stringify({marbles:CosmicPinball.app.physics.marbles,handStart:CosmicPinball.app.physics.handStart,time:CosmicPinball.app.physics.time,ticks:CosmicPinball.app.physics.ticks}));
 for(const variant of ['baseline','proposal']){
  await page.evaluate(v=>FlightReview.select(v),variant);
  const metrics=await page.evaluate(()=>{const a=CosmicPinball.app,f=a.handFlight,steps=[];let outside=0,maxOvershoot=0;
   for(let i=0;i<=600;i++){const p=i/600,poses=f.items.map((_,j)=>f.pose(j,p*f.duration)),view=f.cameraAt(p,poses),screen=poses.map(x=>({id:x.id,x:view.a*x.x+view.e,y:view.d*x.y+view.f,r:x.radius*view.a}));
    if(p>=.2&&p<=.9)for(const s of screen){const over=Math.max(0,s.r-s.x,s.x+s.r-innerWidth,s.r-s.y,s.y+s.r-innerHeight);if(over>.5)outside++;maxOvershoot=Math.max(maxOvershoot,over);}
    steps.push({p,scale:view.current.a,boardX:view.current.e,boardY:view.current.f});
   }
   const f0=f.cameraAt(0),end=f.cameraAt(1),near=f.cameraAt(.9999),last=steps[390];
   FlightReview.seek(0);const start=f.lastPoses.map(x=>({...x}));FlightReview.seek(1);let endpointError=0;for(const s of f.lastPoses){const m=a.physics.marbles.find(m=>m.id===s.id),t=a.camera.worldToScreen(m.x,m.y);endpointError=Math.max(endpointError,Math.hypot(s.x-t.x,s.y-t.y),Math.abs(s.radius-m.r*a.camera.zoom));}
   FlightReview.seek(.9999);const left=FlightReview.composite().getContext('2d').getImageData(0,0,innerWidth,innerHeight).data;FlightReview.seek(1);const right=FlightReview.composite().getContext('2d').getImageData(0,0,innerWidth,innerHeight).data;let difference=0,pixels=0;for(let i=0;i<left.length;i+=4){const d=(Math.abs(left[i]-right[i])+Math.abs(left[i+1]-right[i+1])+Math.abs(left[i+2]-right[i+2]))/3;difference+=d;if(d>12)pixels++;}
   return {sourcePixels:start,endpointError,outsideSamples:outside,maxOvershoot,initialBoardScale:f0.current.a,finalBoardScale:end.current.a,lateZoomFactor:end.current.a/last.scale,landingPixelMeanDifference:difference/(left.length/4),landingPixelChangedPercent:100*pixels/(left.length/4),steps};
  });
  assert(metrics.endpointError<1e-6,'Endpoint mismatch');
  const snapshot=await page.evaluate(()=>JSON.stringify({marbles:CosmicPinball.app.physics.marbles,handStart:CosmicPinball.app.physics.handStart,time:CosmicPinball.app.physics.time,ticks:CosmicPinball.app.physics.ticks}));assert.equal(snapshot,committed,'Review mutated physics');
  if(mode!=='reduced'){
   const dir=path.join(scratch,map+'-'+mode+'-'+variant);fs.mkdirSync(dir);
   for(let i=0;i<=60;i++){await page.evaluate(p=>FlightReview.seek(p),i/60);const data=await page.evaluate(()=>FlightReview.composite().toDataURL('image/jpeg',.84).split(',')[1]);fs.writeFileSync(path.join(dir,String(i).padStart(3,'0')+'.jpg'),Buffer.from(data,'base64'));}
   const video=map+'-'+mode+'-'+variant+'.mp4';cp.execFileSync('/opt/homebrew/bin/ffmpeg',['-y','-loglevel','error','-framerate','21.428571','-i',path.join(dir,'%03d.jpg'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','22','-movflags','+faststart',path.join(out,video)]);metrics.video=video;
  }
  await page.evaluate(()=>FlightReview.seek(.5));await page.screenshot({path:path.join(out,map+'-'+mode+'-'+variant+'.png')});
  row.variants.push({variant,...metrics});
 }
 assert.deepEqual(row.variants[0].sourcePixels,row.variants[1].sourcePixels);row.physicsUnchanged=true;row.sameRelease=true;
 // Let the trial finish at its exact endpoint, then check actual race/result flow.
 await page.evaluate(()=>{FlightReview.seek(1);FlightReview.resume();});await page.waitForFunction(()=>CosmicPinball.app.status==='running');await page.waitForFunction(()=>CosmicPinball.app.physics.time>.1);
 await page.evaluate(()=>{const p=CosmicPinball.app.physics;while(!p.complete&&p.time<240){p.step();p.drainEvents();}});await page.waitForFunction(()=>document.querySelector('#results-dialog').open);row.finished=await page.evaluate(()=>CosmicPinball.app.physics.finished.length);assert.equal(row.finished,count);
 row.elapsedMs=Date.now()-startedAt;report.cases.push(row);fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2));console.log('PASS '+map+' '+mode);await context.close();
}assert.equal(report.errors.length,0);}finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2));await browser.close();}console.log('DONE '+report.cases.length);})().catch(e=>{console.error(e);process.exitCode=1;});
