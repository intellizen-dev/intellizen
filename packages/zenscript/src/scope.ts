import type { AstNode, AstNodeDescription, AstNodeDescriptionProvider, LangiumCoreServices, LangiumDocument, PrecomputedScopes, ScopeComputation } from 'langium'
import { MultiMap, interruptAndCheck } from 'langium'
import { CancellationToken } from 'vscode-languageserver'
import type { CallableDeclaration, ClassDeclaration, FunctionDeclaration, ImportDeclaration, Statement } from './generated/ast'
import { isBlockStatement, isCallableDeclaration, isConstructorDeclaration, isForStatement, isScript, isVariableDeclaration } from './generated/ast'

export class ZenScriptScopeComputation implements ScopeComputation {
  private readonly descriptions: AstNodeDescriptionProvider

  constructor(services: LangiumCoreServices) {
    this.descriptions = services.workspace.AstNodeDescriptionProvider
  }

  async computeExports(document: LangiumDocument, cancelToken: CancellationToken = CancellationToken.None): Promise<AstNodeDescription[]> {
    const exports: AstNodeDescription[] = []

    const root = document.parseResult?.value
    if (!isScript(root)) {
      return exports
    }

    const packageName = getPackageName(document)

    for (const clazz of root.classes) {
      await interruptAndCheck(cancelToken)
      await this.exportClass(clazz, document, exports, packageName)
    }

    for (const functionDeclaration of root.functions) {
      await interruptAndCheck(cancelToken)
      await this.exportFunction(functionDeclaration, document, exports, packageName)
    }

    for (const stmt of root.statements) {
      await interruptAndCheck(cancelToken)
      await this.exportVariable(stmt, document, exports, packageName)
    }

    return exports
  }

  async computeLocalScopes(document: LangiumDocument, cancelToken: CancellationToken = CancellationToken.None): Promise<PrecomputedScopes> {
    const root = document.parseResult?.value
    // This map stores a list of descriptions for each node in our document
    const scopes = new MultiMap<AstNode, AstNodeDescription>()
    if (!isScript(root)) {
      return scopes
    }

    for (const importDecl of root.imports) {
      await this.processImport(importDecl, document, scopes, cancelToken)
    }

    for (const clazz of root.classes) {
      await this.processClassMembers(clazz, document, scopes, cancelToken)
    }

    for (const functionDeclaration of root.functions) {
      await this.processCallable(functionDeclaration, document, scopes, cancelToken)
    }

    this.processStatements(root, root.statements, document, scopes, cancelToken)

    return scopes
  }

  // #region computeExports
  private async exportClass(clazz: ClassDeclaration, document: LangiumDocument, exports: AstNodeDescription[], packageName: string): Promise<void> {
    if (!clazz.name) {
      return
    }

    const qualifiedName = `${packageName}.${clazz.name}`
    const desc = this.descriptions.createDescription(clazz, qualifiedName, document)
    exports.push(desc)
  }

  private async exportFunction(functionDeclaration: FunctionDeclaration, document: LangiumDocument, exports: AstNodeDescription[], packageName: string): Promise<void> {
    if (!functionDeclaration.name) {
      return
    }

    if (functionDeclaration.prefix === 'global') {
      const desc = this.descriptions.createDescription(functionDeclaration, functionDeclaration.name, document)
      exports.push(desc)
    }
    else if (functionDeclaration.prefix === 'static') {
      const qualifiedName = `${packageName}.${functionDeclaration.name}`
      const desc = this.descriptions.createDescription(functionDeclaration, qualifiedName, document)
      exports.push(desc)
    }
  }

  private async exportVariable(stmt: Statement, document: LangiumDocument, exports: AstNodeDescription[], packageName: string): Promise<void> {
    if (!isVariableDeclaration(stmt) || !stmt.name) {
      return
    }

    if (stmt.prefix === 'global') {
      const desc = this.descriptions.createDescription(stmt, stmt.name, document)
      exports.push(desc)
    }
    else if (stmt.prefix === 'static') {
      const qualifiedName = `${packageName}.${stmt.name}`
      const desc = this.descriptions.createDescription(stmt, qualifiedName, document)
      exports.push(desc)
    }
  }
  // #endregion computeExports

  // #region computeLocalScopes
  private async processImport(importDecl: ImportDeclaration, document: LangiumDocument, scopes: PrecomputedScopes, cancelToken: CancellationToken): Promise<void> {
    await interruptAndCheck(cancelToken)
    const name = importDecl.alias || importDecl.ref.$refText.substring(importDecl.ref.$refText.lastIndexOf('.') + 1)

    const desc = this.descriptions.createDescription(importDecl, name, document)
    scopes.add(importDecl.$container, desc)
  }

  private async processClassMembers(clazz: ClassDeclaration, document: LangiumDocument, scopes: PrecomputedScopes, cancelToken: CancellationToken): Promise<void> {
    await interruptAndCheck(cancelToken)
    if (clazz.name) {
      const desc = this.descriptions.createDescription(clazz, clazz.name, document)
      scopes.add(clazz.$container, desc)
    }

    for (const member of clazz.members) {
      await interruptAndCheck(cancelToken)
      if (isCallableDeclaration(member)) {
        this.processCallable(member, document, scopes, cancelToken)
      }
    }
  }

  private async processCallable(callable: CallableDeclaration, document: LangiumDocument, scopes: PrecomputedScopes, cancelToken: CancellationToken): Promise<void> {
    await interruptAndCheck(cancelToken)
    if (!isConstructorDeclaration(callable) && callable.name) {
      const desc = this.descriptions.createDescription(callable, callable.name, document)
      scopes.add(callable.$container, desc)
    }

    const parameters = callable.parameters
    for (const param of parameters) {
      if (param.name) {
        const desc = this.descriptions.createDescription(param, param.name, document)
        scopes.add(callable, desc)
      }
    }

    this.processStatements(callable, callable.body, document, scopes, cancelToken)
  }

  private async processStatements(container: AstNode, stmts: Array<Statement>, document: LangiumDocument, scopes: PrecomputedScopes, cancelToken: CancellationToken): Promise<void> {
    await interruptAndCheck(cancelToken)
    for (const stmt of stmts) {
      await interruptAndCheck(cancelToken)
      if (isBlockStatement(stmt)) {
        this.processStatements(stmt, stmt.body, document, scopes, cancelToken)
      }
      else if (isForStatement(stmt)) {
        for (const variables of stmt.variables) {
          if (variables.name) {
            const desc = this.descriptions.createDescription(variables, variables.name, document)
            scopes.add(stmt, desc)
          }
        }

        this.processStatements(stmt, stmt.body, document, scopes, cancelToken)
      }
      else if (isVariableDeclaration(stmt) && stmt.name) {
        const desc = this.descriptions.createDescription(stmt, stmt.name, document)
        scopes.add(container, desc)
      }
    }
  }
  // #endregion computeLocalScopes
}

function getPackageName(document: LangiumDocument): string {
  const pathStr = document.uri.path

  // iterate over parent dir to find 'scripts' dir and return the relative path
  const path = pathStr.split('/')
  const found = path.findIndex(e => e === 'scripts')
  let packageName = 'scripts'
  if (found !== -1) {
    const fileName = path[path.length - 1]
    const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'))

    const directory = path.slice(found + 1, path.length - 1)
    if (directory.length === 0) {
      packageName = `scripts.${fileNameWithoutExt}`
    }
    else {
      packageName = `scripts.${directory.join('.')}.${fileNameWithoutExt}`
    }
  }

  return packageName
}
