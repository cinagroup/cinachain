// Keep the standalone Docusaurus build from inheriting the parent DApp's
// Tailwind/PostCSS pipeline. Docusaurus supplies its own default PostCSS
// plugins; this file only establishes the package boundary in the monorepo.
module.exports = {
  plugins: {},
}
