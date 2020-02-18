export { abort, sh, glob, moduleFileName }

  import { walkSync } from "https://deno.land/std@v0.33.0/fs/mod.ts"
import { globToRegExp, isAbsolute, sep } from "https://deno.land/std@v0.33.0/path/mod.ts"

class DrakeError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "DrakeError";
  }
}

function abort(message: string): void {
  throw new DrakeError(message);
}

// Ensure file name confirms to Deno module path name convention.
function moduleFileName(name: string): string {
  if (!isAbsolute(name) && !name.startsWith(".")) {
    return "." + sep + name;
  }
  return name;
}

// Return array of file names matching the glob patterns relative to the current working directory.
// e.g. glob("tmp/*.ts", "lib/*.ts", "mod.ts");
function glob(...patterns: string[]): string[] {
  const regexps = patterns.map(pat => globToRegExp(pat));
  const iter = walkSync(".", { match: regexps, includeDirs: false });
  return Array.from(iter, info => moduleFileName(info.filename));
}

// Start shell command and return status promise.
function launch(cmd: string): Promise<Deno.ProcessStatus> {
  let args: string[];
  if (Deno.build.os === "win") {
    args = [Deno.env("COMSPEC"), "/C", cmd];
  } else {
    args = [Deno.env("SHELL"), "-c", cmd];
  }
  // create subprocess
  const p = Deno.run({
    args: args,
    stdout: "inherit"
  });
  return p.status();
}

// Execute shell commands.
// If 'cmds` is a string execute it in the command shell.
// If 'cmds` is a string array execute each command in parallel.
// If any command fails throw and error.
async function sh(cmds: string | string[]) {
  let cmd: string;
  let code: number;
  if (typeof cmds === "string") {
    cmd = cmds;
    code = (await launch(cmds)).code;
  } else {
    const promises = [];
    for (const cmd of cmds) {
      promises.push(launch(cmd));
    }
    const results = await Promise.all(promises);
    for (const i in results) {
      cmd = cmds[i];
      code = results[i].code;
      if (code !== 0) {
        break;
      }
    }
  }
  if (code !== 0) {
    abort(`sh: ${cmd}: error code: ${code}`);
  }
}
