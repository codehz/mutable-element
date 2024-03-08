import { fragment, mutate } from "./mutable.js";
import { DynamicRange } from "./range.js";
import {
  ClassNameInput,
  ListAction,
  ListBasicAction,
  MutateAction,
  StyleDeclarationInput,
} from "./types.js";

async function mutateRange(ctx: DynamicRange, ret: MutateAction<DynamicRange>) {
  if (ret == null || typeof ret === "boolean") {
    return;
  } else if (ret instanceof Node) {
    ctx.end.parentNode!.insertBefore(ret, ctx.end);
  } else if (["string", "number", "bigint"].includes(typeof ret)) {
    ctx.static.deleteContents();
    ctx.end.parentNode!.insertBefore(
      document.createTextNode(ret + ""),
      ctx.end
    );
  } else if (Symbol.iterator in ret) {
    for (const item of ret) {
      await mutateRange(ctx, item);
    }
  } else if (Symbol.asyncIterator in ret) {
    for await (const item of ret) {
      await mutateRange(ctx, item);
    }
  } else if ("then" in ret && typeof ret.then === "function") {
    await mutateRange(ctx, await ret);
  } else if (typeof ret === "function") {
    await mutateRange(ctx, await ret.call(ctx, ctx));
  } else console.error("invalid object", ret);
}

function assignProps<T, R>(input: T, rhs: R): T & R {
  return Object.defineProperties(
    input,
    Object.getOwnPropertyDescriptors(rhs)
  ) as T & R;
}

/**
 * Attach a shadowdom to target element
 * @param init ShadowRootInit params
 * @param rest Initial mutate actions
 * @returns ShadowRoot mutate action
 */
export function shadow(
  init: ShadowRootInit,
  ...rest: MutateAction<ShadowRoot>[]
): (el: Node) => void {
  return (el: Node) => {
    if (el instanceof HTMLElement) {
      const root = el.attachShadow(init);
      (async () => {
        for (const p of rest) {
          await mutate(root, p);
        }
      })().catch(console.error);
    } else {
      throw new Error("HTMLElement expected");
    }
  };
}

/**
 * Create a stylesheet with templated content
 * @returns A mutate action for append stylesheet to target document (or ShadowDOM)
 */
export function css(
  template: string | { raw: readonly string[] | ArrayLike<string> },
  ...substitutions: any[]
): (node: Node) => void {
  const content =
    typeof template === "string"
      ? template
      : String.raw(template, ...substitutions);
  if ("adoptedStyleSheets" in document) {
    const stylesheet = new CSSStyleSheet();
    stylesheet.replaceSync(content);
    return (node) => {
      const root = node.getRootNode();
      if (root instanceof ShadowRoot) {
        root.adoptedStyleSheets = [
          ...new Set([...root.adoptedStyleSheets, stylesheet]),
        ];
      } else {
        document.adoptedStyleSheets = [
          ...new Set([...document.adoptedStyleSheets, stylesheet]),
        ];
      }
    };
  }
  return () => {
    const el = document.createElement("style");
    el.appendChild(document.createTextNode(content));
    return el;
  };
}

/**
 * Attach a event listener to target node
 * @param name Event name
 * @param listener Event Listener
 * @param options Event Listener Options
 * @returns Event Listener mutate action
 */
export function on<T extends Node>(
  name: string,
  listener: (this: T, event: Event) => MutateAction<T>,
  options?: AddEventListenerOptions
): (el: T) => void {
  return (el) => {
    el.addEventListener(
      name,
      (e) => void mutate(el, listener.call(el, e)).catch(console.error),
      options
    );
  };
}

/**
 * Modify target element's style
 * @param input Style input
 * @returns Modify style action
 */
export function style(input: StyleDeclarationInput): (el: Node) => void {
  return (el) => {
    if ("style" in el && el.style instanceof CSSStyleDeclaration) {
      for (const [key, value] of Object.entries(input)) {
        if (typeof value === "string") {
          if (key in el.style) {
            el.style[key as any] = value;
          }
          const realKey = key
            .replace(/^\$/, "-")
            .replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
          el.style.setProperty(realKey, value);
        } else if (!value) {
          const realKey = key
            .replace(/^\$/, "-")
            .replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
          el.style.removeProperty(realKey);
        }
      }
    } else {
      throw new Error("ElementCSSInlineStyle expected");
    }
  };
}

export function* processClassnames(
  ...inputs: ClassNameInput[]
): Generator<string> {
  for (const input of inputs) {
    if (typeof input === "string") {
      yield input;
    } else if (Array.isArray(input)) {
      yield* processClassnames(...input);
    } else if (typeof input === "object") {
      for (const item of Object.entries(input)
        .filter(([, v]) => v)
        .map(([x]) => x))
        yield item;
    }
  }
}

/**
 * Generate a mutate action for modify node's classnames
 * @param inputs Classname input
 * @returns Modify classname mutate action
 */
export function classnames(...inputs: ClassNameInput[]): (el: Node) => void {
  const result = [...new Set(processClassnames(inputs))].join(" ");
  return (el) => {
    if (el instanceof Element) {
      el.className = result;
    } else {
      throw new Error("Element expected");
    }
  };
}

/**
 * Generate a mutate action for modify node's attributes
 * @param input Attribute input
 * @returns Modify node' attribute mutate action
 */
export function attr(input: Record<string, unknown>): (el: Node) => void {
  return (el) => void Object.assign(el, input);
}

/**
 * Dataset function takes in an input object and returns a function that assigns the input object as data attributes
 * to an HTML element if the element is of type HTMLElement.
 *
 * @param input - An object containing data attributes to assign to the HTML element.
 * @returns A function that assigns the input object as data attributes to an HTML element if the element is of type HTMLElement.
 */
export function dataset(input: Record<string, unknown>): (el: Node) => void {
  return (el) =>
    void (el instanceof HTMLElement && Object.assign(el.dataset, input));
}

/**
 * Generate prepend action
 * @param node Target node
 * @returns Prepending target to current element actions
 */
export function prepend(
  ...rest: MutateAction<DocumentFragment>[]
): (el: Node | DynamicRange) => void {
  return (el) => void el.insertBefore(fragment(...rest), el.firstChild);
}

/**
 * Generate append action
 * @param node Target node
 * @returns Appending target to current element action
 */
export function append(
  ...rest: MutateAction<DocumentFragment>[]
): (el: Node | DynamicRange) => void {
  return (el) => void el.appendChild(fragment(...rest));
}

/**
 * Empty element
 */
export function empty(): (el: Node | DynamicRange) => void {
  return (el) => {
    if (el instanceof DynamicRange) {
      el.static.deleteContents();
    } else {
      while (el.firstChild) el.removeChild(el.firstChild);
    }
  };
}

export function namedRange(
  name: string,
  ...rest: MutateAction<DynamicRange>[]
): (() => DocumentFragment) & { range: DynamicRange } {
  const start = document.createComment(`range[${name}] start`);
  const end = document.createComment(`range[${name}] end`);
  const range = new DynamicRange(start, end);
  const frag = document.createDocumentFragment();
  frag.appendChild(start);
  frag.appendChild(end);
  (async () => {
    for (const p of rest) {
      await mutateRange(range, p);
    }
  })().catch(console.error);
  return Object.assign(() => frag, { range });
}

export function range(
  ...rest: MutateAction<DynamicRange>[]
): (() => DocumentFragment) & { range: DynamicRange } {
  const n = Math.random().toString(36).slice(2);
  return namedRange(n, ...rest);
}

export interface ListRenderer<T extends {}> {
  readonly name?: string;
  extractKey(input: T): string;
  render(input: T): MutateAction<DynamicRange>;
  update?(range: DynamicRange, input: T, old: T): MutateAction<DynamicRange>;
}

export class KeyedListRenderer<
  T extends {},
  K extends keyof {
    [P in keyof T as T[P] extends string ? P : never]: any;
  }
> implements ListRenderer<T>
{
  name?: string;
  constructor(
    private readonly key: K,
    public render: (input: T) => MutateAction<DynamicRange>,
    public update?: (
      range: DynamicRange,
      input: T,
      old: T
    ) => MutateAction<DynamicRange>
  ) {
    this.name = render.name || undefined;
  }
  extractKey(input: T): string {
    return (input as any)[this.key];
  }
}

export interface ListInterface<T> {
  readonly data: T[];
  eval(...rest: ListAction<T>[]): Promise<void>;
  assign(value: T[]): void;
  append(...value: T[]): void;
  appendUnique(...value: T[]): void;
  prepend(...value: T[]): void;
  prependUnique(...value: T[]): void;
  remove(...keys: string[]): void;
  clear(): void;
}

export function list<T extends {}>(
  renderer: ListRenderer<T>,
  initial?: T[]
): (() => DocumentFragment) & { range: DynamicRange } & ListInterface<T> {
  type Packed = { range: DynamicRange; value: T };
  const data = [] as Packed[];
  const n = renderer.name ?? "list-" + Math.random().toString(36).slice(2);
  let root: DynamicRange;

  function insertAt(item: T, point: Node) {
    const key = renderer.extractKey(item);
    const nrange = namedRange(n + ":" + key, renderer.render(item));
    point.parentNode!.insertBefore(nrange(), point);
    return nrange.range;
  }
  function appendData(value: T[], ref?: string) {
    if (ref) {
      const idx = data.findIndex((x) => renderer.extractKey(x.value) === ref);
      if (idx !== -1) {
        const pivot = data[idx + 1]?.range?.start ?? root.end;
        const newlist = [] as Packed[];
        for (const item of value) {
          const range = insertAt(item, pivot);
          newlist.push({ value: item, range });
        }
        data.splice(idx + 1, 0, ...newlist);
        return;
      }
    }
    for (const item of value) {
      const range = insertAt(item, root.end);
      data.push({ value: item, range });
    }
  }
  function prependData(value: T[], ref?: string) {
    if (ref) {
      const idx = data.findIndex((x) => renderer.extractKey(x.value) === ref);
      if (idx !== -1) {
        const pivot = data[idx].range.start;
        const newlist = [] as Packed[];
        for (const item of value) {
          const range = insertAt(item, pivot);
          newlist.push({ value: item, range });
        }
        data.splice(idx, 0, ...newlist);
        return;
      }
    }
    const pivot = data[0]?.range?.start ?? root.end;
    const newlist = [] as Packed[];
    for (const item of value) {
      const range = insertAt(item, pivot);
      newlist.push({ value: item, range });
    }
    data.unshift(...newlist);
  }
  function removeFromData(keys: string[]) {
    for (const key of keys) {
      const idx = data.findIndex((x) => renderer.extractKey(x.value) === key);
      if (idx >= 0) data.splice(idx, 1)[0].range.delete();
    }
  }
  function replace(packed: Packed, item: T, point = packed.range.start) {
    const range = insertAt(item, point);
    packed.range.delete();
    packed.value = item;
    packed.range = range;
  }
  function assignData(value: T[]) {
    for (let inputIdx = 0; inputIdx < value.length; inputIdx++) {
      const item = value[inputIdx];
      let originIdx = inputIdx;
      let found: Packed | undefined;
      for (; originIdx < data.length; originIdx++) {
        if (
          renderer.extractKey(data[originIdx].value) ===
          renderer.extractKey(item)
        ) {
          found = data[originIdx];
          break;
        }
      }
      if (found) {
        if (originIdx === inputIdx) {
          if (item !== found.value) {
            if (renderer.update) {
              const old = found.value;
              found.value = item;
              mutateRange(
                found.range,
                renderer.update(found.range, item, old)
              ).catch(console.error);
            } else {
              replace(found, item);
            }
          }
        } else {
          const pivot =
            inputIdx < data.length ? data[inputIdx].range.start : root.end;
          data.splice(originIdx, 1);
          data.splice(inputIdx, 0, found);
          if (item !== found.value) {
            if (!renderer.update) {
              replace(found, item, pivot);
              continue;
            }
            const old = found.value;
            found.value = item;
            mutateRange(
              found.range,
              renderer.update(found.range, item, old)
            ).catch(console.error);
          }
          const cached = found.range.detach();
          pivot.parentNode!.insertBefore(cached, pivot);
        }
      } else {
        const pivot =
          inputIdx < data.length ? data[inputIdx].range.start : root.end;
        const range = insertAt(item, pivot);
        data.splice(inputIdx, 0, { value: item, range });
      }
    }
    for (const item of data.splice(value.length, data.length - value.length))
      item.range.delete();
  }
  function processAction(action: ListBasicAction<T>) {
    switch (action.type) {
      case "assign":
        assignData(action.value);
        break;
      case "append":
        appendData(action.value, action.ref);
        break;
      case "prepend":
        prependData(action.value, action.ref);
        break;
      case "remove":
        removeFromData(action.keys);
        break;
      case "clear":
        data.length = 0;
        root.static.deleteContents();
        break;
      default:
        console.error("invalid action", action);
    }
  }
  async function* processList(
    action: ListAction<T>
  ): MutateAction<DynamicRange> {
    if (action == null) return;
    if (Symbol.iterator in action) {
      for (const item of action) {
        await processList(item);
      }
    } else if (Symbol.asyncIterator in action) {
      for await (const item of action) {
        await processList(item);
      }
    } else if ("then" in action) {
      await processList(await action);
    } else if (typeof action === "function") {
      await processList(action(data.map((x) => x.value)));
    } else if (typeof action === "object") {
      processAction(action);
    }
  }
  const ret = namedRange(n);
  root = ret.range;
  if (initial) processAction({ type: "assign", value: initial });
  return assignProps(ret, {
    get data() {
      return data.map((x) => x.value);
    },
    eval(...rest: ListAction<T>[]) {
      return mutateRange(root, processList(rest));
    },
    assign(value: T[]) {
      processAction({ type: "assign", value });
    },
    append(...value: T[]) {
      processAction({ type: "append", value });
    },
    appendUnique(...value: T[]) {
      processAction({
        type: "append",
        value: value.filter((x) =>
          data.every(
            (y) => renderer.extractKey(y.value) !== renderer.extractKey(x)
          )
        ),
      });
    },
    prepend(...value: T[]) {
      processAction({ type: "prepend", value });
    },
    prependUnique(...value: T[]) {
      processAction({
        type: "prepend",
        value: value.filter((x) =>
          data.every(
            (y) => renderer.extractKey(y.value) !== renderer.extractKey(x)
          )
        ),
      });
    },
    remove(...keys: string[]) {
      processAction({ type: "remove", keys });
    },
    clear() {
      processAction({ type: "clear" });
    },
  });
}
