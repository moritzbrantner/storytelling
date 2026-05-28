import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const exampleRoot = path.dirname(fileURLToPath(import.meta.url));
const serveUrl = await bundle(path.join(exampleRoot, "index.ts"));
const [composition] = await getCompositions(serveUrl, {
  inputProps: {},
});

if (!composition) {
  throw new Error("No Remotion composition found.");
}

await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  outputLocation: path.join(exampleRoot, "out", `${composition.id}.mp4`),
  inputProps: {},
});
