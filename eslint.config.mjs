import tsparser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";

// The community scanner runs this rule set against the repository and publishes
// the result as a Scorecard, so warnings matter as much as errors here.
export default [
  {
    ignores: [
      "main.js",
      "pdf.worker.js",
      "node_modules/**",
      "promo-video/**",
      "vault/**",
      "scratch/**",
      "build-stubs/**",
      "src/main.js",
      "esbuild.config.mjs",
      "version-bump.mjs",
      "patch-pdfjs.cjs",
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-unsafe-declaration-merging": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-base-to-string": "off",
    },
  },
  {
    files: ["package.json"],
    rules: {
      "depend/ban-dependencies": "off",
    },
  },
  {
    files: ["src/**/*.{js,ts}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Replaced at build time by esbuild's `define` with the pdf.js worker
        // source, so it never exists as a variable in the shipped file.
        __PDF_WORKER_CODE__: "readonly",
        // CSS Custom Highlight API, used for the in-book search paint.
        Highlight: "readonly",
        // Provided by Obsidian at runtime rather than imported.
        activeDocument: "readonly",
        activeWindow: "readonly",
        document: "readonly",
        window: "readonly",
        globalThis: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        DOMParser: "readonly",
        FileReader: "readonly",
        Node: "readonly",
        NodeFilter: "readonly",
        HTMLElement: "readonly",
        Event: "readonly",
        ResizeObserver: "readonly",
        performance: "readonly",
        fetch: "readonly",
        Blob: "readonly",
        URL: "readonly",
      },
    },
  },
];
