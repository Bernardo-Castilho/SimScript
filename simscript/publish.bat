copy ..\readme.md
copy simscript.css dist
call tsc
call typedoc index.ts

echo update the version in package.json, then 'npm publish'
echo npm run build
echo update the links in dist => should be './xxx', not '/xxx'
