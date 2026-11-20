// Lets `node --test` run the app's TypeScript server code: see hooks.mjs.
import { register } from "node:module";
register("./hooks.mjs", import.meta.url);
