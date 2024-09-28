export class HierarchyTree<V> {
  readonly root: HierarchyNode<V>
  readonly separator: string

  constructor(separator: string = '.') {
    this.root = new HierarchyNode('')
    this.separator = separator
  }

  getNode(path: string): HierarchyNode<V> | undefined {
    if (path === this.root.name) {
      return this.root
    }
    else {
      const names = path.split(this.separator)
      return names.reduce<HierarchyNode<V> | undefined>((node, name) => {
        return node?.children.get(name)
      }, this.root)
    }
  }

  getValue(path: string): V | undefined {
    return this.getNode(path)?.value
  }

  setValue(path: string, value: V | undefined): void {
    const names = path.split(this.separator)
    const target = names.reduce((node, name) => {
      return node.children.get(name) || node.createChild(name)
    }, this.root)
    target.value = value
  }
}

export class HierarchyNode<V> {
  readonly name: string
  readonly path: string
  readonly parent: HierarchyNode<V> | undefined
  readonly children: Map<string, HierarchyNode<V>>
  value?: V

  constructor(name: string, parent?: HierarchyNode<V>) {
    this.name = name
    this.path = parent ? (parent.path ? `${parent.path}.${name}` : name) : ''
    this.parent = parent
    this.children = new Map()
  }

  createChild(name: string): HierarchyNode<V> {
    const child = new HierarchyNode(name, this)
    this.children.set(name, child)
    return child
  }
}
