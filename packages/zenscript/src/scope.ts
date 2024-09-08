import type { AstNode, AstNodeDescription, LangiumDocument, NameProvider, PrecomputedScopes } from 'langium'
import { AstUtils, DefaultScopeComputation, interruptAndCheck } from 'langium'
import type { CancellationToken } from 'vscode-languageserver'
import type { CallableDeclaration, ClassDeclaration, ImportDeclaration, Statement } from './generated/ast'
import { isBlockStatement, isCallableDeclaration, isClassDeclaration, isConstructorDeclaration, isForStatement, isFunctionDeclaration, isVariableDeclaration } from './generated/ast'
import type { IntelliZenServices } from './module'
import type { QualifiedNameProvider } from './name'
import { isToplevel } from './utils/ast'

export class ZenScriptScopeComputation extends DefaultScopeComputation {
  override readonly nameProvider: NameProvider & QualifiedNameProvider

  constructor(services: IntelliZenServices) {
    super(services)
    this.nameProvider = services.references.NameProvider
  }

  protected override exportNode(node: AstNode, exports: AstNodeDescription[], document: LangiumDocument): void {
    // non-toplevel nodes cannot be referenced from other documents
    if (!isToplevel(node)) {
      return
    }

    // script from an unknown package export nothing
    if (!this.nameProvider.getQualifiedName(AstUtils.findRootNode(node))) {
      return
    }

    if (isVariableDeclaration(node)) {
      switch (node.prefix) {
        case 'global':
        case 'static':
          super.exportNode(node, exports, document)
      }
    }
    else if (isFunctionDeclaration(node)) {
      switch (node.prefix) {
        case 'global':
        case 'static':
          super.exportNode(node, exports, document)
      }
    }
    else if (isClassDeclaration(node)) {
      super.exportNode(node, exports, document)
    }
  }

  protected override processNode(node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes): void {
    super.processNode(node, document, scopes)
  }

  // async computeExports(document: LangiumDocument, cancelToken: CancellationToken = CancellationToken.None): Promise<AstNodeDescription[]> {
  //   const exports: AstNodeDescription[] = []
  //
  //   const root = document.parseResult?.value
  //   if (!isScript(root)) {
  //     return exports
  //   }
  //
  //   for (const clazz of root.classes) {
  //     await interruptAndCheck(cancelToken)
  //     await this.exportClass(clazz, document, exports)
  //   }
  //
  //   for (const functionDeclaration of root.functions) {
  //     await interruptAndCheck(cancelToken)
  //     await this.exportFunction(functionDeclaration, document, exports)
  //   }
  //
  //   for (const stmt of root.statements) {
  //     await interruptAndCheck(cancelToken)
  //     if (!isVariableDeclaration(stmt)) {
  //       continue
  //     }
  //     await this.exportVariable(stmt, document, exports)
  //   }
  //
  //   return exports
  // }

  // async computeLocalScopes(document: LangiumDocument, cancelToken: CancellationToken = CancellationToken.None): Promise<PrecomputedScopes> {
  //   const root = document.parseResult?.value
  //   // This map stores a list of descriptions for each node in our document
  //   const scopes = new MultiMap<AstNode, AstNodeDescription>()
  //   if (!isScript(root)) {
  //     return scopes
  //   }
  //
  //   for (const importDecl of root.imports) {
  //     await this.processImport(importDecl, document, scopes, cancelToken)
  //   }
  //
  //   for (const clazz of root.classes) {
  //     await this.processClassMembers(clazz, document, scopes, cancelToken)
  //   }
  //
  //   for (const functionDeclaration of root.functions) {
  //     await this.processCallable(functionDeclaration, document, scopes, cancelToken)
  //   }
  //
  //   this.processStatements(root, root.statements, document, scopes, cancelToken)
  //
  //   return scopes
  // }

  // #region computeExports
  // private async exportClass(classDecl: ClassDeclaration, document: LangiumDocument, exports: AstNodeDescription[]): Promise<void> {
  //   const qualifiedName = this.nameProvider.getQualifiedName(classDecl)
  //   const desc = this.descriptions.createDescription(classDecl, qualifiedName, document)
  //   exports.push(desc)
  // }

  // private async exportFunction(funcDecl: FunctionDeclaration, document: LangiumDocument, exports: AstNodeDescription[]): Promise<void> {
  //   switch (funcDecl.prefix) {
  //     case 'global': {
  //       const name = this.nameProvider.getName(funcDecl)
  //       const desc = this.descriptions.createDescription(funcDecl, name, document)
  //       exports.push(desc)
  //       break
  //     }
  //     case 'static': {
  //       const qualifiedName = this.nameProvider.getQualifiedName(funcDecl)
  //       const desc = this.descriptions.createDescription(funcDecl, qualifiedName, document)
  //       exports.push(desc)
  //       break
  //     }
  //   }
  // }

  // private async exportVariable(varDecl: VariableDeclaration, document: LangiumDocument, exports: AstNodeDescription[]): Promise<void> {
  //   switch (varDecl.prefix) {
  //     case 'global':
  //     case 'val':
  //     case 'var': {
  //       const name = this.nameProvider.getName(varDecl)
  //       const desc = this.descriptions.createDescription(varDecl, name, document)
  //       exports.push(desc)
  //       break
  //     }
  //
  //     case 'static': {
  //       const qualifiedName = this.nameProvider.getQualifiedName(varDecl)
  //       const desc = this.descriptions.createDescription(varDecl, qualifiedName, document)
  //       exports.push(desc)
  //       break
  //     }
  //   }
  // }
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
