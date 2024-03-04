import { MutateAction } from "./types.js";

/**
 * Asynchronously applies mutations to the target node based on the given action.
 * 
 * * If the action is null or a boolean, the function returns early.
 * * If the action is an instance of Node, it appends the action to the target node.
 * * If the action is a string, number, or bigint, it sets the textContent of the target node.
 * * If the action is an iterable, async iterable, promise, or function, it recursively calls the mutate function for each item in the action.
 * * If the action does not match any of these types, it logs an error and do nothing.
 * @param {T} target - The target node to apply mutations to.
 * @param {MutateAction<T>} action - The action describing the mutation to be applied.
 * @returns {Promise<void>} - A Promise that resolves once all mutations are applied.
 */
export async function mutate<T extends Node>(
  target: T,
  action: MutateAction<T>
): Promise<void> {
  if (action == null || typeof action === "boolean") {
    return;
  } else if (action instanceof Node) {
    target.appendChild(action);
  } else if (
    typeof action === "string" ||
    typeof action === "number" ||
    typeof action === "bigint"
  ) {
    target.textContent = action;
  } else if (Symbol.iterator in action) {
    for (const item of action) {
      await mutate(target, item);
    }
  } else if (Symbol.asyncIterator in action) {
    for await (const item of action) {
      await mutate(target, item);
    }
  } else if ("then" in action) {
    await mutate(target, await action);
  } else if (typeof action === "function") {
    await mutate(target, await action.call(target, target));
  } else console.error("invalid object", action);
}

/**
 * Asynchronously applies mutate actions to a host node.
 * 
 * @see {@link mutate}
 * @param {T} host - The host node to apply the actions to.
 * @param {...MutateAction<T>[]} actions - The mutate actions to apply to the host node.
 * @returns {Promise<T>} - A promise that resolves with the modified host node.
 */
export async function mount<T extends Node>(
  host: T,
  ...actions: MutateAction<T>[]
): Promise<T> {
  await mutate(host, actions);
  return host;
}

function parseName(target: string, ns?: string) {
  const name = target.match(/^[\w-]*/g)![0];
  const element = ns
    ? document.createElementNS(ns, name)
    : document.createElement(name);
  let matched: RegExpMatchArray | null;
  if ((matched = target.match(/#([\w\-_]+)/))?.[1]) element.id = matched[1];
  for (const { groups } of target.matchAll(/\.(?<name>[\w\-_]+)/g))
    element.classList.add(groups!.name);
  for (const { groups } of target.matchAll(
    /\[(?<name>[\w_]+)(?:=(?<value>(?:\\.|[^\]])+)\])?/g
  ))
    element.setAttribute(groups!.name, groups!.value ?? "");
  return element;
}

function generateCreateElement<N extends Element>(name: string, ns?: string) {
  const el = parseName(name, ns) as N;
  return (...rest: MutateAction<N>[]) => {
    (async () => {
      for (const p of rest) {
        await mutate(el, p);
      }
    })().catch(console.error);
    return el;
  };
}

/**
 * Create a html node
 *
 * @example
 * ```js
 * html`div#id.class`(html`div#nested`('content'))
 * ```
 */
export function html(
  template: { raw: readonly string[] | ArrayLike<string> },
  ...substitutions: any[]
): (...rest: MutateAction<HTMLElement>[]) => HTMLElement {
  return generateCreateElement(String.raw(template, ...substitutions));
}

/**
 * Create a svg element
 */
export function svg(
  template: { raw: readonly string[] | ArrayLike<string> },
  ...substitutions: any[]
): (...rest: MutateAction<SVGElement>[]) => SVGElement {
  return generateCreateElement(
    String.raw(template, ...substitutions),
    "http://www.w3.org/2000/svg"
  );
}

/**
 * Create a mathml element
 */
export function mathml(
  template: { raw: readonly string[] | ArrayLike<string> },
  ...substitutions: any[]
): (...rest: MutateAction<MathMLElement>[]) => MathMLElement {
  return generateCreateElement(
    String.raw(template, ...substitutions),
    "http://www.w3.org/1998/Math/MathML"
  );
}

/**
 * Create a text node
 * @param rest Initial mutate actions
 * @returns TextNode
 */
export function text(...rest: MutateAction<Text>[]): Text {
  const el = document.createTextNode("");
  (async () => {
    for (const p of rest) {
      await mutate(el, p);
    }
  })().catch(console.error);
  return el;
}

/**
 * Create a DocumentFragment
 * @param rest Initial mutate actions
 * @returns DocumentFragment
 */
export function fragment(
  ...rest: MutateAction<DocumentFragment>[]
): DocumentFragment {
  const el = document.createDocumentFragment();
  (async () => {
    for (const p of rest) {
      await mutate(el, p);
    }
  })().catch(console.error);
  return el;
}
