SELECT 'CREATE DATABASE identity'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'identity')\gexec
SELECT 'CREATE DATABASE transport'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'transport')\gexec
SELECT 'CREATE DATABASE booking'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'booking')\gexec
SELECT 'CREATE DATABASE payment'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'payment')\gexec
SELECT 'CREATE DATABASE notification'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'notification')\gexec
SELECT 'CREATE DATABASE reporting'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'reporting')\gexec
