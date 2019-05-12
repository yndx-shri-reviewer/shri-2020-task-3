import { readFileSync } from 'fs';
import { join, resolve, basename } from 'path';
import { bemhtml } from 'bem-xjst';

import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient';

const previewPath: string = resolve(__dirname, '../preview/index.html');
const previewHtml: string = readFileSync(previewPath).toString();
const template = bemhtml.compile();

let client: LanguageClient;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const serverModulePath = context.asAbsolutePath(join('out', 'server.js'));

    const serverOptions: ServerOptions = {
        run: {
            module: serverModulePath,
            transport: TransportKind.ipc
        },
        debug: {
            module: serverModulePath,
            transport: TransportKind.ipc,
            options: { execArgv: ['--nolazy', '--inspect=6009'] }
        }
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for json documents
        documentSelector: [
            {
                scheme: 'file',
                language: 'json'
            }
        ]
    };

    client = new LanguageClient(
        'languageServerExample',
        'Language Server Example',
        serverOptions,
        clientOptions
    );

    client.start();

    /////////////////////////////////////////////////////////////////

    console.info('Congratulations, your extension is now active!');

    let disposable = vscode.commands.registerCommand(
        'example.showPreviewToSide',
        () => {
            const editor = vscode.window.activeTextEditor;

            if (editor !== undefined) {
                const document: vscode.TextDocument = editor.document;
                const fileName = basename(editor.document.fileName);

                const panel = vscode.window.createWebviewPanel(
                    'example.preview',
                    `Preview: ${fileName}`,
                    vscode.ViewColumn.Beside,
                    {
                        enableScripts: true
                    }
                );

                panel.webview.html = previewHtml;

                function updateContent(
                    panel: vscode.WebviewPanel,
                    document: vscode.TextDocument
                ) {
                    if (panel.active) {
                        const json = document.getText();
                        const data = JSON.parse(json);
                        const html = template.apply(data);
                        panel.webview.postMessage(
                            html + `<div>${document.uri}</div>`
                        );
                    }
                }

                panel.onDidChangeViewState(e =>
                    updateContent(e.webviewPanel, document)
                );
            }
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {
    client.stop();
}
