const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin'); // Import the plugin
const CopyPlugin = require('copy-webpack-plugin'); // Import CopyPlugin

module.exports = {
  entry: './src/index.ts', // Changed entry point to TypeScript
  output: {
    filename: 'virtual-background.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'VirtualBackground',
    libraryTarget: 'umd',
  },
  mode: 'production', // Can be changed to 'production'
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            compilerOptions: {
              module: 'esnext',
              target: 'es5',
              jsx: 'react'
            }
          }
        }
      }
    ],
  },
  // Add resolve configuration for TS files
  resolve: {
    extensions: ['.ts', '.js'],
  },
  // Add plugins here if needed
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html', // Path to your template index.html
      filename: 'index.html', // Output filename
      inject: 'head',
      scriptLoading: 'module'
    }),
    // Add CopyPlugin to copy MediaPipe assets
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'node_modules/@mediapipe/tasks-vision'),
          to: 'mediapipe/tasks-vision',
          globOptions: {
            ignore: ['**/*.ts', '**/*.json', '**/*.md']
          }
        },
        {
          from: path.resolve(__dirname, 'models'),
          to: 'mediapipe/models',
        },
      ]
    })
  ],
  devServer: {
    static: './dist',
  },
}; 