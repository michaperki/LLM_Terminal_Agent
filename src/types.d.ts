declare module 'diff' {
  export function diffLines(oldStr: string, newStr: string, options?: any): any[];
  export function applyPatch(source: string, patch: string): string | boolean;
  export function createPatch(fileName: string, oldStr: string, newStr: string, oldHeader?: string, newHeader?: string): string;
}

// Fix for Intl.Segmenter not being recognized
declare namespace Intl {
  class Segmenter {
    constructor(locale?: string | string[], options?: any);
    segment(input: string): any;
  }
}