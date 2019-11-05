import * as jsonToAst from 'json-to-ast';

function parseJson(json: string):jsonToAst.AstJsonEntity | undefined  {
    // ERROR2: убрать try/catch
    try {
        return jsonToAst(json);
    } catch (err) {
        return undefined;
    }
}

function walk(
    node: jsonToAst.AstJsonEntity, 
    cbProp: (property: jsonToAst.AstProperty) => void,
    cbObj: (property: jsonToAst.AstObject) => void
) {
    switch (node.type) {
        case 'Object':
            cbObj(node);

            node.children.forEach((property: jsonToAst.AstProperty) => {
                cbProp(property);
                walk(property.value, cbProp, cbObj);
            });
            break;
        case 'Array':
            node.children.forEach((item: jsonToAst.AstJsonEntity) => walk(item, cbProp, cbObj));
            break;
    }
}

export interface LinterProblem<TKey> {
    key: TKey;
    loc: jsonToAst.AstLocation;
}

export function makeLint<TProblemKey>(
    json: string, 
    validateProperty: (property: jsonToAst.AstProperty) => LinterProblem<TProblemKey>[],
    validateObject: (property: jsonToAst.AstObject) => LinterProblem<TProblemKey>[]
): LinterProblem<TProblemKey>[] {

    const errors: LinterProblem<TProblemKey>[] = [];
    const ast: jsonToAst.AstJsonEntity | undefined = parseJson(json);

    const cbProp = (property: jsonToAst.AstProperty) => {
        // ERROR2:  errors.concat(...validateProperty(property));
        errors.push(...validateProperty(property));
    };

    const cbObj = (obj: jsonToAst.AstObject) => {
        // ERROR2:  errors.concat(...validateObject(obj));
        errors.push(...validateObject(obj));
    };

    if (ast) {
        walk(ast, cbProp, cbObj);
    }

    return errors;
}
