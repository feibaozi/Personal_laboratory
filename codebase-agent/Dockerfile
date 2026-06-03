FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl build-essential pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

RUN npm install -g pnpm@9

WORKDIR /build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpm-approve-builds.yaml ./
COPY packages/engine/package.json packages/engine/
COPY packages/engine/Cargo.toml packages/engine/Cargo.lock packages/engine/build.rs packages/engine/
COPY packages/orchestrator/package.json packages/orchestrator/
COPY packages/shared-types/package.json packages/shared-types/

RUN pnpm install --frozen-lockfile --prod false

RUN mkdir -p packages/engine/src && \
    echo 'fn main() {}' > packages/engine/src/main.rs && \
    cd packages/engine && cargo fetch && \
    rm -rf src

COPY packages/engine/src packages/engine/src
COPY packages/orchestrator/tsconfig.json packages/orchestrator/
COPY packages/orchestrator/src packages/orchestrator/src
COPY packages/shared-types/src packages/shared-types/src

RUN cd packages/engine && npx napi build --platform --release

RUN pnpm --filter orchestrator build

FROM node:20-slim

RUN npm install -g pnpm@9

WORKDIR /app

COPY --from=builder /build/package.json /build/pnpm-lock.yaml /build/pnpm-workspace.yaml ./
COPY --from=builder /build/packages/orchestrator/package.json packages/orchestrator/
COPY --from=builder /build/packages/shared-types/package.json packages/shared-types/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /build/packages/orchestrator/dist packages/orchestrator/dist
COPY --from=builder /build/packages/shared-types/dist packages/shared-types/dist

RUN mkdir -p packages/engine
COPY --from=builder /build/packages/engine/codebase-engine.*.node packages/engine/
COPY --from=builder /build/packages/engine/index.js packages/engine/index.d.ts packages/engine/package.json packages/engine/

EXPOSE 3456

ENV PORT=3456
ENV HOST=0.0.0.0
ENV NODE_ENV=production

CMD ["node", "packages/orchestrator/dist/index.js"]