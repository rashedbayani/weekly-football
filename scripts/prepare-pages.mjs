import {cp,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=path.join(root,'dist/weekly-football/browser'),destination=path.join(root,'docs');
const index=await readFile(path.join(source,'index.html'),'utf8');
if(!index.includes('<base href="./">'))throw new Error('Build with --base-href ./ before preparing GitHub Pages.');
await mkdir(destination,{recursive:true});
for(const entry of await readdir(source,{withFileTypes:true})){
 if(['data','cloud-config.json'].includes(entry.name))continue;
 await cp(path.join(source,entry.name),path.join(destination,entry.name),{recursive:true});
}
await writeFile(path.join(destination,'.nojekyll'),'');
await writeFile(path.join(destination,'cloud-config.json'),JSON.stringify({enabled:true,github:{owner:'rashedbayani',repository:'weekly-football',ownerId:82253861,branch:'main',path:'docs/data/season.json'}},null,2)+'\n');
await mkdir(path.join(destination,'data'),{recursive:true});
// Never replace existing season data when rebuilding the app.
try{await writeFile(path.join(destination,'data/season.json'),JSON.stringify({payload:JSON.stringify({version:1,players:[],matches:[]}),revision:1})+'\n',{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
console.log('GitHub Pages prepared in docs/. Existing season data was preserved.');
