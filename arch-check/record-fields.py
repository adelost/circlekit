# WHAT: Reads Python's real lists, mappings and unpacking for the record-field gate.
# WHY: Keeps strings in comments or unrelated statements from being treated as copies.
import ast
import json
import sys


def names(values):
    return [value.value if isinstance(value, ast.Constant) and isinstance(value.value, str)
            else value.id if isinstance(value, ast.Name)
            else value.attr if isinstance(value, ast.Attribute) else None for value in values]


def access(value):
    if isinstance(value, ast.Attribute) and isinstance(value.value, ast.Name):
        return value.value.id, value.attr
    if isinstance(value, ast.Subscript) and isinstance(value.value, ast.Name) and isinstance(value.slice, ast.Constant) and isinstance(value.slice.value, str):
        return value.value.id, value.slice.value
    return None


def nodes(file, text):
    tree = ast.parse(text, filename=file)
    parents = {child: node for node in ast.walk(tree) for child in ast.iter_child_nodes(node)}
    assignments = [part for part in ast.walk(tree) if isinstance(part, (ast.Assign, ast.AnnAssign))]
    imports = {alias.asname or alias.name: {'module': node.module, 'name': alias.name}
               for node in ast.walk(tree) if isinstance(node, ast.ImportFrom) and node.module for alias in node.names}

    def scope_of(node):
        while node in parents and not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Module)):
            node = parents[node]
        return node

    def resolve_path(expression, at, seen=frozenset(), root=False):
        if isinstance(expression, ast.Name):
            if expression.id in seen:
                return None
            scope = scope_of(at)
            choices = []
            for assignment in assignments:
                targets = assignment.targets if isinstance(assignment, ast.Assign) else [assignment.target]
                if assignment.lineno < at.lineno and scope_of(assignment) is scope and any(isinstance(target, ast.Name) and target.id == expression.id for target in targets):
                    choices.append(assignment)
            if not choices:
                return [] if root else None
            selected = max(choices, key=lambda item: item.lineno)
            return resolve_path(selected.value, selected, seen | {expression.id})
        if isinstance(expression, ast.Attribute):
            path = resolve_path(expression.value, at, seen, root=True)
            return None if path is None else [*path, expression.attr]
        if isinstance(expression, ast.Subscript):
            path = resolve_path(expression.value, at, seen, root=True)
            key = expression.slice.value if isinstance(expression.slice, ast.Constant) and isinstance(expression.slice.value, str) else 0
            return None if path is None else [*path, key]
        return None

    calls = []
    for part in ast.walk(tree):
        if isinstance(part, ast.Call) and isinstance(part.func, ast.Name) and part.func.id in imports:
            calls.extend({'root': arg.id, **imports[part.func.id], 'scope': scope_of(part), 'line': part.lineno}
                         for arg in part.args if isinstance(arg, ast.Name))

    def resolve_root(expression, at, seen=frozenset()):
        if isinstance(expression, (ast.Attribute, ast.Subscript)):
            return resolve_root(expression.value, at, seen)
        if isinstance(expression, ast.BoolOp):
            return resolve_root(expression.values[0], at, seen)
        if not isinstance(expression, ast.Name) or expression.id in seen:
            return None
        choices = []
        for assignment in assignments:
            targets = assignment.targets if isinstance(assignment, ast.Assign) else [assignment.target]
            if assignment.lineno < at.lineno and scope_of(assignment) is scope_of(at) and any(isinstance(target, ast.Name) and target.id == expression.id for target in targets):
                choices.append(assignment)
        if not choices:
            return expression.id
        selected = max(choices, key=lambda item: item.lineno)
        return resolve_root(selected.value, selected, seen | {expression.id})

    for node in ast.walk(tree):
        keys, direct, receiver, table, used_with, collection, intent = [], [], None, None, [], False, None
        if isinstance(node, ast.Dict):
            for key, value in zip(node.keys, node.values):
                if isinstance(key, ast.Constant) and isinstance(key.value, str):
                    keys.append(key.value)
                    found = access(value)
                    if found and found[1] == key.value:
                        direct.append({'owner': found[0], 'field': found[1]})
        elif isinstance(node, (ast.List, ast.Tuple, ast.Set)):
            keys = names(node.elts)
            direct = [{'owner': found[0], 'field': found[1]} for value in node.elts if (found := access(value))]
        elif isinstance(node, ast.Call):
            keys = [key.arg for key in node.keywords if key.arg]
        if len(keys) < 3:
            continue
        parent = parents.get(node)
        if isinstance(parent, ast.Call) and isinstance(parent.func, ast.Attribute) and parent.func.attr in ('append', 'insert') and isinstance(parent.func.value, ast.Name):
            receiver, collection = parent.func.value.id, True
        if isinstance(parent, ast.Dict):
            pairs = [(key.value, value) for key, value in zip(parent.keys, parent.values) if isinstance(key, ast.Constant) and isinstance(key.value, str)]
            target = next((value.value for key, value in pairs if key == 'path' and isinstance(value, ast.Constant) and isinstance(value.value, str)), None)
            if target and any(key == 'value' and value is node for key, value in pairs):
                intent = [0, target, 0]
        if isinstance(parent, (ast.Assign, ast.AnnAssign)):
            targets = parent.targets if isinstance(parent, ast.Assign) else [parent.target]
            table = next((target.id for target in targets if isinstance(target, ast.Name)), None)
            if table and isinstance(node, (ast.List, ast.Tuple, ast.Set)):
                scope = parent
                while scope in parents and not isinstance(scope, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Module)):
                    scope = parents[scope]
                for part in ast.walk(scope):
                    if isinstance(part, (ast.Call, ast.DictComp, ast.ListComp, ast.SetComp, ast.GeneratorExp)):
                        descendants = list(ast.walk(part))
                        if any(isinstance(item, ast.Name) and item.id == table for item in descendants):
                            used_with.extend(item.value.id for item in descendants if isinstance(item, ast.Subscript) and isinstance(item.value, ast.Name))
        owners = {part['owner'] for part in direct} | set(used_with)
        if receiver:
            owners.add(receiver)
        paths = {owner: {'parts': resolve_path(ast.Name(id=owner, ctx=ast.Load()), node), 'root': resolve_root(ast.Name(id=owner, ctx=ast.Load()), node)} for owner in owners}
        guards = [{key: value for key, value in call.items() if key not in ('scope', 'line')}
                  for call in calls if call['scope'] is scope_of(node) and call['line'] < node.lineno]
        yield {'file': file, 'line': node.lineno, 'keys': [key for key in keys if key], 'direct': direct, 'receiver': receiver, 'table': table, 'usedWith': used_with, 'paths': paths, 'guards': guards, 'language': 'py', 'collection': collection, 'intent': intent}


files = json.load(sys.stdin)
json.dump([item for file in files for item in nodes(file['file'], file['text'])], sys.stdout)
