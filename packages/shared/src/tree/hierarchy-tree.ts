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
    target.values.push(value)
  }

  retrieve(path: string): V[] | undefined {
    return this.getNode(path)?.values
  }

  getNode(path: string | undefined): HierarchyNode<V> | undefined {
    if (path === undefined) {
      return
    }
    if (path === this.root.name) {
      return this.root
    }
    const names = path.split(this.separator)
    return names.reduce<HierarchyNode<V> | undefined>((node, name) => {
      return node?.children.get(name)
    }, this.root)
  }
}

export class HierarchyNode<V> {
  readonly name: string
  readonly path: string
  readonly parent?: HierarchyNode<V>
  readonly children: Map<string, HierarchyNode<V>>
  values: V[]

  constructor(name: string, parent?: HierarchyNode<V>) {
    this.name = name
    this.path = parent ? (parent.path ? `${parent.path}.${name}` : name) : ''
    this.parent = parent
    this.children = new Map()
    this.values = []
  }

  createChild(name: string): HierarchyNode<V> {
    const child = new HierarchyNode(name, this)
    this.children.set(name, child)
    return child
  }

  free() {
    this.parent?.children.delete(this.name)
    if (this.parent?.children.size === 0) {
      this.parent.free()
    }
  }
}
