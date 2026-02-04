# Database Backup & Restore Manager

Script para realizar dumps e restaurações do banco de dados PostgreSQL do Opensheets.

## Localização

```
scripts/db-manager.sh
```

## Pré-requisitos

- PostgreSQL client tools instalados (`pg_dump`, `psql`)
- Arquivo `.env` configurado com `DATABASE_URL`
- Permissões de execução no script

## Uso

### 1. Fazer Backup (Dump)

Criar um backup automático com timestamp:

```bash
./scripts/db-manager.sh dump
# ou
pnpm db:dump
```

Criar um backup com nome personalizado:

```bash
./scripts/db-manager.sh dump meu-backup
# ou
pnpm db:dump meu-backup
```

**Saída:**

- Arquivo SQL: `backups/opensheets_YYYYMMDD_HHMMSS.sql`
- Arquivo comprimido: `backups/opensheets_YYYYMMDD_HHMMSS.sql.gz`

### 2. Restaurar Backup (Restore)

⚠️ **ATENÇÃO:** A restauração irá **APAGAR** todos os dados existentes!

```bash
./scripts/db-manager.sh restore opensheets_20260204_143022.sql
# ou
pnpm db:restore opensheets_20260204_143022.sql
```

O script aceita diferentes formatos de caminho:

```bash
# Nome do arquivo apenas (busca em backups/)
./scripts/db-manager.sh restore meu-backup.sql

# Arquivo comprimido
./scripts/db-manager.sh restore meu-backup.sql.gz

# Caminho completo
./scripts/db-manager.sh restore /path/to/backup.sql
```

### 3. Listar Backups

```bash
./scripts/db-manager.sh list
# ou
pnpm db:backup:list
```

## Comandos NPM

Para conveniência, use os scripts do `package.json`:

```bash
# Fazer backup
pnpm db:dump [nome-opcional]

# Restaurar backup
pnpm db:restore <arquivo>

# Listar backups
pnpm db:backup:list
```

## Estrutura de Arquivos

```
backups/
├── opensheets_20260204_143022.sql     # Backup SQL
├── opensheets_20260204_143022.sql.gz  # Backup comprimido
└── meu-backup.sql                     # Backup personalizado
```

## Características

✅ **Dump:**

- Formato SQL plain text (fácil de ler e editar)
- Inclui comandos `DROP` e `CREATE`
- Compressão automática com gzip
- Codificação UTF-8
- Timestamp automático nos nomes

✅ **Restore:**

- Confirmação obrigatória antes de restaurar
- Suporte para arquivos comprimidos (.gz)
- Validação de existência do arquivo
- Mensagens de erro claras

✅ **Segurança:**

- Usa variáveis de ambiente do `.env`
- Senha via `PGPASSWORD` (não aparece no histórico)
- Confirmação antes de operações destrutivas

## Variáveis de Ambiente

O script lê automaticamente do arquivo `.env`:

```bash
DATABASE_URL=postgresql://user:password@host:port/database
```

## Exemplos de Uso

### Backup antes de deploy

```bash
pnpm db:dump pre-deploy-$(date +%Y%m%d)
```

### Backup e limpar antigos (manter últimos 7 dias)

```bash
pnpm db:dump
find backups/ -name "*.sql" -mtime +7 -delete
```

### Restaurar backup específico

```bash
pnpm db:backup:list
pnpm db:restore opensheets_20260204_143022.sql
```

### Testar em ambiente local

```bash
# Fazer backup da produção
pnpm db:dump producao

# Mudar DATABASE_URL no .env para local
# Restaurar dados de produção localmente
pnpm db:restore producao.sql
```

## Troubleshooting

### Erro: "pg_dump: command not found"

Instale o PostgreSQL client:

```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Windows (WSL)
sudo apt-get install postgresql-client
```

### Erro: "password authentication failed"

Verifique se o `DATABASE_URL` no `.env` está correto.

### Erro: "database does not exist"

Durante restore, o script cria o database automaticamente.

### Permissão negada

```bash
chmod +x scripts/db-manager.sh
```

## Automação

### Backup automático diário (cron)

```bash
# Adicionar ao crontab
0 2 * * * cd /path/to/opensheets && ./scripts/db-manager.sh dump
```

### Limpeza automática (manter 30 dias)

```bash
# Adicionar ao crontab
0 3 * * * find /path/to/opensheets/backups -name "*.sql*" -mtime +30 -delete
```

## Notas

- Backups são salvos em `backups/` (criado automaticamente)
- Arquivos .gz são 5-10x menores que .sql
- Use `.sql` para inspeção/edição, `.gz` para armazenamento
- O script é seguro para uso em CI/CD pipelines
