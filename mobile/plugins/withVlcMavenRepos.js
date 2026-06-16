const { withProjectBuildGradle } = require('@expo/config-plugins');

const JITPACK_REPO = `        maven { url 'https://jitpack.io' }`;
const JCENTER_REPO = `        maven {
            url "https://jcenter.bintray.com/"
            content {
                includeVersion "org.videolan.android", "libvlc-all", "3.4.4"
            }
        }`;

function withVlcMavenRepos(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      return config;
    }

    let contents = config.modResults.contents;

    const toInsert = [
      !contents.includes('jitpack.io') ? JITPACK_REPO : null,
      !contents.includes('jcenter.bintray.com') ? JCENTER_REPO : null,
    ].filter(Boolean);

    if (toInsert.length > 0) {
      contents = contents.replace(
        /allprojects\s*\{\s*repositories\s*\{/,
        (match) => `${match}\n${toInsert.join('\n')}`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withVlcMavenRepos;
