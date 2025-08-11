/**
 * The NamespaceTree is used to build a namespace-based tree structure that
 * supports inserting and retrieving path-associated data.
 *
 * @template V - The type of data stored in the tree
 */
export class NamespaceTree<V> {
  readonly root: NamespaceNode<V>
  readonly separator: string

  constructor(separator: string) {
    this.root = new NamespaceNode('')
    this.separator = separator
  }

  /**
   * Inserts a value into the tree at the specified path.
   *
   * @param path - The namespace path to insert the value at
   * @param value - The value to insert
   */
  insert(path: string, value: V): void {
    if (!path) {
      return
    }
    const names = path.split(this.separator)
    const target = names.reduce((node, name) => node.children.get(name) ?? node.createChild(name), this.root)
    target.data.add(value)
  }

  /**
   * Retrieves all values stored at the specified path in the tree.
   *
   * @param path - The namespace path to retrieve values from
   * @returns A set of values stored at the path, or an empty set if none exist
   */
  find(path: string): ReadonlySet<V> {
    return this.findNode(path)?.data ?? new Set()
  }

  /**
   * Finds the node at the specified path in the tree.
   *
   * @param path - The namespace path to find
   * @returns The node at the specified path, or undefined if not found
   */
  findNode(path: string): NamespaceNode<V> | undefined {
    if (path === this.root.name) {
      return this.root
    }
    const names = path.split(this.separator)
    return names.reduce<NamespaceNode<V> | undefined>((node, name) => node?.children.get(name), this.root)
  }
}

export class NamespaceNode<V> {
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

  hasData(): boolean {
    return this.data.size > 0
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
