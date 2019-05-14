import {
    createConnection,
    ProposedFeatures,
    TextDocuments,
    InitializeParams,
    TextDocument,
    Diagnostic,
    DiagnosticSeverity
} from 'vscode-languageserver';

import {basename} from 'path';

import * as jsonToAst from 'json-to-ast';

import {makeLint} from './linter';

let conn = createConnection(ProposedFeatures.all);
let docs = new TextDocuments();

conn.onInitialize((params: InitializeParams) => {
    return {
        capabilities: {
            textDocumentSync: docs.syncKind
        }
    };
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const source = basename(textDocument.uri);
    const json = textDocument.getText();

    const validateProperty = (property: jsonToAst.AstProperty) => !/^[A-Z]+$/.test(property.key.value);

    const diagnostics: Diagnostic[] = makeLint(json, validateProperty)
        .map((property: jsonToAst.AstProperty): Diagnostic => {
            let diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: textDocument.positionAt(property.key.loc.start.offset),
                    end: textDocument.positionAt(property.key.loc.end.offset)
                },
                message: `Uppercase properties are forbidden!`,
                source
            };

            return diagnostic;
        });

    if (diagnostics.length) {
        conn.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    }
}

docs.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

docs.listen(conn);
conn.listen();
