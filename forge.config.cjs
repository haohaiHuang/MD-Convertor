/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");

module.exports = {
  packagerConfig: {
    name: "MD-Convertor",
    executableName: "MD-Convertor",
    appBundleId: "com.huanghaohai.md-convertor",
    appCategoryType: "public.app-category.productivity",
    arch: "arm64",
    asar: true,
    icon: path.resolve(__dirname, "assets/icon.icns"),
    electronZipDir: path.resolve(__dirname, ".desktop/electron"),
    extraResource: [path.resolve(__dirname, ".desktop/server")],
    ignore: [
      // Only package.json and the Electron-side modules are read at runtime: Electron resolves
      // `main` from package.json, and electron/main.mjs imports its siblings through
      // import.meta.dirname. The Next.js frontend and its node_modules ship separately as the
      // `server` extraResource, and the repository-root public/ is copied into it by
      // scripts/prepare-desktop.mjs.
      //
      // Written as a single keep-list on purpose. A rule that names what to drop (docs/, src/,
      // tests/, ...) has to be extended every time the repository grows, so anything new lands
      // in the bundle by default; this form cannot silently regress. Packager appends its own
      // defaults (.git, lockfiles, *.o) as long as `ignore` is an array rather than a function.
      /^\/(?!package\.json$)(?!electron(\/|$)).*/,
      // The Electron-side test files sit next to the modules they cover but are not shipped.
      /^\/electron\/.*\.test\.(mjs|cjs)$/,
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
  ],
};
