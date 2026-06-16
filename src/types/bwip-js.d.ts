// Minimal ambient declaration for bwip-js (browser bundle).
// The package ships its own types in dist/, but the CJS-style `export =`
// combined with the package.json `exports` map can fail to resolve on some
// CI TypeScript versions.  This file ensures the module is always found.

declare module "bwip-js" {
  interface RenderOptions {
    bcid: string;
    text: string;
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    height?: number;
    width?: number;
    includetext?: boolean;
    textxalign?: string;
    textsize?: number;
    paddingwidth?: number;
    paddingheight?: number;
    [key: string]: unknown;
  }

  function toCanvas(
    canvas: HTMLCanvasElement | string,
    opts: RenderOptions,
  ): HTMLCanvasElement;

  export { toCanvas };
  export { RenderOptions };
}
