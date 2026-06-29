const { withAndroidManifest } = require('@expo/config-plugins');

function withAndroidProduction(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];

    if (application) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }

    if (manifest['uses-permission']) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (item) => item.$['android:name'] !== 'android.permission.SYSTEM_ALERT_WINDOW',
      );
    }

    return config;
  });
}

module.exports = withAndroidProduction;
