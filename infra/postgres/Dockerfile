# postgres:18-alpine (same as prod `db`) + pgvector compiled in, so the existing data directory, musl collation
# and text indexes stay exactly as they are. with_llvm=no skips JIT bitcode, so no clang/llvm toolchain is needed.
FROM postgres:18-alpine
ARG PGVECTOR_VERSION=v0.8.7
RUN apk add --no-cache --virtual .pgvector-build git build-base \
 && git clone --depth 1 --branch "${PGVECTOR_VERSION}" https://github.com/pgvector/pgvector /tmp/pgvector \
 && make -C /tmp/pgvector OPTFLAGS="" with_llvm=no \
 && make -C /tmp/pgvector install with_llvm=no \
 && rm -rf /tmp/pgvector \
 && apk del .pgvector-build

# Bootstraps the `notes` role + database (run once per start by the compose `db-init` service, idempotent).
COPY init-notes-db.sql /usr/local/share/my-hub/init-notes-db.sql
