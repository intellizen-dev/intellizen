import type { AstNode } from 'langium'

export class NamespaceTree<V> {
  readonly root: NamespaceNode<V>
  readonly separator: string

  constructor(separator: string) {
    this.root = new NamespaceNode('')
    this.separator = separator
  }

  insert(path: string, value: V): void {
    if (!path) {
      return
    }
    const names = path.split(this.separator)
    const target = names.reduce((node, name) => node.children.get(name) || node.createChild(name), this.root)
    target.data.add(value)
  }

  retrieve(path: string): ReadonlySet<V> {
    return this.find(path)?.data ?? new Set()
  }

  find(path: string): NamespaceNode<V> | undefined {
    if (path === this.root.name) {
      return this.root
    }
    const names = path.split(this.separator)
    return names.reduce<NamespaceNode<V> | undefined>((node, name) => node?.children.get(name), this.root)
  }
}

export class NamespaceNode<V> implements AstNode {
  readonly $type = 'SyntheticNamespaceNode'
  readonly name: string
  readonly parent?: NamespaceNode<V>
  readonly children: Map<string, NamespaceNode<V>>
  readonly data: Set<V>

  constructor(name: string, parent?: NamespaceNode<V>) {
    this.name = name
    this.parent = parent
    this.children = new Map()
    this.data = new Set()
  }

  isDataNode(): boolean {
    return this.data.size > 0
  }

  isInternalNode(): boolean {
    return this.data.size === 0
  }

  createChild(name: string): NamespaceNode<V> {
    const child = new NamespaceNode(name, this)
    this.children.set(name, child)
    return child
  }

  delete(value: V): void {
    this.data.delete(value)
    if (this.shouldFree()) {
      this.free()
    }
  }

  free() {
    this.parent?.children.delete(this.name)
    if (this.parent?.shouldFree()) {
      this.parent.free()
    }
  }

  private shouldFree() {
    return this.data.size === 0 && this.children.size === 0
  }
}

export function isNamespaceNode(node: unknown): node is NamespaceNode<unknown> {
  return node instanceof NamespaceNode
}
