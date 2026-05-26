FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_URL se inyecta en build time como ARG
# En EasyPanel: dejalo en /api (el nginx del frontend lo proxea al backend)
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Instalar nginx clásico
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Copiar la config explícita de nginx
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
