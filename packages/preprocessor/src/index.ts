import { transformMarkup, type Platform } from "./parser.js";

export { transformMarkup, type Platform } from "./parser.js";

export interface PreprocessorOptions {
  platform: Platform;
}

export function svelteRokuPreprocess(options: PreprocessorOptions) {
  return {
    markup({ content }: { content: string; filename?: string }) {
      return {
        code: transformMarkup(content, options.platform),
      };
    },
  };
}
