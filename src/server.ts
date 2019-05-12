import {
    createConnection,
    ProposedFeatures,
    TextDocuments,
    InitializeParams,
    TextDocument,
    Diagnostic,
    DiagnosticSeverity
} from 'vscode-languageserver';

import * as parse from 'json-to-ast';

let conn = createConnection(ProposedFeatures.all);
let docs = new TextDocuments();

conn.onInitialize((params: InitializeParams) => {
    return {
        capabilities: {
            textDocumentSync: docs.syncKind
        }
    };
});

function getChildren(entity: parse.AstJsonEntity): parse.AstJsonEntity[] {
    switch (entity.type) {
        case 'Array':
            return entity.children;
        case 'Object':
            return entity.children.map(c => c.value);
        default:
            return [];
    }
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    let text = textDocument.getText();

    try {
        const ast = parse(text);
        const children = getChildren(ast);

        const diagnostics: Diagnostic[] = children.map(entity => {
            let diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: textDocument.positionAt(entity.loc.start.offset),
                    end: textDocument.positionAt(entity.loc.end.offset)
                },
                message: `test message`,
                source: 'ex'
            };

            return diagnostic;
        });

        conn.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    } catch (ex) {
        // do nothing
    }
}

docs.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

docs.listen(conn);
conn.listen();
