import type { NextConfig } from "next";
const moduleBuild=process.env.DEX_MODULE_BUILD==="1";
const config: NextConfig = {
  reactStrictMode:true,allowedDevOrigins:["10.211.55.3"],poweredByHeader:false,devIndicators:false,
  turbopack:{root:process.cwd()},
  ...(moduleBuild?{output:"export",basePath:"/dex",images:{unoptimized:true}}:{}),
};
export default config;
