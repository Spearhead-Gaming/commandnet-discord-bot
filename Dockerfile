FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
USER node
EXPOSE 4100
# /ready needs the shared secret and returns 200 only once the Discord gateway is connected.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.BOT_PORT||4100)+'/ready',{headers:{authorization:'Bearer '+process.env.BOT_SHARED_SECRET}}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "src/index.js"]
