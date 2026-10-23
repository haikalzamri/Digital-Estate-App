import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, access, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const dex=path.join(root,"dex-prototype");
const output=path.join(dex,"out");
const destination=path.join(root,"public","dex-runtime");
const exists=async(file)=>access(file).then(()=>true,()=>false);
const run=(command,args,options={})=>{
  const result=spawnSync(command,args,{cwd:dex,stdio:"inherit",...options});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(command+" "+args.join(" ")+" failed ("+result.status+")");
};
if(Number(process.versions.node.split(".")[0])!==24)throw new Error("Build DEX with Node.js 24 LTS.");
if(!await exists(path.join(dex,"node_modules","next","dist","bin","next"))) {
  run("npm",["ci","--include=dev","--ignore-scripts","--no-audit","--no-fund"]);
}
const sources=["tsconfig.json","next-env.d.ts"];
const original=await Promise.all(sources.map(async(name)=>({name,content:await readFile(path.join(dex,name))})));
try {
  await rm(output,{recursive:true,force:true});
  console.log("Building isolated DEX module for /dex");
  run(process.execPath,["node_modules/next/dist/bin/next","build"],{env:{...process.env,DEX_MODULE_BUILD:"1",NEXT_PUBLIC_DEX_BASE_PATH:"/dex"}});
  const html=await readFile(path.join(output,"index.html"),"utf8");
  if(!html.includes("Digital Estate Extended")||!html.includes("/dex/_next/"))throw new Error("DEX export is incomplete.");
  await mkdir(path.dirname(destination),{recursive:true});
  await rm(destination,{recursive:true,force:true});
  await cp(output,destination,{recursive:true});
  console.log("DEX module packaged in public/dex-runtime");
} finally {
  for(const source of original)await writeFile(path.join(dex,source.name),source.content);
}
