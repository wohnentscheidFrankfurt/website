// The English map is online when the build copied it. The map repo decides that (ENGLISH_ONLINE in its
// pipeline/config.py), so the checks that depend on it read dist/.
import { existsSync } from "node:fs";

export const ENGLISH_MAP = existsSync("dist/en/sozialraum-frankfurt/index.html");
