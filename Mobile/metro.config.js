const fs = require('fs');
const path = require('path');
const {FileStore} = require('metro-cache');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration for the mobile app inside the workspace.
 *
 * Keep this minimal: pnpm installs package dependencies inside nested
 * `.pnpm/.../node_modules` directories, so Metro needs normal hierarchical
 * resolution plus symlink support instead of a custom package redirector.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const appNodeModules = path.resolve(projectRoot, 'node_modules');
const workspaceNodeModules = path.resolve(workspaceRoot, 'node_modules');
// Keep Metro caches inside the app so stale temp-cache state doesn't leak
// across workspace changes or other React Native projects on the machine.
const metroCacheRoot = path.resolve(projectRoot, '.metro-cache');
const fileMapCacheDirectory = path.resolve(metroCacheRoot, 'file-map');
const transformerCacheDirectory = path.resolve(metroCacheRoot, 'transformer');

fs.mkdirSync(fileMapCacheDirectory, {recursive: true});
fs.mkdirSync(transformerCacheDirectory, {recursive: true});

const config = {
  maxWorkers: 1,
  cacheStores: [
    new FileStore({
      root: transformerCacheDirectory,
    }),
  ],
  cacheVersion: 'mobile-monorepo-v1',
  projectRoot,
  watchFolders: [workspaceNodeModules],
  resolver: {
    nodeModulesPaths: [appNodeModules, workspaceNodeModules],
    extraNodeModules: {
      react: path.resolve(appNodeModules, 'react'),
      'react-native': path.resolve(appNodeModules, 'react-native'),
    },
    unstable_enableSymlinks: true,
    unstable_enablePackageExports: true,
  },
};

const finalConfig = mergeConfig(getDefaultConfig(projectRoot), config);

Object.defineProperty(finalConfig, 'fileMapCacheDirectory', {
  configurable: true,
  enumerable: false,
  value: fileMapCacheDirectory,
});

module.exports = finalConfig;
