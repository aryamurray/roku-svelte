type Subscriber<T> = (value: T) => void;
type Unsubscriber = () => void;
type Updater<T> = (value: T) => T;

interface Readable<T> {
  subscribe(run: Subscriber<T>): Unsubscriber;
}

interface Writable<T> extends Readable<T> {
  set(value: T): void;
  update(fn: Updater<T>): void;
}

export function writable<T>(initial: T): Writable<T> {
  let value = initial;
  const subscribers = new Set<Subscriber<T>>();

  return {
    subscribe(run: Subscriber<T>): Unsubscriber {
      subscribers.add(run);
      run(value);
      return () => subscribers.delete(run);
    },
    set(newValue: T) {
      value = newValue;
      subscribers.forEach((fn) => fn(value));
    },
    update(fn: Updater<T>) {
      value = fn(value);
      subscribers.forEach((sub) => sub(value));
    },
  };
}

export function readable<T>(initial: T): Readable<T> {
  return {
    subscribe(run: Subscriber<T>): Unsubscriber {
      run(initial);
      return () => {};
    },
  };
}
