import * as jsonToAst from 'json-to-ast';

function parseJson(json: string):jsonToAst.AstJsonEntity | undefined  {
    try {
        return jsonToAst(json);
    } catch (err) {
        return undefined;
    }
}

function walk(node: jsonToAst.AstJsonEntity, cb: (property: jsonToAst.AstProperty) => void) {
    switch (node.type) {
        case 'Object':
            node.children.forEach((property: jsonToAst.AstProperty) => {
                cb(property);
                walk(property.value, cb);
            });
            break;
        case 'Array':
            node.children.forEach((item: jsonToAst.AstJsonEntity) => walk(item, cb));
            break;
    }
}

export function makeLint(
    json: string, 
    validateProperty: (property: jsonToAst.AstProperty) => boolean): jsonToAst.AstProperty[] {

    const errors: jsonToAst.AstProperty[] = [];
    const ast: jsonToAst.AstJsonEntity | undefined = parseJson(json);

    if (ast) {
        walk(ast, (property: jsonToAst.AstProperty) => {
            if (!validateProperty(property)) {
                errors.push(property);
            }
        });
    }

    return errors;
}
