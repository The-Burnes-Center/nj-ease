# 📌 NJ EASE (Entrepreneurial Application Screening Engine)

> AI-powered web application that instantly verifies New Jersey business documents to accelerate incentive eligibility checks for the New Jersey Economic Development Authority (NJEDA).

---

## 🎬 Demo

![Demo GIF](./demo.gif)

---

## 🧠 What It Does

- 📄 **Multi-Document Support** – Validate Tax Clearance Certificates, Certificates of Formation/Incorporation, Operating Agreements, IRS Determination Letters, and more.
- 🖱️ **Drag-and-Drop Upload** – Drop a file up to 50 MB (PDF, DOCX, DOC, TXT, PNG, JPG, JPEG) or browse from your device.
- 🔍 **AI-Powered Extraction** – Uses Azure AI Document Intelligence (Form Recognizer) to extract text, tables, key–value pairs, and detect handwriting.
- ✅ **Rule-Based Verification** – Custom logic checks for required fields (organisation name, FEIN, dates < 6 months, official seals, signatures, etc.) and flags anything missing.
- 🌗 **Dark / Light Theme** – One-click toggle with preference saved to `localStorage`.
- ⚡ **Instant Feedback** – Results returned as JSON and rendered in a human-friendly checklist with suggested next steps if the document fails.

---

## 🧱 Architecture

```text
[Document Upload] → [Azure AI Document Intelligence Analysis] → [Field Extraction] → [Document Validation] → [Frontend Display]
```

---

## 🧰 Tech Stack

| Layer         | Tools & Frameworks                                          |
|---------------|-------------------------------------------------------------|
| **Frontend**  | Next.js 15, Tailwind CSS 4, Lucide Icons                    |
| **Backend**   | Azure Functions (Node 18)                                   |
| **AI/ML**     | Azure AI Document Intelligence (Form Recognizer v5 SDK)     |
| **Infra**     | Azure Static Web Apps, GitHub Actions (CI)                  |

---

## 🧪 Local Setup

### Prerequisites

1. **Node.js 18.x** (verify with `node -v`)
2. **npm** (bundled with Node) or **pnpm/yarn**
3. **Azure Functions Core Tools v4** – install via `npm i -g azure-functions-core-tools@4 --unsafe-perm true`.

### 1. Clone & Install Dependencies

```bash
# Clone
$ git clone https://github.com/kaushik-manivannan/ai-document-validator.git
$ cd ai-document-validator

# Install front-end dependencies
$ npm install

# Install API dependencies
$ cd api && npm install && cd ..
```

### 2. Create Azure AI Document Intelligence Resource

Azure AI Document Intelligence (formerly **Form Recognizer**) is the service that extracts structured data from your uploaded documents.

#### Option A — Azure Portal

1. Sign in to the [Azure portal](https://portal.azure.com/).
2. Select **Create a resource** → **AI Services** → **Document Intelligence**.
3. Fill in the required details:
   • **Subscription & Resource Group**
   • **Region**: Choose a supported region such as *East US*  
   • **Pricing tier**: **S0** (Standard)
4. Click **Review + Create** and wait for deployment to complete.
5. After deployment, open the resource and navigate to **Keys and Endpoint**.
   Copy the **Endpoint URL** and **Key 1** – you will use them in the next step.

#### Option B — Azure CLI

```bash
# Create a resource group (skip if it already exists)
az group create --name my-rg --location eastus

# Create the Document Intelligence (Form Recognizer) resource
az cognitiveservices account create \
  --name my-docintel \
  --resource-group my-rg \
  --location eastus \
  --kind FormRecognizer \
  --sku S0 \
  --yes

# Retrieve endpoint and key
az cognitiveservices account show  -n my-docintel -g my-rg --query "properties.endpoint" -o tsv
az cognitiveservices account keys list -n my-docintel -g my-rg --query "key1" -o tsv
```

Save the **endpoint** and **key** values; you will paste them into `api/local.settings.json` in the next step.

### 3. Configure Environment Variables

The validator needs credentials for Azure Document Intelligence.

Create an `api/local.settings.json` file for the API.

`api/local.settings.json` example:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "DI_ENDPOINT": "https://<your-resource>.cognitiveservices.azure.com/",
    "DI_KEY": "<your-ai-document-intelligence-key>"
  }
}
```

### 4. Run Locally

```bash
# Terminal 1 – start Azure Functions on http://localhost:7071
$ cd api && func start

# Terminal 2 – start Next.js dev server on http://localhost:3000
$ npm run dev
```

Open http://localhost:3000, upload a sample PDF, and click **Validate Document**.

### 5. Deploy to Azure Static Web Apps

You can host both the Next.js front-end **and** the Azure Functions API under a single Static Web App.

#### Quick Deploy from the Azure Portal

1. In the [Azure portal](https://portal.azure.com/), click **Create a resource** → **Static Web Apps**.
2. Fill in the **Basics** tab (subscription, resource group, name, region).
3. Under **Deployment details**, choose **GitHub** and authorise your account.
4. Select the repository **`<your-name>/ai-document-validator`** and the branch you want to deploy (e.g. `main`).
5. Build presets: choose **Custom** and use the following paths:
   - **App location**: `/`  
   - **API location**: `api`  
   - **Output location**: `out` (leave blank if using Next.js preset)
6. Review + Create – Azure will generate a GitHub Actions workflow (`azure-static-web-apps.yml`) that builds and deploys on every push.

#### CLI Alternative

```bash
az staticwebapp create \
  --name nj-ease \
  --resource-group my-rg \
  --source https://github.com/<your-name>/ai-document-validator \
  --location eastus \
  --branch main \
  --app-location "./" \
  --api-location "api" \
  --output-location "out" \
  --sku Free
```

#### Configure Production Environment Variables

After the Static Web App is created:

1. Go to your Static Web App resource → **Settings** → **Environment Variables**.
2. Add the following **Environment Variabes** (make sure they match the keys you created earlier):
   - `DI_ENDPOINT`
   - `DI_KEY`
3. Click **Save** which triggers a new deployment.

Your production site will be available at `https://<generated-name>.azurestaticapps.net`.

---

## 🧠 Core Modules

| Path                                    | Purpose                                                                 |
|-----------------------------------------|-------------------------------------------------------------------------|
| `components/DocumentValidator.jsx`      | Root UI component orchestrating validation flow                         |
| `api/validate-document/index.js`        | Azure Function – parses request, calls Form Recognizer, runs validation |
| `components/FileUploadArea.jsx`         | Drag-and-drop & file picker UI                                          |
| `components/ValidationResults.jsx`      | Renders pass/fail states, issues found & suggested actions              |
| `components/FormFields.jsx`             | User input fields for Organization Name & FEIN                          |

---

## 🌍 Validation Flow (per Document)

1. User selects a **Document Type** and uploads the file.
2. App encodes file → base64 JSON → `POST /api/validate-document`.
3. Azure Function streams file to **Azure AI Document Intelligence** (`prebuilt-document`).
4. Extracted text/tables are checked by **rule sets** (e.g. `validateTaxClearanceOnline`).
5. Response `{ success, missingElements, suggestedActions, documentInfo }` is sent back.
6. Once validation is complete, UI shows a green check-mark ✅ or a red banner 🚫 with details.

---

## 🛡️ Security & Privacy

- Documents are processed **in-memory only** – nothing is written to disk.
- No document data is persisted once the request completes.
- API is CORS-enabled but can be locked down to authenticated roles via Azure Static Web Apps config.
- Secrets (Azure keys) are stored in environment variables.

---

## 📦 Roadmap

- [ ] Plug-in additional LLM summarisation of failed checks
- [ ] Export validation report as PDF
- [ ] Batch upload documents

---

## 🤝 Contributing

Pull requests are welcome! Please open an issue to discuss your changes before starting major work.

1. Fork the repo & create a new branch.
2. Follow the local setup above.
3. Test the code
4. Open a pull request describing your changes.

---

## 📄 License

MIT License – see [`LICENSE.md`](./LICENSE.md) for details.

---

## 👥 Authors & Acknowledgements

Built by **Kaushik Manivannan & Aarushi Thejaswi** for the **New Jersey Economic Development Authority**.
