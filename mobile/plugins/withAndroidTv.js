const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withTvBanner(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const src = path.join(config.modRequest.projectRoot, 'assets', 'tv_banner.png');
      const destDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'drawable-xhdpi'
      );
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, path.join(destDir, 'tv_banner.png'));
      return config;
    },
  ]);
}

function withAndroidTv(config) {
  config = withTvBanner(config);
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application[0];

    application.$['android:usesCleartextTraffic'] = 'true';
    application.$['android:banner'] = '@drawable/tv_banner';

    const mainActivity = application.activity.find(
      (activity) => activity.$['android:name'] === '.MainActivity'
    );

    if (mainActivity) {
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }
      const hasLeanback = mainActivity['intent-filter'].some((filter) =>
        (filter.category || []).some(
          (category) => category.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER'
        )
      );
      if (!hasLeanback) {
        mainActivity['intent-filter'].push({
          action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
          category: [{ $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' } }],
        });
      }
    }

    return config;
  });
}

module.exports = withAndroidTv;
