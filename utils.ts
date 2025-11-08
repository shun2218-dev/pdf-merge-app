import { dirname as _dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const dirname = typeof __dirname !== "undefined" ? __dirname : _dirname(fileURLToPath(import.meta.url));
