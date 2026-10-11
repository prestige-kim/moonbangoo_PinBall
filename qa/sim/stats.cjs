'use strict';
function quantile(values, p) { const a=values.slice().sort((a,b)=>a-b); return a.length ? a[Math.floor((a.length-1)*p)] : null; }
// Lanczos log-gamma and regularized upper incomplete gamma (chi-square survival).
function logGamma(z) {
  const c=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-.13857109526572012,9.984369578019572e-6,1.5056327351493116e-7];
  if(z<.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
  z--;let x=.99999999999980993;for(let i=0;i<c.length;i++)x+=c[i]/(z+i+1);const t=z+c.length-.5;return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x);
}
function gammaQ(a,x) {
  if(x===0)return 1;
  const scale=Math.exp(a*Math.log(x)-x-logGamma(a));
  if(x<a+1){let s=1/a,d=s;for(let k=1;k<10000;k++){d*=x/(a+k);s+=d;if(Math.abs(d)<Math.abs(s)*1e-14)break;}return Math.max(0,1-s*scale);}
  let b=x+1-a,c=1e300,d=1/b,h=d;
  for(let k=1;k<10000;k++){const an=-k*(k-a);b+=2;d=an*d+b;if(Math.abs(d)<1e-300)d=1e-300;c=b+an/c;if(Math.abs(c)<1e-300)c=1e-300;d=1/d;const delta=d*c;h*=delta;if(Math.abs(delta-1)<1e-14)break;}
  return Math.max(0,Math.min(1,h*scale));
}
function chiSquare(counts, probabilities) {
  const n=counts.reduce((a,b)=>a+b,0),probs=probabilities||counts.map(()=>1/counts.length);
  const expected=probs.map(p=>p*n);let statistic=0,maxDeviation=0;
  counts.forEach((o,i)=>{statistic+=(o-expected[i])**2/expected[i];maxDeviation=Math.max(maxDeviation,Math.abs(o-expected[i])/n);});
  return {counts,n,expected,statistic,df:counts.length-1,pValue:gammaQ((counts.length-1)/2,statistic/2),maxDeviationPercentagePoints:maxDeviation*100,validApproximation:Math.min(...expected)>=5};
}
module.exports={quantile,chiSquare,gammaQ};
