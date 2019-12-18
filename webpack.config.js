const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: {
        mcg: './src/js/mcg.js',
    },
    output: {
        filename: "js/[name].js",
        path: path.resolve(__dirname, 'dist/'),
    },
    module: {
        rules: [
          // any other rules
          {
            // Exposes jQuery for use outside Webpack build
            test: [
              require.resolve('jquery'),
              /\.(js)$/
            ],
            exclude: /node_modules/,
            use: [{
              loader: 'expose-loader',
              options: 'jQuery'
            },{
              loader: 'expose-loader',
              options: '$'
            },
            'babel-loader'
            ]
          }
        ]
      },
      plugins: [
        // Provides jQuery for other JS bundled with Webpack
        new webpack.ProvidePlugin({
          $: 'jquery',
          jQuery: 'jquery'
        }),
        new CopyPlugin([
            { from: './src/index.html', to: './index.html' },
            { from: './src/images', to: './images' },
            { from: './src/css', to: './css' },
          ]),
      ]
};
