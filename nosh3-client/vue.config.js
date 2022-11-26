const { defineConfig } = require('@vue/cli-service')
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

module.exports = defineConfig({
  publicPath: '/app/',
  transpileDependencies: [
    'quasar',
  ],
  pluginOptions: {
    quasar: {
      importStrategy: 'kebab',
      rtlSupport: false,
    },
  },
  configureWebpack: {
    plugins: [
      new NodePolyfillPlugin
    ],
    optimization: {
      splitChunks: {
        chunks: "all",
      },
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules(?!(\/|\\)pdfjs-dist)/,
          loader: 'babel-loader',
          options: {
              'presets': ['@babel/preset-env'],
              'plugins': ['@babel/plugin-proposal-optional-chaining', '@babel/plugin-proposal-private-methods'],
              'generatorOpts': {compact: true}
          }
        }
      ]
    }
  }
})
