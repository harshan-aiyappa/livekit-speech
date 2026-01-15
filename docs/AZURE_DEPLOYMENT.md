# ☁️ Azure Deployment Guide

**Target Service:** Azure Web App for Containers (Linux)  
**Architecture:** Docker (Single Container)  
**Cost:** ~$13/month (B1 Plan) or Free (F1 - limited)

---

## 1. Prerequisites

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed
- Docker installed locally
- Active Azure Subscription

---

## 2. Prepare the Application

We use a **Multi-Stage Dockerfile** to build both Frontend and Backend into one image:

1. **Builds React App**: `npm run build` → `/app/frontend/dist`
2. **Setup Python**: Installs FastAPI, Whisper, FFmpeg
3. **Merge**: Copies React build to `/app/static`
4. **Result**: FastAPI serves both API and React UI

---

## 3. Deployment Steps

### Step 1: Login
```bash
az login
```

### Step 2: Create Resource Group
```bash
az group create --name VocalizeResourceGroup --location eastus
```

### Step 3: Create Container Registry (ACR)
```bash
az acr create --resource-group VocalizeResourceGroup --name vocalizeregistry --sku Basic --admin-enabled true
```

### Step 4: Build & Push Image
```bash
# Login to ACR
az acr login --name vocalizeregistry

# Build and Push (This runs the Dockerfile)
az acr build --registry vocalizeregistry --image vocalize-app:v1 .
```
*(This may take 5-10 mins as it installs dependencies)*

### Step 5: Create App Service Plan
```bash
# create a B1 plan (Basic Linux) - good starting point
az appservice plan create --name VocalizePlan --resource-group VocalizeResourceGroup --sku B1 --is-linux
```

### Step 6: Create Web App
```bash
az webapp create --resource-group VocalizeResourceGroup --plan VocalizePlan --name vocalize-speech-app --deployment-container-image-name vocalizeregistry.azurecr.io/vocalize-app:v1
```

### Step 7: Configure Variables
```bash
# Set environment variables
az webapp config appsettings set --resource-group VocalizeResourceGroup --name vocalize-speech-app --settings \
  LIVEKIT_URL="your_url" \
  LIVEKIT_API_KEY="your_key" \
  LIVEKIT_API_SECRET="your_secret" \
  WEBSITES_PORT=8000
```

---

## 4. Verification

1. Go to: `https://vocalize-speech-app.azurewebsites.net`
2. You should see the React App!
3. Test recording (WebSocket will connect automatically)

---

## 5. Troubleshooting

**Logs:**
```bash
az webapp log tail --name vocalize-speech-app --resource-group VocalizeResourceGroup
```

**Common Issues:**
- `Port 8000`: Ensure `WEBSITES_PORT=8000` is set.
- `Startup Time`: Whisper takes a few seconds to load. Set "Always On" in Azure configurations.
- `Memory`: If it crashes, upgrade plan to B2 or P1V2 (Whisper typically needs ~1GB RAM).

---

## 6. Continuous Deployment (CI/CD)

To auto-deploy when you push to Git:

1. Go to **Deployment Center** in Azure Portal
2. Select **GitHub** as source
3. Select your repo & branch
4. Azure will create a GitHub Action for you automatically!
