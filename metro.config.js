const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Prevent Android bundling failures when web-only CSS modules are imported.
config.resolver.resolveRequest = (context, moduleName, platform) => {
	if (platform !== 'web' && moduleName.endsWith('.css')) {
		return { type: 'empty' };
	}

	return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
