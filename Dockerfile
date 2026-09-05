FROM node:24-bookworm-slim
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates dumb-init && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/burrow-backdoor
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY src ./src
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 MCP_PATH=/mcp
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/dumb-init", "--", "node", "/opt/burrow-backdoor/src/server.mjs"]
