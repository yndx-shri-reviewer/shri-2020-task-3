declare module 'bem-xjst' {

    export interface BemhtmlTemplate {
        apply: (bemjson: any) => string;
    }

    export interface BemhtmlTemplater {
        compile: () => BemhtmlTemplate;
    }

    export const bemhtml: BemhtmlTemplater;
}