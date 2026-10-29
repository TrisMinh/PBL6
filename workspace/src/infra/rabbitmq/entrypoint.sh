#!/bin/sh
set -eu

case "${RABBITMQ_DEFAULT_PASS:-}" in
  ''|*[!A-Za-z0-9._~-]*)
    echo "RABBITMQ_DEFAULT_PASS must use URL-safe characters: A-Z a-z 0-9 . _ ~ -" >&2
    exit 1
    ;;
esac

sed "s|__RABBITMQ_PASSWORD__|${RABBITMQ_DEFAULT_PASS}|g" \
  /etc/rabbitmq/definitions.template.json > /tmp/definitions.json
sed 's|/etc/rabbitmq/definitions.json|/tmp/definitions.json|g' \
  /etc/rabbitmq/rabbitmq.conf > /tmp/rabbitmq.conf
export RABBITMQ_CONFIG_FILE=/tmp/rabbitmq

exec /usr/local/bin/docker-entrypoint.sh rabbitmq-server
