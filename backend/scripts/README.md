# Backend Scripts

This directory contains utility scripts for managing the backend project.

## Available Scripts

### 🧹 Cleanup Scripts

#### `cleanup.js`
Removes generated files and temporary files to keep the repository clean.

**Usage:**
```bash
npm run clean              # Basic cleanup
npm run clean:deep         # Deep cleanup (includes node_modules)
npm run clean:all          # Clean all generated files
```

**Removes:**
- Coverage reports (`coverage/`)
- Allure test results (`allure-results/`, `allure-report/`)
- Temporary files (`*.log`, `*.tmp`, `*.temp`)
- Jest temporary config (`jest.temp.config.js`)

### 📊 File Management Scripts

#### `check-file-sizes.js`
Monitors file sizes and identifies large files that might need attention.

**Usage:**
```bash
npm run check:sizes
```

**Checks:**
- Files larger than 1MB
- Directories larger than 10MB
- Generated directory sizes

### 🔍 Pre-commit Scripts

#### `pre-commit.js`
Prevents large files and generated files from being committed accidentally.

**Usage:**
```bash
npm run pre-commit
```

**Checks:**
- Forbidden file patterns (coverage, allure-results, etc.)
- Files larger than 1MB
- Staged files validation

### 🗄️ Database Scripts

#### `migrate.js`
Manages database migrations.

**Usage:**
```bash
npm run migrate            # Run all pending migrations
npm run migrate:up         # Run migrations up
npm run migrate:down       # Rollback migrations
npm run migrate:status     # Check migration status
```

### 🧪 Testing Scripts

#### `generate-allure-env.js`
Generates environment configuration for Allure test reporting.

**Usage:**
```bash
npm run allure:env
```

#### `test-migrations.js`
Tests database migrations in isolation.

**Usage:**
```bash
node scripts/test-migrations.js
```

## Script Dependencies

All scripts are written in Node.js and use the following built-in modules:
- `fs` - File system operations
- `path` - Path manipulation
- `child_process` - Command execution

## Best Practices

1. **Run cleanup regularly**: Use `npm run clean` before committing to remove generated files
2. **Check file sizes**: Use `npm run check:sizes` to monitor repository size
3. **Use pre-commit hooks**: Set up the pre-commit script to prevent unwanted files from being committed
4. **Keep scripts updated**: Update scripts when adding new file types or patterns

## Integration with Git Hooks

To automatically run the pre-commit script, you can set up a Git hook:

```bash
# Create the hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create the pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
npm run pre-commit
EOF

# Make it executable
chmod +x .git/hooks/pre-commit
```

## Troubleshooting

### Script Permission Issues
If you encounter permission issues, make sure the scripts are executable:
```bash
chmod +x scripts/*.js
```

### Large Files in Repository
If you accidentally commit large files:
1. Remove them from the repository: `git rm --cached <file>`
2. Add them to `.gitignore`
3. Commit the changes: `git commit -m "Remove large files"`

### Generated Files Being Committed
If generated files are being committed:
1. Run cleanup: `npm run clean`
2. Check `.gitignore` configuration
3. Use the pre-commit script to prevent future issues 