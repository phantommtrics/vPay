const { withAppBuildGradle } = require('@expo/config-plugins');

const RELEASE_SIGNING_BODY = `
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`;

function withAndroidUploadSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      return gradleConfig;
    }

    let contents = gradleConfig.modResults.contents;

    if (contents.includes('keystorePropertiesFile')) {
      return gradleConfig;
    }

    contents = contents.replace(
      /(\s+namespace[^\n]+\n)/,
      `$1    def keystorePropertiesFile = rootProject.file("../android-signing/keystore.properties")
    def keystoreProperties = new Properties()
    if (keystorePropertiesFile.exists()) {
        keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
    }
`
    );

    contents = contents.replace(
      /signingConfigs \{\s*\n\s*debug \{/,
      `signingConfigs {
        release {${RELEASE_SIGNING_BODY}
        debug {`
    );

    contents = contents.replace(
      /release \{\s*\n\s*\/\/ Caution! In production[^\n]*\n\s*\/\/ see[^\n]*\n\s*signingConfig signingConfigs\.debug/,
      `release {
            signingConfig signingConfigs.release`
    );

    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });
}

module.exports = withAndroidUploadSigning;
