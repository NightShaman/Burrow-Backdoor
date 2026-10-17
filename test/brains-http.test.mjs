import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

test('Brains tools round-trip over actual MCP and authenticated Core HTTP transport', async t => {
 const requests=[];let unavailable=false,client,transport,child;
 t.after(async()=>{if(transport){await transport.terminateSession();await client.close();}if(child?.exitCode===null){child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(()=>child.kill('SIGKILL'),5000).unref();});}await new Promise(r=>{core.close(r);core.closeAllConnections();});});
 const core=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');requests.push({method:req.method,path:url.pathname,agentId:url.searchParams.get('agentId'),cursor:url.searchParams.get('cursor')});
  assert.equal(req.headers.authorization,'Bearer fixture-only');
  const body=unavailable ? {ok:false,error:'api_token_forbidden'} : url.pathname==='/api/diagnostics/brains' ? {ok:true,scope:{kind:'global',agentId:null},memories:{active:'2'},embedding:{enabled:false}} : {ok:true,items:[{id:'record',revision:2}],nextCursor:url.searchParams.has('cursor')?null:'opaque-cursor'};
  res.writeHead(unavailable?403:200,{'content-type':'application/json'});res.end(JSON.stringify(body));
 });
 await new Promise(r=>core.listen(0,'127.0.0.1',r));
 const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 child=spawn(process.execPath,['src/server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),BURROW_BASE_URL:`http://127.0.0.1:${core.address().port}`,BURROW_API_TOKEN:'fixture-only'}});
 let output='';child.stderr.on('data',x=>output+=x);

 const base=`http://127.0.0.1:${port}`;const deadline=Date.now()+10000;
 while(true){try{if((await fetch(base+'/healthz')).ok)break;}catch{}if(child.exitCode!==null||Date.now()>deadline)throw Error('Backdoor startup failed: '+output);await new Promise(r=>setTimeout(r,25));}
 client=new Client({name:'brains-test',version:'1'},{capabilities:{}});
 transport=new StreamableHTTPClientTransport(new URL(base+'/mcp'));await client.connect(transport);

 const catalog=await client.listTools();assert.equal(catalog.tools.length,26);
 const status=await client.callTool({name:'burrow_brains_status',arguments:{}});assert.equal(status.structuredContent.memories.active,'2');
 const first=await client.callTool({name:'burrow_list_brain_memories',arguments:{agentId:'a',limit:1}});assert.equal(first.structuredContent.nextCursor,'opaque-cursor');
 const second=await client.callTool({name:'burrow_list_brain_memories',arguments:{agentId:'a',limit:1,cursor:first.structuredContent.nextCursor}});assert.equal(second.structuredContent.nextCursor,null);
 await client.callTool({name:'burrow_list_brain_embedding_jobs',arguments:{agentId:'a'}});
 assert.deepEqual(requests.map(x=>x.path),['/api/diagnostics/brains','/api/diagnostics/brains/memories','/api/diagnostics/brains/memories','/api/diagnostics/brains/embedding-jobs']);
 assert.ok(requests.every(x=>x.method==='GET'));assert.equal(requests[2].cursor,'opaque-cursor');
 unavailable=true;const denied=await client.callTool({name:'burrow_brains_status',arguments:{}});assert.equal(denied.isError,true);assert.equal(JSON.parse(denied.content[0].text).status,403);
});
