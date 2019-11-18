import { readFileSync, readFile } from "fs";
import { join, resolve, basename } from "path";
import { bemhtml } from "bem-xjst";

import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    SettingMonitor,
    DocumentColorRequest
} from 'vscode-languageclient';

const serverBundleRelativePath = join('out', 'server.js');
const previewPath: string = resolve( __dirname, '../preview/index.html');
const previewHtml: string = readFileSync(previewPath).toString();
const template = bemhtml.compile()

let client: LanguageClient;
const PANELS: Record<string, vscode.WebviewPanel> = {};

const createLanguageClient = (context: vscode.ExtensionContext): LanguageClient => {
    const serverModulePath = context.asAbsolutePath(serverBundleRelativePath);

    const serverOptions: ServerOptions = {
        run: {
            module: serverModulePath,
            transport: TransportKind.ipc
        },
        debug: {
            module: serverModulePath,
            transport: TransportKind.ipc,
            options: { execArgv: ['--inspect=6009', '--nolazy'] }
        }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'json' }
        ],
        synchronize: { configurationSection: 'example' }
    };

    client = new LanguageClient('languageServerExample', 'Language Server Example', serverOptions, clientOptions);

    return client;
};

const getPreviewKey = (doc: vscode.TextDocument): string => doc.uri.path;

const getMediaPath = (context: vscode.ExtensionContext) => vscode.Uri
    .file(context.extensionPath)
    .with({ scheme: "resource"})
    .toString() + '/';

const initPreviewPanel = (document: vscode.TextDocument) => {
    const key = getPreviewKey(document);
    const fileName = basename(document.fileName);

    const panel = vscode.window.createWebviewPanel(
        'example.preview',
        `Preview: ${fileName}`,
        vscode.ViewColumn.Beside,
        {
            enableScripts: true
        }
    );

    PANELS[key] = panel;

    const e = panel.onDidDispose(() => 
    {
        delete PANELS[key];
        e.dispose()
    });

    return panel;
};

const updateContent = (doc: vscode.TextDocument, context: vscode.ExtensionContext) => {
    const panel = PANELS[doc.uri.path];

    if (panel) {
        try {
            const json = doc.getText();
            const data = JSON.parse(json);
            const html = template.apply(data);


            panel.webview.html = previewHtml 
                .replace(/{{\s+(\w+)\s+}}/g, (str, key) => {
                    switch (key) {
                        case 'content':
                            return html;
                        case 'mediaPath':
                            return getMediaPath(context);
                        default:
                            return str;
                    }
                });
        } catch(e) {}
    }
};

const openPreview = (context: vscode.ExtensionContext) => {
    const editor = vscode.window.activeTextEditor;

    if (editor !== undefined) {
        const document: vscode.TextDocument = editor.document;
        const key = getPreviewKey(document);

        const panel = PANELS[key];

        if (panel) panel.reveal();
        else {
            const panel = initPreviewPanel(document);
            updateContent(document, context);
            context.subscriptions.push(panel);
        }
    }
};

export function activate(context: vscode.ExtensionContext) {

    console.info('Congratulations, your extension is now active!');

    client = createLanguageClient(context);

    context.subscriptions.push(new SettingMonitor(client, 'example.enable').start());

    const eventChange: vscode.Disposable = vscode.workspace
        .onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => updateContent(e.document, context));

    const previewCommand = vscode.commands.registerCommand('example.showPreviewToSide', () => openPreview(context));

    context.subscriptions.push(previewCommand, eventChange);
}

export function deactivate() {
    client.stop();
}
