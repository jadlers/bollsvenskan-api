// import typescript from "@rollup/plugin-typescript";
import typescript from "rollup-plugin-typescript2";

export default {
  input: "src/server.js",
  output: {
    dir: "build",
    format: "es",
  },
  plugins: [typescript()],
  external: [
    "@hapi/joi",
    "body-parser",
    "cors",
    "express",
    "http",
    "morgan",
    "on-finished",
    "pg-promise",
    "prom-client",
    "socket.io",
    "webdav",
  ],
};
