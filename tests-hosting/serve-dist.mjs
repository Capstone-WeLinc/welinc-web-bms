// Test-only Static Web Apps emulator; deployment uses Azure, not this server.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist');
const config=JSON.parse(await readFile(resolve(root,'staticwebapp.config.json'),'utf8'));
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
createServer(async(req,res)=>{
 try {
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=resolve(root,'.'+pathname);
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  const exists=await stat(file).catch(()=>null);
  if(!exists?.isFile()){
   if(pathname.startsWith('/assets/')){res.writeHead(404).end();return;}
   file=resolve(root,'index.html');
  }
  res.writeHead(200,{...config.globalHeaders,'Content-Type':types[extname(file)]??'application/octet-stream'});
  res.end(await readFile(file));
 }catch{res.writeHead(500).end();}
}).listen(8113,'127.0.0.1');
