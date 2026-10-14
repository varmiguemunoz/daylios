# ADR-06: contenedor de Node en el oeste de EE. UU., junto a Supabase us-west-1.
# Se construye desde la raíz del repositorio porque usa los contratos de src/shared.
FROM node:22-slim AS build
WORKDIR /repo
COPY services/cloud/package.json services/cloud/package-lock.json* services/cloud/
RUN cd services/cloud && npm install
COPY src/shared src/shared
COPY services/cloud services/cloud
RUN cd services/cloud && npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/services/cloud/node_modules node_modules
COPY --from=build /repo/services/cloud/dist dist
USER node
EXPOSE 8787
CMD ["node", "dist/services/cloud/src/main.js"]
