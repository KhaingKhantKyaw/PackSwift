import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import '../public/js/emergency-directory.js';
const model=globalThis.PackSwiftEmergencyDirectory;
export async function auditEmergencyDirectory(data,{now=new Date(),fetcher=fetch,checkSources=false,previous={}}={}){
  model.validate(data);
  const sources=[];
  for(const url of new Set(data.groups.map(g=>g.source))){
    let result={url,status:'not-fetched',humanReviewRequired:true};
    if(checkSources)try{
      const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(8000)});
      if(response.status!==200)result.status='http-'+response.status;
      else if(Number(response.headers.get('content-length'))>2000000)result.status='content-too-large';
      else{const text=await response.text();if(text.length>2000000)result.status='content-too-large';
        else {result.hash=createHash('sha256').update(text).digest('hex');result.status=previous.sources?.find(s=>s.url===url)?.hash===result.hash?'content-unchanged-needs-review':'content-changed-or-new-needs-review';}}
    }catch{result.status='fetch-failed';}
    sources.push(result);
  }
  const covered=new Set(data.groups.flatMap(g=>g.countries));
  return {generatedAt:now.toISOString(),countryAreas:model.countries.length,coveredAreas:covered.size,missingAreas:model.countries.filter(c=>!covered.has(c.code)),
    overdue:data.groups.filter(g=>(now-Date.parse(g.verifiedAt))/86400000>data.reviewAfterDays).map(g=>({countries:g.countries,verifiedAt:g.verifiedAt,source:g.source})),
    sources,notice:'Page availability or unchanged HTML is not contact verification. Review official content manually; this tool never updates verifiedAt or publishes changes.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const root=new URL('../',import.meta.url),output=new URL('output/emergency-source-audit.json',root);
  const data=JSON.parse(await readFile(new URL('public/data/emergency-contacts.json',root),'utf8'));
  let previous;try{previous=JSON.parse(await readFile(output,'utf8'));}catch{previous={};}
  const report=await auditEmergencyDirectory(data,{checkSources:process.argv.includes('--fetch'),previous});
  await mkdir(new URL('output/',root),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
  console.log(report.coveredAreas+'/'+report.countryAreas+' areas covered; '+report.overdue.length+' source groups overdue. Review report: '+fileURLToPath(output));
}
