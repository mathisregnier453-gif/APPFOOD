// Version « test des achats » : version Android debug qui embarque le code JS
// (pas besoin de serveur Metro). Le SDK RevenueCat n'accepte la clé du
// Test Store que dans une version debug. Activé seulement si
// SAUGE_EMBED_DEBUG_BUNDLE=1 (profil EAS « test-achats »).
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withEmbeddedDebugBundle(config) {
  if (process.env.SAUGE_EMBED_DEBUG_BUNDLE !== '1') return config;
  return withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes('debuggableVariants = []')) {
      c.modResults.contents = c.modResults.contents.replace(/^react \{\n/m, 'react {\n    debuggableVariants = []\n');
    }
    return c;
  });
};
