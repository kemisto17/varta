// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // Async screen loaders and provider reset effects are deliberate here.
      'react-hooks/set-state-in-effect': 'off',
      // Reanimated shared values are mutable by design inside worklets.
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  }
]);
