/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  assetPrefix: '/',
  webpack(config) {
    // @xenova/transformers: disable Node.js native ONNX backend so webpack
    // only bundles the browser-based WASM backend. Without this, webpack
    // chokes on the .node binary file inside onnxruntime-node.
    config.resolve.alias = {
      ...config.resolve.alias,
      'sharp$': false,
      'onnxruntime-node$': false,
    };
    return config;
  },
};
export default nextConfig;
