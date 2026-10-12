// Build-time metadata stays with the loaded application, even when a newer site is deployed.
export const buildInfo={version:__APP_VERSION__,number:__APP_BUILD_NUMBER__,revision:__APP_REVISION__,builtAt:__APP_BUILT_AT__};
export const versionLabel=`v${buildInfo.version} · ${buildInfo.number==='local'?'Local build':`Build ${buildInfo.number}`}`;
export const buildTime=new Date(buildInfo.builtAt).toLocaleString('en-GB',{timeZone:'Europe/London'});
