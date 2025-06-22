// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt({
  // Your custom configs here
  rules: {
    // Warn on unused imports and variables
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        "vars": "all",
        "args": "after-used",
        "ignoreRestSiblings": false,
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ]
  }
});
