# Creacion

ng new schema --create-application=false
cd schema
ng g library schema --standalone --prefix=sh
npm i elkjs
npm i d3-zoom

# Exportar

npm run build -> Aumenta version de "projects/schema/package.json"
cd dist/schema/
npm pack -> Genera esquema exportable "dist/schema/miguimono-schema-0.0.1.tgz"
