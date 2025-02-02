
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: undefined,
  entryPointToBrowserMapping: {},
  assets: {
    'index.csr.html': {size: 9822, hash: 'e50d0414d3bec4d7ddb95f0ad2ae6eba06605ed58dc622cd610a119665dcb542', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 8906, hash: '99b973374eb7a0ab9a5ab3645c01267efd9ebb9b5bbb2ae1222d722f182fe99f', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-EAJ3YX6B.css': {size: 1328, hash: 'T1q+0EzjbfQ', text: () => import('./assets-chunks/styles-EAJ3YX6B_css.mjs').then(m => m.default)}
  },
};
