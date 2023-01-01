import { MutateAction } from "./types.js";

export async function mutate<T extends Node>(el: T, ret: MutateAction<T>) {
  if (ret == null || typeof ret === "boolean") {
    return;
  } else if (ret instanceof Node) {
    el.appendChild(ret);
  } else if (
    typeof ret === "string" ||
    typeof ret === "number" ||
    typeof ret === "bigint"
  ) {
    el.textContent = ret;
  } else if (Symbol.iterator in ret) {
    for (let item of ret) {
      await mutate(el, item);
    }
  } else if (Symbol.asyncIterator in ret) {
    for await (let item of ret) {
      await mutate(el, item);
    }
  } else if ("then" in ret) {
    await mutate(el, await ret);
  } else if (typeof ret === "function") {
    await mutate(el, await ret.call(el, el));
  } else console.error("invalid object", ret);
}

export async function mount<T extends Node>(el: T, ...rest: MutateAction<T>[]) {
  await mutate(el, rest);
  return el;
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
      for (let p of rest) {
        await mutate(el, p);
      }
    })().catch(console.error);
    return el;
  };
}

/**
 * Create a html node
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
export function text(...rest: MutateAction<Text>[]) {
  const el = document.createTextNode("");
  (async () => {
    for (let p of rest) {
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
export function fragment(...rest: MutateAction<DocumentFragment>[]) {
  const el = document.createDocumentFragment();
  (async () => {
    for (let p of rest) {
      await mutate(el, p);
    }
  })().catch(console.error);
  return el;
}
