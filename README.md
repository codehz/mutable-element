<div align="center">
<h2>Mutable Element</h2>
<p align="center">
  <p>A library for create and manipulate html element with modern javascript syntax</p>
</p>
</div>

## Example

The following example shows how to display a counter that starts at zero and increments by 1 every second:

```js
import { mount, html, text, clock } from "mutable-element"; // or @codehz/mutable-element if use jsr
mount(
  document.body,
  html`div`(
    text("counter: "),
    text("0", async function* () {
      // just use any local state
      let value = 0;
      // use a async generator
      for await (const _ of clock(1000)) {
        // yield new value
        yield ++value;
        // remove itself if not connected to dom
        if (!this.isConnected) break;
      }
    })
  )
);
```

The following example shows how to respond to a button event and change the text:

```js
import { mount, html, text, on, stream } from "mutable-element"; // or @codehz/mutable-element if use jsr
const stream = new Reactor();
mount(
  document.body,
  html`div`(
    html`button`(
      "click me!",
      on("click", () => void stream.push())
    ),
    text("click count: "),
    text("0", async function* () {
      let value = 0;
      for await (const _ of stream) {
        yield ++value;
        if (!this.isConnected) break;
      }
    })
  )
);
```
