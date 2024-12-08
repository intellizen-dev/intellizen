import type { AstNode } from 'langium'

export class HierarchyTree<V> {
  readonly root: HierarchyNode<V>
  readonly separator: string

  constructor(separator: string = '.') {
    this.root = new HierarchyNode('')
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

  find(path: string): HierarchyNode<V> | undefined {
    if (path === this.root.name) {
      return this.root
    }
    const names = path.split(this.separator)
    return names.reduce<HierarchyNode<V> | undefined>((node, name) => node?.children.get(name), this.root)
  }
}

export class HierarchyNode<V> implements AstNode {
  readonly $type = 'SyntheticHierarchyNode'
  readonly name: string
  readonly parent?: HierarchyNode<V>
  readonly children: Map<string, HierarchyNode<V>>
  readonly data: Set<V>

  constructor(name: string, parent?: HierarchyNode<V>) {
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

  createChild(name: string): HierarchyNode<V> {
    const child = new HierarchyNode(name, this)
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

export function isHierarchyNode(node: unknown): node is HierarchyNode<unknown> {
  return node instanceof HierarchyNode
}
