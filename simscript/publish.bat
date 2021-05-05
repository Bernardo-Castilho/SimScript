copy ..\readme.md
copy simscript.css dist
call tsc
call typedoc index.ts

rem update the version in package.json, then 'npm publish'