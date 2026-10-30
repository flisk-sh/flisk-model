// Scores a service.json with the Flisk CLI's own validator, so the eval and the dataset
// use the same rules `flisk up` does. FLISK_REPO points at a flisk checkout with cli/dist built.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const repo = resolve(process.env.FLISK_REPO ?? "../flisk");
const mod = await import(pathToFileURL(`${repo}/cli/dist/utils/service-manifest.js`).href);

/** @returns {{ errors: string[], warnings: string[] }} */
export function validateService(value) {
  return mod.validateServiceManifest(value, "service.json");
}
