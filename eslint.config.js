import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";

const projectFiles = ["main.js", "test.js", "vite.config.js", "eslint.config.js", "src/**/*.js"];

export default defineConfig([
  {
    ignores: ["dist/**", "docs/**", "node_modules/**", "site/**", "**/*.min.js", "**/*.map"],
  },
  js.configs.recommended,
  {
    files: projectFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.nodeBuiltin,
        Galaxy: "readonly",
        gsap: "readonly",
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "warn",
    },
    rules: {
      "array-callback-return": "error",
      eqeqeq: ["error", "smart"],
      "no-async-promise-executor": "off",
      "no-case-declarations": "off",
      "no-console": "off",
      "no-constant-binary-expression": "error",
      "no-prototype-builtins": "off",
      "no-useless-assignment": "off",
      "no-useless-escape": "off",
      "no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
      "no-var": "error",
      "preserve-caught-error": "off",
    },
  },
]);
