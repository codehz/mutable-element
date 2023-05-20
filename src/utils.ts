export class Resolver<T> {
  resolve!: (value: T) => void;
  reject!: (error: any) => void;
  promise = new Promise<T>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });
}

export class Reactor<T = void> implements AsyncIterableIterator<T> {
  [Symbol.asyncIterator](): AsyncIterableIterator<T> {
    return this;
  }
  protected done_flag = false;
  protected wait: Resolver<IteratorResult<T, void>> | null = null;
  constructor(protected onExit?: () => void) {}
  static create<T = void>(
    handler: (
      push: (input: T) => boolean,
      stop: () => void
    ) => void | (() => void)
  ) {
    const reactor: Reactor<T> = new Reactor<T>();
    reactor.onExit =
      handler(reactor.push.bind(reactor), reactor.stop.bind(reactor)) ??
      undefined;
    return reactor;
  }
  push(input: T): boolean {
    if (this.done_flag) return false;
    if (this.wait) {
      this.wait.resolve({
        done: false,
        value: input,
      });
      this.wait = null;
      return true;
    }
    return false;
  }
  stop() {
    if (this.done_flag) return;
    this.done_flag = true;
    if (this.wait) {
      this.wait.resolve({
        done: true,
        value: undefined,
      });
      this.wait = null;
    }
  }
  next(): Promise<IteratorResult<T, void>> {
    return this.done_flag
      ? Promise.resolve({
          done: true,
          value: undefined,
        })
      : (this.wait ??= new Resolver()).promise;
  }
  return(): Promise<IteratorResult<T, void>> {
    if (!this.done_flag) this.onExit?.();
    this.done_flag = true;
    if (this.wait) {
      this.wait.resolve({
        done: true,
        value: undefined,
      });
      this.wait = null;
    }
    return Promise.resolve({
      done: true,
      value: undefined,
    });
  }
  throw(): Promise<IteratorResult<T, void>> {
    if (!this.done_flag) this.onExit?.();
    this.done_flag = true;
    if (this.wait) {
      this.wait.resolve({
        done: true,
        value: undefined,
      });
      this.wait = null;
    }
    return Promise.resolve({
      done: true,
      value: undefined,
    });
  }
}

export class BufferedReactor<T> extends Reactor<T> {
  private queue: T[] = [];
  static create<T = void>(
    handler: (
      push: (input: T) => boolean,
      stop: () => void
    ) => void | (() => void)
  ) {
    const reactor: BufferedReactor<T> = new BufferedReactor<T>();
    reactor.onExit =
      handler(reactor.push.bind(reactor), reactor.stop.bind(reactor)) ??
      undefined;
    return reactor;
  }
  push(input: T): boolean {
    if (this.done_flag) return false;
    if (this.wait) {
      this.wait.resolve({
        done: false,
        value: input,
      });
      this.wait = null;
      return true;
    } else {
      this.queue.push(input);
      return false;
    }
  }
  next(): Promise<IteratorResult<T, void>> {
    const value = this.queue.shift();
    if (value) {
      return Promise.resolve({
        done: false,
        value,
      });
    } else if (this.done_flag) {
      return Promise.resolve({
        done: true,
        value: undefined,
      });
    } else {
      return (this.wait ??= new Resolver()).promise;
    }
  }
}

export function listen<T extends Event = Event>(
  node: EventTarget,
  event: string,
  options?: Omit<AddEventListenerOptions, "once" | "signal">
) {
  const controller = new AbortController();
  const reactor = new BufferedReactor<T>(() => controller.abort());
  node.addEventListener(event, (e) => reactor.push(e as T), {
    ...options,
    signal: controller.signal,
  });
  return reactor;
}

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clock(ms: number) {
  return Reactor.create((push) => {
    const handler = setInterval(push, ms);
    return () => clearInterval(handler);
  });
}

export function animationFrame() {
  return Reactor.create<DOMHighResTimeStamp>((push) => {
    const handler = requestAnimationFrame(function cb(time) {
      push(time);
      requestAnimationFrame(cb);
    });
    return () => cancelAnimationFrame(handler);
  });
}

export function idle() {
  return Reactor.create<IdleDeadline>((push) => {
    const handler = requestIdleCallback(function cb(time) {
      push(time);
      requestIdleCallback(cb);
    });
    return () => cancelIdleCallback(handler);
  });
}
