import { AstNode, AstNodeDescription, Cancellation, DefaultScopeComputation, interruptAndCheck, LangiumDocument, MultiMap, PrecomputedScopes } from "langium";
import { CancellationToken } from "vscode-languageserver";
import { CallableDeclaration, ClassDeclaration, ImportDeclaration, isBlockStatement, isCallableDeclaration, isConstructorDeclaration, isForStatement, isFunctionDeclaration, isScript, isVariableDeclaration, Statement } from "./generated/ast";

export class ZenScriptScopeComputation extends DefaultScopeComputation {
    // #region global declarations

    override async computeExports(document: LangiumDocument, cancelToken: CancellationToken = Cancellation.CancellationToken.None): Promise<AstNodeDescription[]> {
        const exports: AstNodeDescription[] = [];

        const root = document.parseResult?.value;
        if (!isScript(root)) {
            return exports;
        }

        const packageName = this.getPackageName(document);

        for (const clazz of root.classes) {
            await interruptAndCheck(cancelToken);
            if (!clazz.name)
                continue;

            const qualifiedName = packageName + '.' + clazz.name;
            const desc = this.descriptions.createDescription(clazz, qualifiedName, document);
            exports.push(desc);

        };

        for (const functionDeclaration of root.functions) {
            await interruptAndCheck(cancelToken);
            if (!functionDeclaration.name)
                continue;
            if (functionDeclaration.prefix === 'global') {
                const desc = this.descriptions.createDescription(functionDeclaration, functionDeclaration.name, document);
                exports.push(desc);
            } else if (functionDeclaration.prefix === 'static') {
                const qualifiedName = packageName + '.' + functionDeclaration.name;
                const desc = this.descriptions.createDescription(functionDeclaration, qualifiedName, document);
                exports.push(desc);
            }
        }

        for (const stmt of root.statements) {
            await interruptAndCheck(cancelToken);
            if (!isVariableDeclaration(stmt) || !stmt.name) {
                continue;
            }
            if (stmt.prefix === 'global') {
                const desc = this.descriptions.createDescription(stmt, stmt.name, document);
                exports.push(desc);
            }
            else if (stmt.prefix === 'static') {
                const qualifiedName = packageName + '.' + stmt.name;
                const desc = this.descriptions.createDescription(stmt, qualifiedName, document);
                exports.push(desc);
            }
        }

        return exports;
    }

    getPackageName(document: LangiumDocument): string {
        const pathStr = document.uri.path;

        // iterate over parent dir to find 'scripts' dir and return the relative path
        const path = pathStr.split('/');
        const found = path.findIndex(e => e === 'scripts');
        let packageName = 'scripts';
        if (found !== -1) {


            const fileName = path[path.length - 1];
            const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));

            const directory = path.slice(found + 1, path.length - 1);
            if (directory.length === 0) {
                packageName = 'scripts.' + fileNameWithoutExt;
            } else {
                packageName = 'scripts.' + directory.join('.') + '.' + fileNameWithoutExt;
            }
        }

        return packageName;

    }

    // #endregion

    // #region local declarations
    override async computeLocalScopes(document: LangiumDocument): Promise<PrecomputedScopes> {
        const root = document.parseResult?.value;
        // This map stores a list of descriptions for each node in our document
        const scopes = new MultiMap<AstNode, AstNodeDescription>();
        if (!isScript(root)) {
            return scopes;
        }

        for (const importDecl of root.imports) {
            await this.processImport(importDecl, document, scopes);
        }

        for (const clazz of root.classes) {
            await this.processClassMembers(clazz, document, scopes);
        }

        for (const functionDeclaration of root.functions) {
            await this.processCallable(functionDeclaration, document, scopes);
        }

        this.processStatements(root, root.statements, document, scopes);


        return scopes;
    }

    async processImport(importDecl: ImportDeclaration, document: LangiumDocument, scopes: PrecomputedScopes): Promise<void> {

        let name;

        if (importDecl.alias) {
            name = importDecl.alias;
        } else {
            const text = importDecl.ref.$refText;
            name = text.substring(text.lastIndexOf('.') + 1);
        }


        if (importDecl.ref.ref) {
            const desc = this.descriptions.createDescription(importDecl.ref.ref, name, document);
            scopes.add(importDecl.$container, desc);
        }
        else {
            const desc = this.descriptions.createDescription(importDecl, name, document);
            scopes.add(importDecl.$container, desc);
        }

    }

    async processClassMembers(clazz: ClassDeclaration, document: LangiumDocument, scopes: PrecomputedScopes): Promise<void> {
        if (clazz.name) {
            const desc = this.descriptions.createDescription(clazz, clazz.name, document);
            scopes.add(clazz.$container, desc);
        }

        for (const member of clazz.members) {

            if (isCallableDeclaration(member)) {
                this.processCallable(member, document, scopes);
            }
        }
    }

    async processCallable(callable: CallableDeclaration, document: LangiumDocument, scopes: PrecomputedScopes): Promise<void> {
        if (!isConstructorDeclaration(callable) && callable.name) {
            const desc = this.descriptions.createDescription(callable, callable.name, document);
            scopes.add(callable.$container, desc);
        }

        const parameters = callable.parameters;
        for (const param of parameters) {
            if (param.name) {
                const desc = this.descriptions.createDescription(param, param.name, document);
                scopes.add(callable, desc);
            }
        }

        this.processStatements(callable, callable.body, document, scopes);
    }

    async processStatements(container: AstNode, stmts: Array<Statement>, document: LangiumDocument, scopes: PrecomputedScopes): Promise<void> {

        for (const stmt of stmts) {
            if (isBlockStatement(stmt)) {
                this.processStatements(stmt, stmt.body, document, scopes);
            }
            else if (isForStatement(stmt)) {
                for (const variables of stmt.variables) {
                    if (variables.name) {
                        const desc = this.descriptions.createDescription(variables, variables.name, document);
                        scopes.add(stmt, desc);
                    }
                }

                this.processStatements(stmt, stmt.body, document, scopes);
            }
            else if (isVariableDeclaration(stmt) && stmt.name) {
                const desc = this.descriptions.createDescription(stmt, stmt.name, document);
                scopes.add(container, desc);
            }

        }
    }



    // #endregion

}