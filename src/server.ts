import {
    createConnection,
    ProposedFeatures,
    TextDocuments,
    InitializeParams,
    TextDocument,
    Diagnostic,
    DiagnosticSeverity,
    DidChangeConfigurationParams
} from 'vscode-languageserver';

import {basename} from 'path';

import * as jsonToAst from 'json-to-ast';

import {makeLint, LinterProblem} from './linter';
import { ExampleConfiguration, Severity, RuleKeys } from './configuration';

let conn = createConnection(ProposedFeatures.all);
let docs = new TextDocuments();
let conf: ExampleConfiguration | undefined = undefined; 

conn.onInitialize((params: InitializeParams) => {
    return {
        capabilities: {
            textDocumentSync: docs.syncKind
        }
    };
});

conn.onDidChangeConfiguration(({ settings }: DidChangeConfigurationParams) => {
    conf = settings.example;
    validateAll();
});

function GetDiagnosticMessage(key: RuleKeys): string {
    switch (key) {
        case RuleKeys.UppercaseNamesIsForbidden:
            return 'Uppercase properties are forbidden!';
        case RuleKeys.BlockNameIsRequired:
            return 'Field named \'block\' is required!';
        default:
            return `Unknown problem type '${key}'`;
    }
}

function GetDiagnosticSeverity(key: RuleKeys): DiagnosticSeverity | undefined {
    if (!conf || !conf.severity) {
        return undefined;
    }

    const severity: Severity = conf.severity[key];

    switch (severity) {
        case Severity.Error:
            return DiagnosticSeverity.Error;
        case Severity.Warning:
            return DiagnosticSeverity.Warning;
        case Severity.Information:
            return DiagnosticSeverity.Information;
        case Severity.Hint:
            return DiagnosticSeverity.Hint;
        default:
            return undefined;
    }
}

async function validateAll() {
	for (const document of docs.all()) {
		await validateTextDocument(document);
	}
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const source = basename(textDocument.uri);
    const json = textDocument.getText();

    const validateProperty = (property: jsonToAst.AstProperty): LinterProblem<RuleKeys>[] =>
        /^[A-Z]+$/.test(property.key.value) 
            ? [{ key: RuleKeys.UppercaseNamesIsForbidden, loc: property.key.loc }] 
            : [];

    const validateObject = (obj: jsonToAst.AstObject): LinterProblem<RuleKeys>[] =>
        obj.children.some(p => p.key.value === 'block') ? [] : [{ key: RuleKeys.BlockNameIsRequired, loc: obj.loc }] ;
        
    const diagnostics: Diagnostic[] = makeLint(json, validateProperty, validateObject)
        .reduce((list: Diagnostic[], problem: LinterProblem<RuleKeys>): Diagnostic[] => {
            const severity = GetDiagnosticSeverity(problem.key);

            if (severity) {
                const message = GetDiagnosticMessage(problem.key);

                let diagnostic: Diagnostic = {
                    range: {
                        start: textDocument.positionAt(problem.loc.start.offset),
                        end: textDocument.positionAt(problem.loc.end.offset)
                    },
                    severity,
                    message,
                    source
                };

                list.push(diagnostic);
            }

            return list;
        }, []);

    // ERROR:
    // if (diagnostics.length) {
    //     conn.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    // }
    conn.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

docs.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

docs.listen(conn);
conn.listen();
