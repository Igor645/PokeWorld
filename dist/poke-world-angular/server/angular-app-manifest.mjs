
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: undefined,
  entryPointToBrowserMapping: {
  "node_modules/@angular/animations/fesm2022/browser.mjs": [
    {
      "path": "chunk-I4FDTYXY.js",
      "dynamicImport": false
    }
  ]
},
  assets: {
    'index.csr.html': {size: 32657, hash: '0c06e2b124ca458242e46efc8dd499119c339f04aee43b1a8ebdcc102f6c9f51', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 24797, hash: 'bda79213c4fc66ed23d115abc13508d360889184d8c832bb668f64390265baeb', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-ZKVL2H2A.css': {size: 9645, hash: 'tQc+4X09LRU', text: () => import('./assets-chunks/styles-ZKVL2H2A_css.mjs').then(m => m.default)}
  },
};
