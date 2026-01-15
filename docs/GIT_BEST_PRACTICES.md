# Git Best Practices & Commit Guide

## 📦 What's Ignored (`.gitignore`)

### ✅ Properly Excluded (Don't commit these!)

**Backend (Python):**
- ✅ `venv/`, `venv311/` - Virtual environments (~500MB)
- ✅ `__pycache__/` - Python cache
- ✅ `*.pyc`, `*.pyo` - Compiled Python
- ✅ `.pytest_cache/` - Test cache

**Frontend (Node.js):**
- ✅ `node_modules/` - Dependencies (~300MB!)
- ✅ `dist/`, `.vite/` - Build outputs
- ✅ `coverage/` - Test coverage reports

**Models & Cache:**
- ✅ `*.pt`, `*.onnx` - Model files (would be huge!)
- ✅ `models/`, `.cache/` - Whisper model cache
- ✅ Note: Models download to `~/.cache/huggingface/` automatically

**Secrets:**
- ✅ `.env` - **Never commit secrets!**
- ✅ `.env.local`, `.env.production.local`

**Generated Files:**
- ✅ `*.png`, `*.jpg` - Generated diagrams
- ✅ Exception: Frontend public assets (included)
- ✅ `*.log` - Log files

---

## ⚠️ Large Files to Watch

### `package-lock.json` (~1MB)
**Status**: Currently included ✅  
**Why**: Ensures consistent dependency versions  
**Note**: Can cause merge conflicts

**Options:**
```bash
# Option 1: Keep it (recommended for team)
git add package-lock.json

# Option 2: Ignore it (solo projects)
echo "package-lock.json" >> .gitignore
```

### Generated Images
**Status**: Now excluded ✅  
**Why**: AI-generated, can regenerate  
**Exception**: Public assets kept

---

## 📊 Commit Size Guidelines

### Good Commit (< 1MB)
```bash
✅ Code changes only
✅ Documentation updates
✅ Config file tweaks
```

### Medium Commit (1-10MB)
```bash
⚠️ package-lock.json changes
⚠️ Small images in public/
⚠️ Acceptable but monitor
```

### Bad Commit (> 10MB)
```bash
❌ node_modules/ (shouldn't happen with .gitignore)
❌ venv/ (shouldn't happen with .gitignore)
❌ Model files (shouldn't happen with .gitignore)
❌ Large binary files
```

---

## 🔍 Check Before Committing

### Quick Size Check
```bash
# See what files are staged
git status

# Check size of staged files
git diff --cached --stat

# See detailed changes
git diff --cached
```

### Verify `.gitignore` Working
```bash
# This should NOT show:
# - node_modules/
# - venv/ or venv311/
# - .env
# - *.pyc files
# - dist/

git status
```

### If You See Heavy Files
```bash
# Unstage everything
git reset

# Update .gitignore
echo "heavy-file-or-folder/" >> .gitignore

# Stage only what you need
git add <specific-files>
```

---

## ✅ Safe Commit Checklist

Before `git commit`:

- [ ] No `node_modules/` in staged files
- [ ] No `venv/` in staged files  
- [ ] No `.env` files
- [ ] No model files (*.pt, *.onnx)
- [ ] No large binaries (> 5MB per file)
- [ ] `package-lock.json` < 2MB
- [ ] Only code, docs, configs

---

## 📝 Recommended Workflow

### Initial Commit
```bash
# Clean state
git status

# Add only tracked files
git add README.md
git add frontend/src/
git add backend/main.py
git add docs/

# Commit with message
git commit -m "feat: add speech transcription app"
```

### Regular Updates
```bash
# Check what changed
git status

# Review changes
git diff

# Add specific files
git add <file>

# Commit
git commit -m "fix: improve iOS compatibility"
```

### Before Push
```bash
# Check total repo size
du -sh .git

# Should be < 50MB for this project
# If > 100MB, something is wrong!
```

---

## 🚫 Common Mistakes to Avoid

### 1. Committing `node_modules/`
```bash
# ❌ NEVER do this
git add .  # Dangerous! Adds everything

# ✅ Instead
git add frontend/src/
git add frontend/package.json
# (node_modules excluded by .gitignore)
```

### 2. Committing `.env`
```bash
# ❌ Secrets leaked!
git add .env

# ✅ Committed .env to git by accident?
git rm --cached .env
echo ".env" >> .gitignore
git commit -m "fix: remove .env from git"
```

### 3. Huge Binary Files
```bash
# ❌ Model files
git add models/whisper-base.pt  # 140MB!

# ✅ Models should auto-download
# Document in README how to download
echo "models/" >> .gitignore
```

---

## 🎯 Current Project Status

### Repository Size
- **Target**: < 10MB (code only)
- **Warning**: 10-50MB (check for heavy files)
- **Critical**: > 50MB (cleanup needed!)

### What Should Be Committed
```
✅ frontend/src/          (React code)
✅ backend/main.py        (FastAPI server)
✅ docs/                  (Documentation)
✅ README.md              (Project info)
✅ .gitignore             (Exclusions)
✅ package.json           (Dependencies list)
✅ requirements.txt       (Python deps)
✅ vite.config.ts         (Frontend config)
```

### What Should NOT Be Committed
```
❌ node_modules/          (300MB+)
❌ venv311/               (500MB+)
❌ .env                   (Secrets!)
❌ *.pyc                  (Compiled)
❌ dist/                  (Built files)
❌ .cache/                (Temp files)
❌ *.log                  (Logs)
```

---

## 🔧 Cleanup Commands

### If Repo Got Too Large
```bash
# Find large files
git rev-list --objects --all | \
  git cat-file --batch-check='%(objectsize:disk) %(objectname) %(rest)' | \
  sort -rn | head -20

# Remove file from history (careful!)
git filter-branch --tree-filter 'rm -rf node_modules' HEAD

# Or use BFG (easier)
git clone --mirror <repo>
bfg --strip-blobs-bigger-than 5M <repo>
```

### Fresh Start
```bash
# If repo is too messy
rm -rf .git
git init
git add .gitignore
git commit -m "chore: initial commit with proper gitignore"
git add <files>
git commit -m "feat: add project files"
```

---

## 📚 Resources

- [GitHub .gitignore Templates](https://github.com/github/gitignore)
- [Git Large File Storage (LFS)](https://git-lfs.github.com/)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

---

**Golden Rule**: If it's generated, downloaded, or contains secrets → **DON'T COMMIT IT!**

---

**Last Updated**: January 15, 2026
