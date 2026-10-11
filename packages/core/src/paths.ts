import path from "node:path";
export const projectRoot = () =>
  /[\\/]apps[\\/]web$/.test(process.cwd())
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
export const artifactsRoot = () =>
  path.resolve(projectRoot(), process.env.ARTIFACT_DIR ?? "data/artifacts");
