import * as path from 'path';
import * as fs from 'fs';
import * as nls from 'vscode-nls';
import { xhr, XHRResponse, getErrorStatusDescription } from 'request-light';

const localize = nls.loadMessageBundle();

import { workspace, window, languages, commands, ExtensionContext, extensions, Uri, LanguageConfiguration, Diagnostic, StatusBarAlignment, TextEditor, TextDocument, Position, SelectionRange } from 'vscode';
import { LanguageClient, LanguageClientOptions, RequestType, ServerOptions, TransportKind, NotificationType, DidChangeConfigurationNotification, HandleDiagnosticsSignature } from 'vscode-languageclient';

import { hash } from './hash';

namespace VSCodeContentRequest {
	export const type: RequestType<string, string, any, any> = new RequestType('vscode/content');
}

namespace SchemaContentChangeNotification {
	export const type: NotificationType<string, any> = new NotificationType('json/schemaContent');
}

namespace ForceValidateRequest {
	export const type: RequestType<string, Diagnostic[], any, any> = new RequestType('json/validate');
}

export interface ISchemaAssociations {
	[pattern: string]: string[];
}

namespace SchemaAssociationNotification {
	export const type: NotificationType<ISchemaAssociations, any> = new NotificationType('json/schemaAssociations');
}

interface IPackageInfo {
	name: string;
	version: string;
	aiKey: string;
}

interface Settings {
	json?: {
		schemas?: JSONSchemaSettings[];
		format?: { enable: boolean; };
	};
	http?: {
		proxy?: string;
		proxyStrictSSL?: boolean;
	};
}

interface JSONSchemaSettings {
	fileMatch?: string[];
	url?: string;
	schema?: any;
}


export function activate(context: ExtensionContext) {

	let toDispose = context.subscriptions;

	let serverMain = readJSONFile(context.asAbsolutePath('./server/package.json')).main;
	let serverModule = context.asAbsolutePath(path.join('server', serverMain));

	let debugOptions = { execArgv: ['--nolazy', '--inspect=' + (9000 + Math.round(Math.random() * 10000))] };

	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	};

	let documentSelector = ['json', 'jsonc'];

	let schemaResolutionErrorStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 0);
	schemaResolutionErrorStatusBarItem.command = '_json.retryResolveSchema';
	schemaResolutionErrorStatusBarItem.tooltip = localize('json.schemaResolutionErrorMessage', 'Unable to resolve schema.') + ' ' + localize('json.clickToRetry', 'Click to retry.');
	schemaResolutionErrorStatusBarItem.text = '$(alert)';
	toDispose.push(schemaResolutionErrorStatusBarItem);

	let fileSchemaErrors = new Map<string, string>();

	let clientOptions: LanguageClientOptions = {
		documentSelector,
		initializationOptions: {
			handledSchemaProtocols: ['file'] 
		},
		synchronize: {
			configurationSection: ['json', 'http'],
			fileEvents: workspace.createFileSystemWatcher('**/*.json')
		},
		middleware: {
			workspace: {
				didChangeConfiguration: () => client.sendNotification(DidChangeConfigurationNotification.type, { settings: getSettings() })
			},
			handleDiagnostics: (uri: Uri, diagnostics: Diagnostic[], next: HandleDiagnosticsSignature) => {
				const schemaErrorIndex = diagnostics.findIndex(candidate => candidate.code === /* SchemaResolveError */ 0x300);

				if (schemaErrorIndex === -1) {
					fileSchemaErrors.delete(uri.toString());
					return next(uri, diagnostics);
				}

				const schemaResolveDiagnostic = diagnostics[schemaErrorIndex];
				fileSchemaErrors.set(uri.toString(), schemaResolveDiagnostic.message);

				if (window.activeTextEditor && window.activeTextEditor.document.uri.toString() === uri.toString()) {
					schemaResolutionErrorStatusBarItem.show();
				}

				next(uri, diagnostics);
			}
		}
	};

	let client = new LanguageClient('json', localize('jsonserver.name', 'JSON Language Server'), serverOptions, clientOptions);
	client.registerProposedFeatures();

	let disposable = client.start();
	toDispose.push(disposable);
	client.onReady().then(() => {
		client.onRequest(VSCodeContentRequest.type, (uriPath: string) => {
			let uri = Uri.parse(uriPath);
			if (uri.scheme !== 'http' && uri.scheme !== 'https') {
				return workspace.openTextDocument(uri).then(doc => {
					return doc.getText();
				}, error => {
					return Promise.reject(error);
				});
			} else {
				const headers = { 'Accept-Encoding': 'gzip, deflate' };
				return xhr({ url: uriPath, followRedirects: 5, headers }).then((response: XHRResponse) => {
					return response.responseText;
				}, (error: XHRResponse) => {
					return Promise.reject(error.responseText || getErrorStatusDescription(error.status) || error.toString());
				});
			}
		});

		let handleContentChange = (uri: Uri) => {
			if (uri.scheme === 'vscode' && uri.authority === 'schemas') {
				client.sendNotification(SchemaContentChangeNotification.type, uri.toString());
			}
		};

		let handleActiveEditorChange = (activeEditor?: TextEditor) => {
			if (!activeEditor) {
				return;
			}

			const activeDocUri = activeEditor.document.uri.toString();

			if (activeDocUri && fileSchemaErrors.has(activeDocUri)) {
				schemaResolutionErrorStatusBarItem.show();
			} else {
				schemaResolutionErrorStatusBarItem.hide();
			}
		};

		toDispose.push(workspace.onDidChangeTextDocument(e => handleContentChange(e.document.uri)));
		toDispose.push(workspace.onDidCloseTextDocument(d => {
			handleContentChange(d.uri);
			fileSchemaErrors.delete(d.uri.toString());
		}));
		toDispose.push(window.onDidChangeActiveTextEditor(handleActiveEditorChange));

		let handleRetryResolveSchemaCommand = () => {
			if (window.activeTextEditor) {
				schemaResolutionErrorStatusBarItem.text = '$(watch)';
				const activeDocUri = window.activeTextEditor.document.uri.toString();
				client.sendRequest(ForceValidateRequest.type, activeDocUri).then((diagnostics) => {
					const schemaErrorIndex = diagnostics.findIndex(candidate => candidate.code === /* SchemaResolveError */ 0x300);
					if (schemaErrorIndex !== -1) {
						const schemaResolveDiagnostic = diagnostics[schemaErrorIndex];
						fileSchemaErrors.set(activeDocUri, schemaResolveDiagnostic.message);
					} else {
						schemaResolutionErrorStatusBarItem.hide();
					}
					schemaResolutionErrorStatusBarItem.text = '$(alert)';
				});
			}
		};

		toDispose.push(commands.registerCommand('_json.retryResolveSchema', handleRetryResolveSchemaCommand));

		client.sendNotification(SchemaAssociationNotification.type, getSchemaAssociation(context));

		extensions.onDidChange(_ => {
			client.sendNotification(SchemaAssociationNotification.type, getSchemaAssociation(context));
		});

		documentSelector.forEach(selector => {
			toDispose.push(languages.registerSelectionRangeProvider(selector, {
				async provideSelectionRanges(document: TextDocument, positions: Position[]): Promise<SelectionRange[]> {
					const textDocument = client.code2ProtocolConverter.asTextDocumentIdentifier(document);
					const rawResult = await client.sendRequest<SelectionRange[][]>('$/textDocument/selectionRanges', { textDocument, positions: positions.map(client.code2ProtocolConverter.asPosition) });
					if (Array.isArray(rawResult)) {
						return rawResult.map(rawSelectionRanges => {
							return rawSelectionRanges.reduceRight((parent: SelectionRange | undefined, selectionRange: SelectionRange) => {
								return {
									range: client.protocol2CodeConverter.asRange(selectionRange.range),
									parent,
								};
							}, undefined)!;
						});
					}
					return [];
				}
			}));
		});
	});



	let languageConfiguration: LanguageConfiguration = {
		wordPattern: /("(?:[^\\\"]*(?:\\.)?)*"?)|[^\s{}\[\],:]+/,
		indentationRules: {
			increaseIndentPattern: /^.*(\{[^}]*|\[[^\]]*)$/,
			decreaseIndentPattern: /^\s*[}\]],?\s*$/
		}
	};
	languages.setLanguageConfiguration('json', languageConfiguration);
	languages.setLanguageConfiguration('jsonc', languageConfiguration);
}

function getSchemaAssociation(_context: ExtensionContext): ISchemaAssociations {
	let associations: ISchemaAssociations = {};
	extensions.all.forEach(extension => {
		let packageJSON = extension.packageJSON;
		if (packageJSON && packageJSON.contributes && packageJSON.contributes.jsonValidation) {
			let jsonValidation = packageJSON.contributes.jsonValidation;
			if (Array.isArray(jsonValidation)) {
				jsonValidation.forEach(jv => {
					let { fileMatch, url } = jv;
					if (fileMatch && url) {
						if (url[0] === '.' && url[1] === '/') {
							url = Uri.file(path.join(extension.extensionPath, url)).toString();
						}
						if (fileMatch[0] === '%') {
							fileMatch = fileMatch.replace(/%APP_SETTINGS_HOME%/, '/User');
							fileMatch = fileMatch.replace(/%MACHINE_SETTINGS_HOME%/, '/Machine');
							fileMatch = fileMatch.replace(/%APP_WORKSPACES_HOME%/, '/Workspaces');
						} else if (fileMatch.charAt(0) !== '/' && !fileMatch.match(/\w+:\/\//)) {
							fileMatch = '/' + fileMatch;
						}
						let association = associations[fileMatch];
						if (!association) {
							association = [];
							associations[fileMatch] = association;
						}
						association.push(url);
					}
				});
			}
		}
	});
	return associations;
}

function getSettings(): Settings {
	let httpSettings = workspace.getConfiguration('http');

	let settings: Settings = {
		http: {
			proxy: httpSettings.get('proxy'),
			proxyStrictSSL: httpSettings.get('proxyStrictSSL')
		},
		json: {
			format: workspace.getConfiguration('json').get('format'),
			schemas: [],
		}
	};
	let schemaSettingsById: { [schemaId: string]: JSONSchemaSettings } = Object.create(null);
	let collectSchemaSettings = (schemaSettings: JSONSchemaSettings[], rootPath?: string, fileMatchPrefix?: string) => {
		for (let setting of schemaSettings) {
			let url = getSchemaId(setting, rootPath);
			if (!url) {
				continue;
			}
			let schemaSetting = schemaSettingsById[url];
			if (!schemaSetting) {
				schemaSetting = schemaSettingsById[url] = { url, fileMatch: [] };
				settings.json!.schemas!.push(schemaSetting);
			}
			let fileMatches = setting.fileMatch;
			let resultingFileMatches = schemaSetting.fileMatch!;
			if (Array.isArray(fileMatches)) {
				if (fileMatchPrefix) {
					for (let fileMatch of fileMatches) {
						if (fileMatch[0] === '/') {
							resultingFileMatches.push(fileMatchPrefix + fileMatch);
							resultingFileMatches.push(fileMatchPrefix + '/*' + fileMatch);
						} else {
							resultingFileMatches.push(fileMatchPrefix + '/' + fileMatch);
							resultingFileMatches.push(fileMatchPrefix + '/*/' + fileMatch);
						}
					}
				} else {
					resultingFileMatches.push(...fileMatches);
				}

			}
			if (setting.schema) {
				schemaSetting.schema = setting.schema;
			}
		}
	};

	let globalSettings = workspace.getConfiguration('json', null).get<JSONSchemaSettings[]>('schemas');
	if (Array.isArray(globalSettings)) {
		collectSchemaSettings(globalSettings, workspace.rootPath);
	}
	let folders = workspace.workspaceFolders;
	if (folders) {
		for (let folder of folders) {
			let folderUri = folder.uri;

			let schemaConfigInfo = workspace.getConfiguration('json', folderUri).inspect<JSONSchemaSettings[]>('schemas');

			let folderSchemas = schemaConfigInfo!.workspaceFolderValue;
			if (Array.isArray(folderSchemas)) {
				let folderPath = folderUri.toString();
				if (folderPath[folderPath.length - 1] === '/') {
					folderPath = folderPath.substr(0, folderPath.length - 1);
				}
				collectSchemaSettings(folderSchemas, folderUri.fsPath, folderPath);
			}
		}
	}
	return settings;
}

export function getSchemaId(schema: JSONSchemaSettings, rootPath?: string) {
	let url = schema.url;
	if (!url) {
		if (schema.schema) {
			url = schema.schema.id || `vscode://schemas/custom/${encodeURIComponent(hash(schema.schema).toString(16))}`;
		}
	} else if (rootPath && (url[0] === '.' || url[0] === '/')) {
		url = Uri.file(path.normalize(path.join(rootPath, url))).toString();
	}
	return url;
}

function readJSONFile(location: string) {
	try {
		return JSON.parse(fs.readFileSync(location).toString());
	} catch (e) {
		console.log(`Problems reading ${location}: ${e}`);
		return {};
	}

}