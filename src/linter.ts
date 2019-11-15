import * as jsonToAst from 'json-to-ast';

export type JsonAST = jsonToAst.AstJsonEntity | undefined;

export interface LinterProblem<TKey> {
    key: TKey;
    loc: jsonToAst.AstLocation;
}

export function makeLint<TProblemKey>(
    json: string, 
    validateProperty: (property: jsonToAst.AstProperty) => LinterProblem<TProblemKey>[],
    validateObject: (property: jsonToAst.AstObject) => LinterProblem<TProblemKey>[]
): LinterProblem<TProblemKey>[] {

    function walk(
        node: jsonToAst.AstJsonEntity, 
        cbProp: (property: jsonToAst.AstProperty) => void,
        cbObj: (property: jsonToAst.AstObject) => void
    ) {
        switch (node.type) {
            case 'Array':
                node.children.forEach((item: jsonToAst.AstJsonEntity) => {
                    walk(item, cbProp, cbObj);
                });
                break;
            case 'Object':
                cbObj(node);
    
                node.children.forEach((property: jsonToAst.AstProperty) => {
                    cbProp(property);
                    walk(property.value, cbProp, cbObj);
                });
                break;
        }
    }

    function parseJson(json: string):JsonAST  {
        // ERROR2: убрать try/catch
        try {
            return jsonToAst(json);
        } catch (err) {
            return undefined;
        }
    }

    const errors: LinterProblem<TProblemKey>[] = [];
    const ast: JsonAST = parseJson(json);

    if (ast) {
        walk(ast, 
            // ERROR2:  errors.concat(...validateProperty(property));
            (property: jsonToAst.AstProperty) => errors.push(...validateProperty(property)), 
            // ERROR2:  errors.concat(...validateObject(obj));
            (obj: jsonToAst.AstObject) => errors.push(...validateObject(obj)));
    }

    return errors;
}
