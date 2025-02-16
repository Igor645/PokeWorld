
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: undefined,
  entryPointToBrowserMapping: {
  "node_modules/@angular/animations/fesm2022/browser.mjs": [
    {
      "path": "chunk-WOWNJSKN.js",
      "dynamicImport": false
    }
  ]
},
  assets: {
    'index.csr.html': {size: 32657, hash: 'fc5eb0083a641913094d8e52fde28722784fefe4126c110f739a225ff610150e', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 24797, hash: '8527b942861bff6298448153d8383a2d6a2410ca5c9be7d980f46272590230d1', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-OW7XI5CF.css': {size: 9597, hash: 'QASYudcs/9A', text: () => import('./assets-chunks/styles-OW7XI5CF_css.mjs').then(m => m.default)}
  },
};
