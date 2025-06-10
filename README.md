# 📄 NJ EASE (Entrepreneurial Application Screening Engine)

> _An AI document validation application that automatically validates business documents using Azure AI Form Recognizer and extracts key information for compliance verification._

---

## 🎬 Demo

![Demo GIF](./demo.gif)

> _Upload your business documents and get instant validation results with AI-powered analysis._

---

## 🧠 What It Does

- 📋 **Multi-Document Validation**: Supports 11+ business document types  
  Validates Tax Clearance Certificates, Formation Documents, Operating Agreements, and more with intelligent field extraction.

- 🤖 **AI-Powered Analysis**: Azure Form Recognizer integration  
  Uses advanced OCR and machine learning to extract and validate document fields automatically with 95%+ accuracy.

- 🎨 **Modern UI/UX**: Drag-and-drop interface with real-time feedback  
  Dark/light theme support, responsive design, and intuitive document upload experience.

---

## 🧱 Architecture

- Document validation workflow with Azure AI Form Recognizer integration
- Real-time processing with Next.js API routes and React components
- Example flow:

```
[Document Upload] → [File Validation] → [Azure AI Analysis] → [Field Extraction] → [Compliance Check] → [Results Display]
```

---

## 🧰 Tech Stack

| Layer          | Tools & Frameworks                                      |
|----------------|---------------------------------------------------------|
| **Frontend**   | Next.js 15, React 19, Tailwind CSS 4, Lucide Icons    |
| **Backend**    | Next.js API Routes, Azure AI Form Recognizer 5.0       |
| **AI/ML**      | Azure AI Form Recognizer, Document Intelligence         |
| **DevOps**     | Vercel, ESLint, Turbopack                              |

---

## 🧪 Setup

```bash
# Clone the repo
git clone https://github.com/your-username/ai-document-validator.git
cd ai-document-validator

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run locally
npm run dev
```

**Environment Variables (.env.local):**
```env
# Required: Azure AI Form Recognizer
DI_ENDPOINT=your-azure-form-recognizer-endpoint
DI_KEY=your-azure-form-recognizer-key
```

---

## 🧠 Core Components

| Component                   | Description                                                                 |
|-----------------------------|-----------------------------------------------------------------------------|
| `DocumentValidator.jsx`     | Main validation orchestrator with state management and workflow control     |
| `FileUploadArea.jsx`        | Drag-and-drop file upload with validation and preview functionality         |
| `ValidationResults.jsx`     | AI analysis results display with extracted fields and compliance status     |
| `DocumentTypeSelector.jsx`  | Smart document type selection with dynamic field requirements               |
| `FormFields.jsx`            | Dynamic form generation based on document type requirements                 |
| `ValidationButton.jsx`      | Validation trigger with loading states and progress indicators              |
| `Header.jsx`                | Application header with theme toggle and branding                           |
| `ErrorMessage.jsx`          | Error display component for user feedback                                   |

---

## 🔄 Document Processing Flow

> _Multi-step validation process with AI-powered analysis._

1. 📤 **Upload Handler** → Validates file type, size (50MB max), and format compatibility  
2. 🔍 **Azure AI Analysis** → Extracts text and structure using prebuilt-document model  
3. ✅ **Field Validation** → Compares extracted data against expected document fields  
4. 📊 **Results Generation** → Generates comprehensive validation report with confidence scores  
5. 💬 **User Feedback** → Displays validation results with detailed field-by-field analysis

---

## 🛡️ Security & Privacy

- All documents processed in-memory, no permanent file storage
- Azure AI Form Recognizer handles data processing with enterprise-grade security
- Client-side file validation before upload (PDF, DOCX, DOC, TXT, PNG, JPG, JPEG)
- Environment variables for secure API key management
- 50-second processing timeout to prevent resource exhaustion

---

## 📋 Supported Document Types

| Document Type | Required Fields | Validation Features |
|---------------|----------------|-------------------|
| Tax Clearance Certificate (Online) | Organization Name, FEIN | Automated field matching with fuzzy logic |
| Tax Clearance Certificate (Manual) | Organization Name, FEIN | Manual format recognition and validation |
| Certificate of Formation | Organization Name | Entity formation document verification |
| Certificate of Formation - Independent | Organization Name | Independent entity validation |
| Certificate of Incorporation | Organization Name | Corporate structure validation |
| Operating Agreement | Organization Name | LLC governance document verification |
| IRS Determination Letter | None | Non-profit status verification |
| Certificate of Authority | Organization Name | Foreign entity authorization |
| Certificate of Alternative Name | Organization Name | DBA registration validation |
| Certificate of Trade Name | None | Business name registration |
| By-laws | None | Corporate governance rules verification |

**File Support**: PDF, DOCX, DOC, TXT, PNG, JPG, JPEG (up to 50MB)  
**Processing Time**: ~2-5 seconds per document  
**Accuracy**: 95%+ field extraction accuracy with Azure AI

---

## 📦Superior Features

- **Smart Organization Name Matching**: Advanced fuzzy logic for matching organization names with abbreviations (LLC ↔ Limited Liability Company)
- **Date Validation**: Automatic date extraction and validation for time-sensitive documents
- **Theme Support**: Dark/light mode with system preference detection
- **Responsive Design**: Mobile-first approach with optimized layouts for all screen sizes
- **Real-time Validation**: Instant feedback during form filling and file upload
- **Drag & Drop**: Intuitive file upload with visual feedback

---

## 🚀 Roadmap

- [ ] Implement batch document processing

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss proposed modifications.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License – see `LICENSE.md` for details.

---

## 👥 Authors & Acknowledgements

- Built by **Kaushik Manivannan** & **Aarushi Thejaswi**
- Powered by **Azure AI Form Recognizer**  
- Inspired by the need for automated document compliance in NJEDA's business operations
