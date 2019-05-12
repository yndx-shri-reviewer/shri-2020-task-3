// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { join } from 'path';
// import { bemhtml } from 'bem-xjst';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient';

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

    // const template = bemhtml.compile();

    // console.log(template.apply({
    //     block: 'main',
    //     content: [
    //         { elem: 'form', content: 'fields' },
    //         { elem: 'button', content: 'Save' },
    //     ]
    // }));

    // console.log(`server path: ${serverModulePath}`);

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.info('Congratulations, your extension is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand(
        'example.showPreviewToSide',
        () => {
            // The code you place here will be executed every time your command is executed

            // Display a message box to the user
            vscode.window.showInformationMessage('Hello SHRI!');
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {
    client.stop();
}
