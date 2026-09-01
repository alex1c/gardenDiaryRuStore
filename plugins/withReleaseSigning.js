/**
 * Expo config plugin: wire Android release builds to a local production keystore.
 * Reads credentials/keystore.properties (gitignored). Release fails clearly if missing.
 */

const {
	withAppBuildGradle,
} = require('@expo/config-plugins');

const SIGNING_MARKER = '// garden-diary-release-signing';

/**
 * Injects release signingConfigs that load from credentials/keystore.properties.
 * Debug continues to use the standard debug keystore.
 */
function applyReleaseSigning(buildGradle) {
	if (buildGradle.includes(SIGNING_MARKER)) {
		return buildGradle;
	}

	const signingBlock = `
    ${SIGNING_MARKER}
    // Production signing: require credentials/keystore.properties (never commit it).
    def gardenDiaryKeystorePropertiesFile = rootProject.file("../credentials/keystore.properties")
    def gardenDiaryKeystoreProperties = new Properties()
    if (gardenDiaryKeystorePropertiesFile.exists()) {
        gardenDiaryKeystorePropertiesFile.withInputStream { gardenDiaryKeystoreProperties.load(it) }
    }
`;

	let next = buildGradle.replace(
		/signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\}\s*\}/,
		(match) => `${signingBlock}
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (!gardenDiaryKeystorePropertiesFile.exists()) {
                throw new GradleException(
                    "Missing credentials/keystore.properties. Create it from credentials/keystore.properties.example before bundleRelease."
                )
            }
            def storeFilePath = gardenDiaryKeystoreProperties['storeFile']
            if (storeFilePath == null || storeFilePath.toString().trim().isEmpty()) {
                throw new GradleException("keystore.properties is missing storeFile")
            }
            storeFile rootProject.file(storeFilePath)
            storePassword gardenDiaryKeystoreProperties['storePassword']
            keyAlias gardenDiaryKeystoreProperties['keyAlias']
            keyPassword gardenDiaryKeystoreProperties['keyPassword']
        }
    }`
	);

	// Force release buildType only — avoid matching signingConfigs.release { }.
	next = next.replace(
		/(buildTypes\s*\{[\s\S]*?^\s*release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/m,
		'$1signingConfig signingConfigs.release'
	);

	return next;
}

function withReleaseSigning(config) {
	return withAppBuildGradle(config, (config) => {
		config.modResults.contents = applyReleaseSigning(
			config.modResults.contents
		);
		return config;
	});
}

module.exports = withReleaseSigning;
