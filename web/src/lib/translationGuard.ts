// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Page translators (Chrome or Edge "Translate this page", translation extensions) replace the page's text nodes with
// their own elements (<font>). React still holds the original nodes, so when it later inserts or removes a node next to
// one of them the browser throws ("The node before which the new node is to be inserted is not a child of this node")
// and React unmounts the whole app: a blank page. Known React issue (facebook/react#11538).
//
// This guard makes those two DOM calls tolerant: when the node React points at was moved inside a translator's wrapper,
// the call acts on the wrapper instead (or appends / does nothing when the node is gone). It changes nothing when the
// page is not being translated, because then every node is where React left it.
//
// Stale text is the other half of the problem: React updates the original text node, which is no longer on the page.
// Texts that change after loading are therefore rendered as the only child of their own element (see CellTrends and
// MethodView), so React replaces the element's whole content.

/** The direct child of `parent` that contains `node` (the translator's wrapper), or null when there is none. */
function childHolding(parent: Node, node: Node): Node | null {
  let current: Node | null = node
  while (current && current.parentNode !== parent) current = current.parentNode
  return current
}

export function installTranslationGuard(): void {
  if (typeof Node !== 'function' || !Node.prototype) return
  const proto = Node.prototype as Node & { __signoGuard?: boolean }
  if (proto.__signoGuard) return
  proto.__signoGuard = true

  const removeChild = proto.removeChild
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode === this) return removeChild.call(this, child) as T
    const wrapper = childHolding(this, child)
    if (wrapper) removeChild.call(this, wrapper)
    return child
  }

  const insertBefore = proto.insertBefore
  proto.insertBefore = function <T extends Node>(this: Node, node: T, reference: Node | null): T {
    if (reference === null || reference.parentNode === this) return insertBefore.call(this, node, reference) as T
    return insertBefore.call(this, node, childHolding(this, reference)) as T
  }
}
