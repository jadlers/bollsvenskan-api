// import typescript from "@rollup/plugin-typescript";
import typescript from "rollup-plugin-typescript2";
import jsonModule from "@rollup/plugin-json";

export default {
  input: "src/server.js",
  output: {
    dir: "build",
    format: "es",
  },
  plugins: [typescript(), jsonModule()],
  external: [
    "@hapi/joi",
    "body-parser",
    "compression",
    "cors",
    "express",
    "http",
    "morgan",
    "node-fetch",
    "on-finished",
    "pg-promise",
    "prom-client",
    "socket.io",
    "webdav",
  ],
};
