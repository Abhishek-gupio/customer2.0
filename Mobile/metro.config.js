const path = require('path');
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

const config = {
  projectRoot,
  watchFolders: [workspaceRoot],
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

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
