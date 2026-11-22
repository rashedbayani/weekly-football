import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const pages=process.argv.includes('--pages');
const port=pages?4201:4200;
const root = fileURLToPath(new URL(pages?'../docs/':'../dist/weekly-football/browser/', import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon'};
try {await stat(path.join(root,'index.html'));} catch {console.error('Build the app first with npm run build.'); process.exit(1);}
const server = createServer(async (req,res) => {
 try {
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let target=path.resolve(root,'.'+pathname);
  if(target!==path.resolve(root) && !target.startsWith(path.resolve(root)+path.sep)){res.writeHead(403).end();return;}
  if(pathname.endsWith('/'))target=path.join(target,'index.html');
  const bytes=await readFile(target);
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]??'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(bytes);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found');}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Touchline is ready at http://127.0.0.1:${port} — press Ctrl+C to stop.`));
