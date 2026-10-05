import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const modules = new Map();

/** Compile local application modules for Node tests without browser tooling. */
export async function loadTypescript(url) {
  async function compile(target) {
    if (modules.has(target.href)) return modules.get(target.href);
    const source = await readFile(target, "utf8");
    let output = extname(target.pathname) === ".json"
      ? `export default ${source};`
      : ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      }).outputText;
    const specifiers = [...output.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)];
    for (const match of specifiers) {
      const name = match[1];
      let resolved;
      if (name.startsWith(".")) {
        let dependency = new URL(extname(name) ? name : `${name}.ts`, target);
        if (!extname(name) && !existsSync(dependency)) dependency = new URL(`${name}.tsx`, target);
        resolved = await compile(dependency);
      } else {
        resolved = pathToFileURL(require.resolve(name)).href;
      }
      output = output.replace(match[0], match[0].replace(/["'][^"']+["']$/, JSON.stringify(resolved)));
    }
    const compiled = `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
    modules.set(target.href, compiled);
    return compiled;
  }
  return import(await compile(url));
}
