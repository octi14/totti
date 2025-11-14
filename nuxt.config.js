export default {
  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    title: 'totti',
    htmlAttrs: {
      lang: 'en'
    },
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: '' },
      { name: 'format-detection', content: 'telephone=no' }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
    ]
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [
  ],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [
  ],

  // Auto import components: https://go.nuxtjs.dev/config-components
  components: true,

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [
  ],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    // https://go.nuxtjs.dev/bootstrap
    'bootstrap-vue/nuxt',
  ],

  serverMiddleware: [
    { path: '/api/s3/albums', handler: '~/server/api/s3.js' },
    { path: '/api/s3/manage', handler: '~/server/api/s3-manage.js' },
  ],

  // // BootstrapVue module configuration https://bootstrap-vue.org/docs#nuxtjs-module
  // bootstrapVue: {
  //   bootstrapCSS: false, // Or `css: false`
  //   icons: true,
  //   bootstrapVueCSS: false, // Or `bvCSS: false`
  // },

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {
  }
}
