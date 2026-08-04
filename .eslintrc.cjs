/* eslint-env node */
const path = require("path")

module.exports = {
  root: true,
  extends: [
    "next/core-web-vitals",
    "eslint:recommended",
    "prettier",
    "plugin:tailwindcss/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  plugins: ["@typescript-eslint", "tailwindcss"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  rules: {
    "@next/next/no-html-link-for-pages": "off",
    "@next/next/no-img-element": "off", // We currently not using next/image because it isn't supported with SSG mode
    "react-hooks/exhaustive-deps": "off", // Incorrectly report needed dependency with Next.js router
    "tailwindcss/no-custom-classname": "error",
    "tailwindcss/classnames-order": "error",
    "@typescript-eslint/no-misused-promises": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "no-unused-vars": "off",
  },
  settings: {
    tailwindcss: {
      callees: ["cn"],
      // Absolute path — the plugin resolves `tailwindcss` from the config's
      // directory, and a relative path (".") breaks package resolution.
      config: path.resolve(__dirname, "tailwind.config.js"),
    },
    next: {
      rootDir: true,
    },
  },
}
