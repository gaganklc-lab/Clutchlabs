const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.watchFolders = (config.watchFolders ?? []).filter(
  (f) => !f.includes(".local/state")
);

if (!config.resolver) config.resolver = {};
config.resolver.blockList = [
  ...(config.resolver.blockList ?? []),
  /\.local\/state\/.*/,
];

module.exports = config;
