const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Web'de native-only modülleri mock'la
const nativeOnlyModules = [
  'react-native-maps',
];

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && nativeOnlyModules.some((m) => moduleName === m || moduleName.startsWith(m + '/'))) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'mocks/empty-module.js'),
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
