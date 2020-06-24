// import typescript from "@rollup/plugin-typescript";
import typescript from "rollup-plugin-typescript2";

export default {
  input: "src/server.js",
  output: {
    dir: "build",
    format: "es",
  },
  plugins: [typescript()]
};

