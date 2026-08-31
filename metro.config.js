const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Empty JS module used as a stub for web-only CSS imports on native.
const emptyModule = path.resolve(__dirname, 'scripts/metro-empty-module.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
	// Native platforms cannot load CSS modules from @expo/log-box etc.
	if (platform !== 'web' && /\.s?css$/.test(moduleName)) {
		return {
			type: 'sourceFile',
			filePath: emptyModule,
		};
	}

	if (typeof context.resolveRequest === 'function') {
		return context.resolveRequest(context, moduleName, platform);
	}

	return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
