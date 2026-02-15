FROM node:18-alpine

# Configuration du répertoire de travail
WORKDIR /app

# Copie des fichiers de configuration
COPY package*.json ./

# Installation des dépendances
RUN npm install

# Copie du code source
COPY . .

# Exposition du port
EXPOSE 3000

# Commande de développement
CMD ["npm", "run", "dev"]
