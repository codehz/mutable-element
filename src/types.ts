import { Properties } from "csstype";
/**
 * All possible mutate action
 */
export type MutateAction<N = Node> =
  | void
  | null
  | undefined
  | Node
  | Iterable<MutateAction<N>>
  | AsyncIterable<MutateAction<N>>
  | PromiseLike<MutateAction<N>>
  | ((this: N, el: N) => MutateAction<N>);

type ListBasicActionMap<T> = {
  append: { value: T[]; ref?: string };
  prepend: { value: T[]; ref?: string };
  assign: { value: T[] };
  remove: { keys: string[] };
  clear: {};
};

type IntoUnion<T> = {
  [K in keyof T]: { type: K } & T[K];
}[keyof T];

export type ListBasicAction<T> = IntoUnion<ListBasicActionMap<T>>;

export type ListAction<T> =
  | void
  | null
  | undefined
  | ListBasicAction<T>
  | Iterable<ListAction<T>>
  | AsyncIterable<ListAction<T>>
  | PromiseLike<ListAction<T>>
  | ((current: ReadonlyArray<T>) => ListAction<T>);

/**
 * Style input
 * transform $CustomVar to --custom-var
 */
export type StyleDeclarationInput = Properties & {
  [K in `$${string}`]?: string | number | null;
};

/**
 * classnames input, can be string or array or object
 */
export type ClassNameInput =
  | string
  | boolean
  | Record<string, boolean>
  | ClassNameInput[];
