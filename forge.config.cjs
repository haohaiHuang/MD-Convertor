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
    electronZipDir: path.resolve(__dirname, ".desktop/electron"),
    extraResource: [path.resolve(__dirname, ".desktop/server")],
    ignore: [
      /^\/.git($|\/)/,
      /^\/.desktop($|\/)/,
      /^\/.next($|\/)/,
      /^\/node_modules($|\/)/,
      /^\/out($|\/)/,
      /^\/output($|\/)/,
      /^\/coverage($|\/)/,
      /^\/.playwright-cli($|\/)/,
      /^\/playwright-report($|\/)/,
      /^\/test-results($|\/)/,
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
