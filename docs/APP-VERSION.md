# Visible application version

The footer and the Settings heading show the current app version and build number. Settings → About DecomPro also shows its short Git commit and build timestamp in Europe/London time. The locked shared sign-in page includes the version too.

Version comes from package.json (currently 1.1.0). GitHub Pages builds use GITHUB_RUN_NUMBER as the build number and GITHUB_SHA as the revision, so each new deployment gets a different build number automatically. Development/manual local builds are labelled Local build rather than displaying a misleading deployment number. A Git revision is included when the checkout provides one.

Metadata is injected by Vite at build time and belongs to the JavaScript actually loaded on the device. It does not fetch the newest release and label an older cached application as current. When reporting an issue, include the version/build and commit from Settings.

To create a numbered release, use npm version patch --no-git-tag-version (or minor/major as appropriate) so package.json and package-lock.json stay aligned. Build numbers continue to distinguish updates even between numbered releases. No Firebase changes are required.
