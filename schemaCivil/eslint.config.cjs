// eslint.config.cjs
const js = require("@eslint/js");
const globals = require("globals");
const { defineConfig } = require("eslint/config");

module.exports = defineConfig([
  {
    files: ["**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021
      },
      ecmaVersion: 2021,
      sourceType: "commonjs"
    },
    plugins: { js },
    extends: ["js/recommended"]
  }
]);