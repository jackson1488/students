/**
 * Module: babel.config.js
 *
 * Purpose:
 * - Babel build configuration used by Expo/Metro during bundling.
 *
 * Module notes:
 * - Imports count: 0.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - No local function declarations detected; file is primarily declarative/configuration-based.
 */

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-reanimated/plugin"],
  };
};
