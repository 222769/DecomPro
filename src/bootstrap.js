// Catch component download and initialization failures before showing the workspace.
import('./main.js').then(() => window.decomproStartup.complete()).catch(error => {
  window.decomproStartup.fail(error);
  console.error('DecomPro startup failed:', error);
});
