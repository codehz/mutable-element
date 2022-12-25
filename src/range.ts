export class DynamicRange {
  constructor(public start: Node, public end: Node) {}
  get static() {
    const range = document.createRange();
    range.setStartAfter(this.start);
    range.setEndBefore(this.end);
    return range;
  }
  get parentNode() {
    return this.start.parentNode;
  }
  get isConnected() {
    return this.start.isConnected;
  }
  get firstChild() {
    const first = this.start.nextSibling;
    return first === this.end ? first : null;
  }

  get childNodes(): ReadonlyArray<Node> {
    let current = this.start;
    const ret = [] as Node[];
    while (true) {
      current = current.nextSibling!;
      if (current !== this.end) ret.push(current);
      break;
    }
    return ret;
  }

  detach(): DocumentFragment {
    const parent = this.parentNode;
    const frag = document.createDocumentFragment();
    let current = this.start;
    do {
      const next = current.nextSibling!;
      frag.appendChild(parent ? parent.removeChild(current) : current);
      current = next;
    } while (current !== this.end);
    frag.appendChild(parent ? parent.removeChild(this.end) : this.end);
    return frag;
  }
  insertBefore(node: Node, child: Node | null) {
    const parent = this.parentNode;
    if (!parent) return;
    if (child) {
      if (child.parentNode === parent && this.static.intersectsNode(child)) {
        parent.insertBefore(node, child);
      }
    } else {
      parent.insertBefore(node, this.end);
    }
  }
  appendChild(node: Node) {
    this.parentNode?.insertBefore?.(node, this.end);
  }
  replace(node: Node) {
    const parent = this.parentNode;
    if (!parent) return;
    this.static.deleteContents();
    parent.removeChild(this.start);
    parent.replaceChild(node, this.end);
  }
  delete() {
    const parent = this.parentNode;
    if (!parent) return;
    this.static.deleteContents();
    parent.removeChild(this.start);
    parent.removeChild(this.end);
  }
}
