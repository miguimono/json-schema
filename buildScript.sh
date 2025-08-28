# Instala las dependencias del proyecto, ignorando problemas de compatibilidad de versiones (legacy peer dependencies)
# y forzando la instalación de todos los paquetes.
npm install --legacy-peer-deps --force

# Ejecuta la corrección automática de vulnerabilidades en los paquetes instalados, incluso si esto significa aplicar cambios disruptivos.
npm audit fix --force

# Compila el proyecto Angular, generando los archivos estáticos en la carpeta 'dist'.
npm run build

# Copia el archivo 'deploy.json' desde la carpeta 'despliegue' a la carpeta 'dist' para incluir configuraciones específicas de despliegue.
cp despliegue/deploy.json dist

# Copia el archivo de configuración 'nginx.conf' a la carpeta 'dist' para que NGINX pueda usarlo durante el despliegue.
cp nginx.conf dist

# Crea la carpeta 'deploy' dentro de 'dist', si no existe, para organizar los archivos de despliegue.
mkdir -p dist/deploy

# Copia el 'Dockerfile' desde la carpeta 'despliegue' a 'dist/deploy' para que Docker pueda construir la imagen desde ahí.
cp despliegue/Dockerfile/Dockerfile dist/deploy

# Copia el archivo de configuración de despliegue 'deployment-prod.yml' a la carpeta 'dist/deploy'
# para que pueda ser utilizado durante el despliegue en entornos de prueba.
cp despliegue/desarrollo/deployment.yml dist/deploy

# Crea la carpeta 'ingresstransversal' dentro de 'dist/deploy', si no existe, para almacenar configuraciones específicas de ingress.
mkdir -p dist/deploy/ingresstransversal

# Copia el archivo 'prod-ingress-service-transversal.yml' a la carpeta 'dist/deploy/ingresstransversal'
# para incluir las configuraciones de Ingress necesarias durante el despliegue.
cp despliegue/desarrollo/prod-ingress-service-transversal.yml dist/deploy/ingresstransversal
