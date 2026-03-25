declare module 'awesomplete' {
  export type AwesompleteListItem = string | { label: string; value: string };

  export interface AwesompleteOptions {
    list?: AwesompleteListItem[] | HTMLElement;
    minChars?: number;
    maxItems?: number;
    autoFirst?: boolean;
    data?: (item: AwesompleteListItem, input: string) => string;
    filter?: (text: string, input: string) => boolean;
    sort?: (a: string, b: string, input: string) => number;
    item?: (text: string, input: string) => HTMLElement;
    replace?: (text: string) => void;
    container?: (parent: HTMLElement) => HTMLElement;
  }

  export default class Awesomplete {
    constructor(input: HTMLInputElement, options?: AwesompleteOptions);
    list: AwesompleteListItem[] | HTMLElement;
    minChars: number;
    maxItems: number;
    autoFirst: boolean;
    evaluate(): void;
    next(): void;
    previous(): void;
    goto(i: number): void;
    select(): void;
    open(): void;
    close(): void;
    destroy(): void;
  }
}
