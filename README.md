# QLF Filter for developer

## How to add grammarly
## How to use as ag-grid module
## How to use as standalone filter
## Errors processing


# notes

- if you want to add new word that will be recognized into grammars, add lexeme as regexp that will match the tart of string as lexeme and place this part into the according grammar's code. Important to add group name to regexp.
- guards are the functions that prevents errors in grammar's code.
- processors are the functions that do something with found lexemes, including special lexeme `code` that allows to do something with grammar's code itself.