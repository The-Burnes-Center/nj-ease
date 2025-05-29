// app/api/validate-document/route.js
import { NextResponse } from "next/server";
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";

// Configuration from environment variables
const endpoint = process.env.DI_ENDPOINT;
const key = process.env.DI_KEY;

// Helper function to extract text from spans
function* getTextOfSpans(content, spans) {
  for (const span of spans) {
    yield content.slice(span.offset, span.offset + span.length);
  }
}

export async function POST(request) {
  try {
    // Set a timeout to abort if processing takes too long
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Processing timeout")), 50000); // 50 second timeout
    });

    // Main processing function
    const processingPromise = async () => {
      // Parse the form data
      const formData = await request.formData();
      const file = formData.get("file");
      const documentType = formData.get("documentType") || "tax-clearance-online";
      
      // Get additional form fields
      const organizationName = formData.get("organizationName") || "";
      const ownerName = formData.get("ownerName") || "";
      const fein = formData.get("fein") || "";

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      // Convert the file into a Buffer
      const buffer = Buffer.from(await file.arrayBuffer());
      // Determine the file's content type
      const contentType = file.type || "application/octet-stream";

      // Create the Document Intelligence Client
      const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));

      // Analyze the document - using prebuilt-document for more advanced structure analysis
      const poller = await client.beginAnalyzeDocument("prebuilt-document", buffer, {
        contentType, 
      });

      // Wait until the operation completes
      const result = await poller.pollUntilDone();
      
      // Safely destructure with defaults
      const {
        content = "",
        pages = [],
        languages = [],
        styles = [],
        tables = [],
        keyValuePairs = [],
        entities = [],
      } = result;

      // Pre-process lowercase content to avoid repeated toLowerCase() calls
      const contentLower = content.toLowerCase();

      // Validate based on document type
      const validationResults = validateDocumentByType({
        documentType,
        content,
        contentLower,
        pages,
        languages,
        styles,
        tables,
        keyValuePairs,
        entities,
        formFields: {
          organizationName,
          ownerName,
          fein
        }
      });

      // Prepare document info
      const documentInfo = {
        pageCount: pages.length,
        wordCount: pages.reduce((sum, page) => sum + (page.words ? page.words.length : 0), 0),
        languageInfo: languages.map(lang => ({
          languageCode: lang.languageCode,
          confidence: lang.confidence
        })),
        containsHandwriting: styles.some(style => style.isHandwritten),
        documentType,
        detectedOrganizationName: validationResults.detectedOrganizationName || null
      };

      return NextResponse.json({
        success: validationResults.missingElements.length === 0,
        missingElements: validationResults.missingElements,
        suggestedActions: validationResults.suggestedActions || [],
        documentInfo
      });
    };

    // Race between processing and timeout
    return await Promise.race([processingPromise(), timeoutPromise]);

  } catch (error) {
    console.error("Error in document validation:", error);
    if (error.message === "Processing timeout") {
      return NextResponse.json(
        { error: "Request timed out. Document processing took too long." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to validate document" },
      { status: 500 }
    );
  }
}

function validateDocumentByType(options) {
  const { documentType, content, contentLower, pages, languages, styles, tables, keyValuePairs, entities, formFields } = options;
  
  switch(documentType) {
    case 'tax-clearance-online':
      return validateTaxClearanceOnline(content, contentLower, pages, keyValuePairs, formFields);
    case 'tax-clearance-manual':
      return validateTaxClearanceManual(content, contentLower, pages, keyValuePairs, formFields);
    case 'cert-alternative-name':
      return validateCertificateAlternativeName(content, contentLower, pages, keyValuePairs);
    case 'cert-trade-name':
      return validateCertificateOfTradeName(content, contentLower, pages, keyValuePairs);
    case 'cert-formation':
      return validateCertificateOfFormation(content, contentLower, pages, keyValuePairs, formFields);
    case 'cert-formation-independent':
      return validateCertificateOfFormationIndependent(content, contentLower, pages, keyValuePairs, formFields);
    case 'cert-good-standing-long':
      return validateCertificateOfGoodStandingLong(content, contentLower, pages, keyValuePairs, formFields);
    case 'cert-good-standing-short':
      return validateCertificateOfGoodStandingShort(content, contentLower, pages, keyValuePairs, formFields);
    case 'operating-agreement':
      return validateOperatingAgreement(content, contentLower, pages, keyValuePairs, formFields);
    case 'cert-incorporation':
      return validateCertificateOfIncorporation(content, contentLower, pages, keyValuePairs, formFields);
    case 'irs-determination':
      return validateIRSDeterminationLetter(content, contentLower, pages, keyValuePairs);
    case 'bylaws':
      return validateBylaws(content, contentLower, pages, keyValuePairs);
    case 'cert-authority':
      return validateCertificateOfAuthority(content, contentLower, pages, keyValuePairs, formFields);
    case 'cert-authority-auto':
      return validateCertificateOfAuthorityAutomatic(content, contentLower, pages, keyValuePairs);
    default:
      return { 
        missingElements: ["Unknown document type"],
        suggestedActions: ["Select a valid document type and try again"]
      };
  }
}

// Validation for Tax Clearance Certificate (Online)
function validateTaxClearanceOnline(content, contentLower, pages, keyValuePairs, formFields) {
  const missingElements = [];
  const suggestedActions = [];
  let detectedOrganizationName = null;
  
  // Looking for organization name before "BUSINESS ASSISTANCE OR INCENTIVE" line
  const lines = content.split('\n');
  const businessAssistanceIndex = lines.findIndex(line => 
    line.includes("BUSINESS ASSISTANCE OR INCENTIVE") || 
    line.includes("CLEARANCE CERTIFICATE")
  );
  
  if (businessAssistanceIndex > 0) {
    // Look for org name in lines before the business assistance line (typically 1-4 lines above)
    for (let i = Math.max(0, businessAssistanceIndex - 5); i < businessAssistanceIndex; i++) {
      const line = lines[i].trim();
      // Skip empty lines, dates, or lines with less than 3 characters
      if (line && line.length > 3 && !line.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        // Skip lines that have typical headers or metadata
        if (!line.toLowerCase().includes("state of") && 
            !line.toLowerCase().includes("department of") &&
            !line.toLowerCase().includes("division of") &&
            !line.toLowerCase().includes("governor") &&
            !line.match(/^attn:/i)) {
          // Found a potential organization name line
          detectedOrganizationName = line;
          // If it's all caps, it's very likely the org name
          if (line === line.toUpperCase() && line.length > 5) {
            break;  // We're confident this is the org name
          }
        }
      }
    }
  }
  
  // Fallback: If still no org name, try key-value pairs
  if (!detectedOrganizationName) {
    const orgNamePair = keyValuePairs.find(pair => 
      pair.key && pair.key.content && 
      (pair.key.content.toLowerCase().includes('taxpayer name') ||
       pair.key.content.toLowerCase().includes('applicant') ||
       pair.key.content.toLowerCase().includes('business name'))
    );
    
    if (orgNamePair && orgNamePair.value) {
      detectedOrganizationName = orgNamePair.value.content;
    }
  }
  
  // Check for organization name match if provided
  if (formFields.organizationName && detectedOrganizationName) {
    const orgNameLower = formFields.organizationName.toLowerCase().trim();
    const detectedOrgNameLower = detectedOrganizationName.toLowerCase().trim();
    
    if (!detectedOrgNameLower.includes(orgNameLower) && !orgNameLower.includes(detectedOrgNameLower)) {
      missingElements.push("Organization name doesn't match the one on the certificate");
      suggestedActions.push("Verify that the correct organization name was entered");
    }
  }
  
  // Check for required keywords
  if (!contentLower.includes("clearance certificate")) {
    missingElements.push("Required text: 'Clearance Certificate'");
  }
  
  // Check for Serial#
  const hasSerial = contentLower.includes("serial#") || 
                   contentLower.includes("serial #") ||
                   contentLower.includes("serial number") ||
                   content.match(/serial[\s#]*:?\s*\d+/i);
                   
  if (!hasSerial) {
    missingElements.push("Required element: Serial Number");
    suggestedActions.push("Verify this is an online-generated certificate with a Serial Number");
  }
  
  // Check for State of New Jersey
  if (!contentLower.includes("state of new jersey") && 
      !contentLower.includes("new jersey")) {
    missingElements.push("Required text: 'State of New Jersey'");
  }
  
  // Check for Department of Treasury
  if (!contentLower.includes("department of treasury") && 
      !contentLower.includes("dept of treasury") && 
      !contentLower.includes("department of the treasury") && 
      !contentLower.includes("dept. of treasury")) {
    missingElements.push("Required element: Department of Treasury");
  }
  
  // Check for Division of Taxation
  if (!contentLower.includes("division of taxation")) {
    missingElements.push("Required element: Division of Taxation");
  }
  
  // Check for Applicant ID or FEIN
  let detectedId = null;
  
  // Look for Applicant ID patterns in content
  const applicantIdMatch = content.match(/applicant\s+id[#:]?\s*:?\s*(.*?)(?=\r|\n|$)/i);
  if (applicantIdMatch && applicantIdMatch[1]) {
    detectedId = applicantIdMatch[1].trim();
  }
  
  // If not found yet, check key-value pairs
  if (!detectedId) {
    const idPair = keyValuePairs.find(pair => 
      pair.key && pair.key.content && 
      (pair.key.content.toLowerCase().includes('applicant id') ||
       pair.key.content.toLowerCase().includes('id #'))
    );
    
    if (idPair && idPair.value) {
      detectedId = idPair.value.content;
    }
  }
  
  // Now check if the FEIN provided matches the detected ID
  if (formFields.fein && formFields.fein.length >= 3 && detectedId) {
    const lastThreeDigits = formFields.fein.slice(-3);
    
    // Check if the last 3 digits of the FEIN appear in the detected ID
    const hasIdMatch = detectedId.includes(lastThreeDigits);
    
    if (!hasIdMatch) {
      missingElements.push("FEIN last three digits don't match the Applicant ID on the certificate");
      suggestedActions.push("Verify that the correct FEIN was entered");
    }
  }
  
  // Check for agency - reject Department of Environmental Protection
  const rejectedAgencies = [
    "department of environmental protection",
    "environmental protection",
  ];
  
  const hasRejectedAgency = rejectedAgencies.some(agency => 
    contentLower.includes(agency)
  );
  
  if (hasRejectedAgency) {
    missingElements.push("Agency error: Document contains reference to Department of Environmental Protection");
    suggestedActions.push("This agency is not accepted. Please provide a certificate for a different agency");
  }
  
  // Check for date within 6 months
  const isDateWithinSixMonths = checkDateWithinSixMonths(content);
  if (!isDateWithinSixMonths) {
    missingElements.push("Certificate must be dated within the past six months");
    suggestedActions.push("Obtain a more recent tax clearance certificate");
  }
  
  // Check for validity period
  const hasValidityPeriod = content.includes("valid for 180 days") || 
                            content.includes("days from the date") || 
                            /expiration|expiry/i.test(content);
  if (!hasValidityPeriod) {
    missingElements.push("Certificate validity period");
    suggestedActions.push("Verify the certificate indicates its validity period");
  }
  
  // Check for signature
  const hasSignature = content.includes("Acting Director") || 
                       content.includes("Director of Taxation") ||
                       content.match(/Marita\s+R\.\s+Sciarrotta|John\s+J\.\s+Ficara/i);
  
  if (!hasSignature) {
    missingElements.push("Authorized signature");
    suggestedActions.push("Verify the certificate has been signed by an authorized official");
  }

  return { 
    missingElements, 
    suggestedActions,
    detectedOrganizationName
  };
}

// Validation for Tax Clearance Certificate (Manual)
function validateTaxClearanceManual(content, contentLower, pages, keyValuePairs, formFields) {
  const missingElements = [];
  const suggestedActions = [];
  let detectedOrganizationName = null;
  
  // Looking for organization name before "BUSINESS ASSISTANCE OR INCENTIVE" line
  const lines = content.split('\n');
  const businessAssistanceIndex = lines.findIndex(line => 
    line.includes("BUSINESS ASSISTANCE OR INCENTIVE") || 
    line.includes("CLEARANCE CERTIFICATE")
  );
  
  if (businessAssistanceIndex > 0) {
    // Look for org name in lines before the business assistance line (typically 1-4 lines above)
    for (let i = Math.max(0, businessAssistanceIndex - 5); i < businessAssistanceIndex; i++) {
      const line = lines[i].trim();
      // Skip empty lines, dates, or lines with less than 3 characters
      if (line && line.length > 3 && !line.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        // Skip lines that have typical headers or metadata
        if (!line.toLowerCase().includes("state of") && 
            !line.toLowerCase().includes("department of") &&
            !line.toLowerCase().includes("division of") &&
            !line.toLowerCase().includes("governor") &&
            !line.match(/^attn:/i)) {
          // Found a potential organization name line
          detectedOrganizationName = line;
          // If it's all caps, it's very likely the org name
          if (line === line.toUpperCase() && line.length > 5) {
            break;  // We're confident this is the org name
          }
        }
      }
    }
  }
  
  // Fallback: If still no org name, try key-value pairs
  if (!detectedOrganizationName) {
    const orgNamePair = keyValuePairs.find(pair => 
      pair.key && pair.key.content && 
      (pair.key.content.toLowerCase().includes('taxpayer name') ||
       pair.key.content.toLowerCase().includes('applicant') ||
       pair.key.content.toLowerCase().includes('business name'))
    );
    
    if (orgNamePair && orgNamePair.value) {
      detectedOrganizationName = orgNamePair.value.content;
    }
  }
  
  // Check for organization name match if provided
  if (formFields.organizationName && detectedOrganizationName) {
    const orgNameLower = formFields.organizationName.toLowerCase().trim();
    const detectedOrgNameLower = detectedOrganizationName.toLowerCase().trim();
    
    if (!detectedOrgNameLower.includes(orgNameLower) && !orgNameLower.includes(detectedOrgNameLower)) {
      missingElements.push("Organization name doesn't match the one on the certificate");
      suggestedActions.push("Verify that the correct organization name was entered");
    }
  }
  
  // Check for required keywords
  if (!contentLower.includes("clearance certificate")) {
    missingElements.push("Required text: 'Clearance Certificate'");
  }
  
  // Check for State of New Jersey
  if (!contentLower.includes("state of new jersey")) {
    missingElements.push("Required text: 'State of New Jersey'");
  }

  // Check for BATC Manual indication - this is a REQUIRED check for manual certificates
  if (!contentLower.includes("batc")) {
    missingElements.push("Required text: 'BATC Manual'");
    suggestedActions.push("Verify this is a manually generated tax clearance certificate");
  }
  
  // Check for Department of Treasury
  if (!contentLower.includes("department of treasury") && 
      !contentLower.includes("dept of treasury") && 
      !contentLower.includes("department of the treasury") && 
      !contentLower.includes("dept. of treasury")) {
    missingElements.push("Required element: Department of Treasury");
  }
  
  // Check for Division of Taxation
  if (!contentLower.includes("division of taxation")) {
    missingElements.push("Required element: Division of Taxation");
  }
  
  // Check for Applicant ID or FEIN
  let detectedId = null;
  
  // Look for Applicant ID patterns in content
  const applicantIdMatch = content.match(/applicant\s+id[#:]?\s*:?\s*(.*?)(?=\r|\n|$)/i);
  if (applicantIdMatch && applicantIdMatch[1]) {
    detectedId = applicantIdMatch[1].trim();
  }
  
  // If not found yet, check key-value pairs
  if (!detectedId) {
    const idPair = keyValuePairs.find(pair => 
      pair.key && pair.key.content && 
      (pair.key.content.toLowerCase().includes('applicant id') ||
       pair.key.content.toLowerCase().includes('id #'))
    );
    
    if (idPair && idPair.value) {
      detectedId = idPair.value.content;
    }
  }
  
  // Now check if the FEIN provided matches the detected ID
  if (formFields.fein && formFields.fein.length >= 3 && detectedId) {
    const lastThreeDigits = formFields.fein.slice(-3);
    
    // Check if the last 3 digits of the FEIN appear in the detected ID
    const hasIdMatch = detectedId.includes(lastThreeDigits);
    
    if (!hasIdMatch) {
      missingElements.push("FEIN last three digits don't match the Applicant ID on the certificate");
      suggestedActions.push("Verify that the correct FEIN was entered");
    }
  }
  
  // Check for agency - reject Department of Environmental Protection
  const rejectedAgencies = [
    "department of environmental protection",
    "environmental protection",
  ];
  
  const hasRejectedAgency = rejectedAgencies.some(agency => 
    contentLower.includes(agency)
  );
  
  if (hasRejectedAgency) {
    missingElements.push("Agency error: Document contains reference to Department of Environmental Protection");
    suggestedActions.push("This agency is not accepted. Please provide a certificate for a different agency");
  }
  
  // Check for date within 6 months
  const isDateWithinSixMonths = checkDateWithinSixMonths(content);
  if (!isDateWithinSixMonths) {
    missingElements.push("Certificate must be dated within the past six months");
    suggestedActions.push("Obtain a more recent tax clearance certificate");
  }
  
  // Check for validity period
  const hasValidityPeriod = content.includes("valid for 180 days") || 
                            content.includes("days from the date") || 
                            /expiration|expiry/i.test(content);
  if (!hasValidityPeriod) {
    missingElements.push("Certificate validity period");
    suggestedActions.push("Verify the certificate indicates its validity period");
  }
  
  // Check for signature
  const hasSignature = content.includes("Acting Director") || 
                       content.includes("Director of Taxation") ||
                       content.match(/Marita\s+R\.\s+Sciarrotta|John\s+J\.\s+Ficara/i);
  
  if (!hasSignature) {
    missingElements.push("Authorized signature");
    suggestedActions.push("Verify the certificate has been signed by an authorized official");
  }

  return {
    missingElements, 
    suggestedActions,
    detectedOrganizationName
  };
}

// Validation for Certificate of Alternative Name
function validateCertificateAlternativeName(content, contentLower, pages, keyValuePairs) {
  const missingElements = [];
  const suggestedActions = [];
  
  // Check for required elements
  if (!contentLower.includes("registration") || !contentLower.includes("alternate name")) {
    missingElements.push("Required text: 'Certificate of Alternate Name'");
  }
  
  // Check for date stamp by Dept. of Treasury
  const hasTreasuryDateStamp = contentLower.includes("filed") && 
                               contentLower.includes("state treasurer");
  
  if (!hasTreasuryDateStamp) {
    missingElements.push("Date stamp by Department of Treasury");
    suggestedActions.push("Verify document has been properly stamped by the Department of Treasury");
  }
  
  // Check for Division of Revenue in the top center
  const hasDivisionOfRevenue = contentLower.includes("division of revenue");
  if (!hasDivisionOfRevenue) {
    missingElements.push("Division of Revenue");
    suggestedActions.push("Verify document contains 'Division of Revenue'");
  }

  return { 
    missingElements, 
    suggestedActions 
  };
}

// Validation for Certificate of Formation
function validateCertificateOfFormation(content, contentLower, pages, keyValuePairs, formFields) {
  const missingElements = [];
  const suggestedActions = [];
  let detectedOrganizationName = null;
  
  // Look for entity name in the document
  // Method 1: Check by "Name:" keyword
  const nameMatch = content.match(/name:\s*([^\r\n]+)/i) || content.match(/name of domestic corporation:\s*([^\r\n]+)/i) || content.match(/the name of the limited liability company is\s*([^\r\n]+)/i);
  if (nameMatch && nameMatch[1] && nameMatch[1].trim().length > 0) {
    detectedOrganizationName = nameMatch[1].trim();
  }
  
  // Method 2: Check from "The above-named" text
  if (!detectedOrganizationName) {
    const aboveNamedMatch = content.match(/above-named\s+([^was]+)was/i);
    if (aboveNamedMatch && aboveNamedMatch[1] && aboveNamedMatch[1].trim().length > 0) {
      detectedOrganizationName = aboveNamedMatch[1].trim();
    }
  }
  
  // Method 3: Try to extract from key-value pairs
  if (!detectedOrganizationName) {
    const namePair = keyValuePairs.find(pair => 
      pair.key && pair.key.content && 
      pair.key.content.toLowerCase().trim() === 'name:'
    );
    
    if (namePair && namePair.value) {
      detectedOrganizationName = namePair.value.content;
    }
  }
  
  // Check for organization name match if provided
  if (formFields.organizationName && detectedOrganizationName) {
    const orgNameLower = formFields.organizationName.toLowerCase().trim();
    const detectedOrgNameLower = detectedOrganizationName.toLowerCase().trim();
    
    if (!detectedOrgNameLower.includes(orgNameLower) && !orgNameLower.includes(detectedOrgNameLower)) {
      missingElements.push("Organization name doesn't match the one on the certificate");
      suggestedActions.push("Verify that the correct organization name was entered");
    }
  }
  
  // Check for required elements
  if (!contentLower.includes("certificate of formation")) {
    missingElements.push("Required text: 'Certificate of Formation'");
  }
  
  // Check for NJ Department/Treasury references
  if (!contentLower.includes("new jersey department of the treasury") && 
      !contentLower.includes("nj department of the treasury") &&
      !contentLower.includes("division of revenue")) {
    missingElements.push("New Jersey Department of the Treasury/Division of Revenue");
    suggestedActions.push("Verify certificate is issued by the NJ Department of the Treasury");
  }
  
  // Check for entity ID/identification number
  const hasEntityID = /identification number|entity id|entity number|business id number|filed number/i.test(content);
  if (!hasEntityID) {
    missingElements.push("Entity ID/identification number");
    suggestedActions.push("Verify document shows entity identification number");
  }
  
  // Check for filing date
  const hasFilingDate = /duly filed|filed in accordance|date|filed on|filing date/i.test(content);
  if (!hasFilingDate) {
    missingElements.push("Filing date");
    suggestedActions.push("Verify document shows filing date");
  }
  
  // Check for state seal
  // const hasStateSeal = /official seal|seal of the state|great seal/i.test(content) || 
  //                     contentLower.includes("seal") && 
  //                     (contentLower.includes("affixed") || 
  //                      contentLower.includes("testimony") || 
  //                      contentLower.includes("whereof"));
  
  // if (!hasStateSeal) {
  //   missingElements.push("NJ State Seal");
  //   suggestedActions.push("Verify document contains the NJ state seal");
  // }
  
  // Check for signature of state official
  const hasSignature = /signature|signed|authorized representative/i.test(content) ||
                      /state treasurer|treasurer/i.test(content);
  
  if (!hasSignature) {
    missingElements.push("Signature of authorized state official");
    suggestedActions.push("Verify document has been signed by an authorized state official");
  }
  
  // Check for verification info
  const hasVerificationInfo = /verify this certificate|verification|certification/i.test(content);
  
  if (!hasVerificationInfo) {
    missingElements.push("Certificate verification information");
    suggestedActions.push("Verify document contains certificate verification information");
  }
  
  // Check for key sections that should be in a certificate of formation
  const requiredSections = [
    { name: "Registered agent", regex: /registered\s+agent/i },
    { name: "Registered office", regex: /registered\s+office/i }
  ];
  
  for (const section of requiredSections) {
    if (!section.regex.test(content)) {
      missingElements.push(`${section.name} section`);
      suggestedActions.push(`Verify document contains ${section.name.toLowerCase()} information`);
    }
  }
  
  return { 
    missingElements, 
    suggestedActions,
    detectedOrganizationName
  };
}

// Validation for Certificate of Formation - Independent
function validateCertificateOfFormationIndependent(content, contentLower, pages, keyValuePairs, formFields) {
  const missingElements = [];
  const suggestedActions = [];
  let detectedOrganizationName = null;
  
  // Look for entity name in the document
  // Method 1: Check by "Name:" keyword
  const nameMatch = content.match(/name:\s*([^\r\n]+)/i) || content.match(/name of domestic corporation:\s*([^\r\n]+)/i) || content.match(/the name of the limited liability company is\s*([^\r\n]+)/i);
  if (nameMatch && nameMatch[1] && nameMatch[1].trim().length > 0) {
    detectedOrganizationName = nameMatch[1].trim();
  }
  
  // Method 2: Check from "The above-named" text
  if (!detectedOrganizationName) {
    const aboveNamedMatch = content.match(/above-named\s+([^was]+)was/i);
    if (aboveNamedMatch && aboveNamedMatch[1] && aboveNamedMatch[1].trim().length > 0) {
      detectedOrganizationName = aboveNamedMatch[1].trim();
    }
  }
  
  // Method 3: Try to extract from key-value pairs
  if (!detectedOrganizationName) {
    const namePair = keyValuePairs.find(pair => 
      pair.key && pair.key.content && 
      pair.key.content.toLowerCase().trim() === 'name:'
    );
    
    if (namePair && namePair.value) {
      detectedOrganizationName = namePair.value.content;
    }
  }
  
  // Check for organization name match if provided
  if (formFields.organizationName && detectedOrganizationName) {
    const orgNameLower = formFields.organizationName.toLowerCase().trim();
    const detectedOrgNameLower = detectedOrganizationName.toLowerCase().trim();
    
    if (!detectedOrgNameLower.includes(orgNameLower) && !orgNameLower.includes(detectedOrgNameLower)) {
      missingElements.push("Organization name doesn't match the one on the certificate");
      suggestedActions.push("Verify that the correct organization name was entered");
    }
  }
  
  // Check for required elements
  if (!contentLower.includes("certificate of formation")) {
    missingElements.push("Required text: 'Certificate of Formation'");
  }

  // Check for stamp - NOT HERE YET
  
  // Check for entity ID/identification number
  const hasEntityID = /identification number|entity id|entity number|business id number|filed number/i.test(content);
  if (!hasEntityID) {
    missingElements.push("Entity ID/identification number");
    suggestedActions.push("Verify document shows entity identification number");
  }
  
  // Check for filing date
  const hasFilingDate = /duly filed|filed in accordance|date|filed on|filing date/i.test(content);
  if (!hasFilingDate) {
    missingElements.push("Filing date");
    suggestedActions.push("Verify document shows filing date");
  }
  
  // Check for state seal
  // const hasStateSeal = /official seal|seal of the state|great seal/i.test(content) || 
  //                     contentLower.includes("seal") && 
  //                     (contentLower.includes("affixed") || 
  //                      contentLower.includes("testimony") || 
  //                      contentLower.includes("whereof"));
  
  // if (!hasStateSeal) {
  //   missingElements.push("NJ State Seal");
  //   suggestedActions.push("Verify document contains the NJ state seal");
  // }
  
  // Check for signature of state official
  const hasSignature = /signature|signed|authorized representative/i.test(content) ||
                      /state treasurer|treasurer/i.test(content);
  
  if (!hasSignature) {
    missingElements.push("Signature of authorized state official");
    suggestedActions.push("Verify document has been signed by an authorized state official");
  }
  
  // Check for verification info
  const hasVerificationInfo = /verify this certificate|verification|certification/i.test(content);
  
  if (!hasVerificationInfo) {
    missingElements.push("Certificate verification information");
    suggestedActions.push("Verify document contains certificate verification information");
  }
  
  // Check for key sections that should be in a certificate of formation
  const requiredSections = [
    { name: "Registered agent", regex: /registered\s+agent/i },
    { name: "Registered office", regex: /registered\s+office/i }
  ];
  
  for (const section of requiredSections) {
    if (!section.regex.test(content)) {
      missingElements.push(`${section.name} section`);
      suggestedActions.push(`Verify document contains ${section.name.toLowerCase()} information`);
    }
  }
  
  return { 
    missingElements, 
    suggestedActions,
    detectedOrganizationName
  };
}

// Validation for Certificate of Good Standing (Long Form)
function validateCertificateOfGoodStandingLong(content, contentLower, pages, keyValuePairs, formFields) {
  const missingElements = [];
  const suggestedActions = [];
  let detectedOrganizationName = null;
  
  // Extract organization name - look for the line after "LONG FORM STANDING WITH OFFICERS AND DIRECTORS"
  const lines = content.split('\n');
  const longFormIndex = lines.findIndex(line => 
    line.includes("LONG FORM STANDING WITH OFFICERS AND DIRECTORS") || 
    line.includes("Long Form Standing with Officers and Directors")
  );
  
  // If we found the header, organization name should be the next non-empty line
  if (longFormIndex !== -1 && longFormIndex + 1 < lines.length) {
    for (let i = longFormIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length > 3) {
        detectedOrganizationName = line;
        break;
      }
    }
  }
  
  // Check for organization name match if provided
  if (formFields.organizationName && detectedOrganizationName) {
    const orgNameLower = formFields.organizationName.toLowerCase().trim();
    const detectedOrgNameLower = detectedOrganizationName.toLowerCase().trim();
    
    if (!detectedOrgNameLower.includes(orgNameLower) && !orgNameLower.includes(detectedOrgNameLower)) {
      missingElements.push("Organization name doesn't match the one on the certificate");
      suggestedActions.push("Verify that the correct organization name was entered");
    }
  }
  
  // Rest of validation checks remain the same
  const hasLongFormTitle = contentLower.includes("long form standing") || 
                          contentLower.includes("long form certificate") ||
                          contentLower.includes("with officers and directors");
  
  if (!hasLongFormTitle) {
    missingElements.push("Long Form Standing declaration");
    suggestedActions.push("Verify this is a Long Form Certificate of Good Standing with Officers and Directors");
  }
  
  const hasGoodStanding = contentLower.includes("good standing") && 
                          contentLower.includes("active");
  
  if (!hasGoodStanding) {
    missingElements.push("Active and good standing status");
    suggestedActions.push("Verify entity is active and in good standing with the State of NJ");
  }
  
  const hasTreasury = contentLower.includes("department of treasury") || 
                     contentLower.includes("dept. of treasury") ||
                     contentLower.includes("dept of treasury") ||
                     contentLower.includes("treasurer of the state");
  
  if (!hasTreasury) {
    missingElements.push("Department of Treasury reference");
    suggestedActions.push("Verify certificate is issued by NJ Department of Treasury");
  }
  
  const hasDivision = contentLower.includes("division of revenue & enterprise services") || 
                     contentLower.includes("division of revenue and enterprise services");
  
  if (!hasDivision) {
    missingElements.push("Division of Revenue & Enterprise Services");
    suggestedActions.push("Verify certificate mentions Division of Revenue & Enterprise Services");
  }
  
  const hasOfficersDirectors = contentLower.includes("officers") && 
                              contentLower.includes("directors");
                              
  if (!hasOfficersDirectors) {
    missingElements.push("Officers/Directors information");
    suggestedActions.push("Verify the certificate includes information about officers and directors");
  }
  
  const hasRegisteredInfo = contentLower.includes("registered agent") || 
                           contentLower.includes("registered office");
  
  if (!hasRegisteredInfo) {
    missingElements.push("Registered agent/office information");
    suggestedActions.push("Verify the certificate includes registered agent and office information");
  }
  
  const hasStateSeal = contentLower.includes("official seal") || 
                      contentLower.includes("seal at trenton") ||
                      contentLower.includes("great seal") || 
                      contentLower.includes("testimony whereof");
  
  if (!hasStateSeal) {
    missingElements.push("State seal");
    suggestedActions.push("Verify the certificate has the State seal affixed");
  }
  
  const hasTreasurerSignature = contentLower.includes("state treasurer") || 
                               contentLower.includes("acting state treasurer") ||
                               contentLower.includes("treasurer of the state");
  
  if (!hasTreasurerSignature) {
    missingElements.push("State Treasurer signature");
    suggestedActions.push("Verify the certificate is signed by the State Treasurer");
  }
  
  const hasCertificateNumber = content.match(/certificate\s+number|cert\.\s*no\./i);
  
  if (!hasCertificateNumber) {
    missingElements.push("Certificate number");
    suggestedActions.push("Verify the certificate has a certificate number");
  }
  
  const hasVerificationURL = contentLower.includes("verify this certificate") || 
                            contentLower.includes("http") ||
                            contentLower.includes("www");
  
  if (!hasVerificationURL) {
    missingElements.push("Verification URL");
    suggestedActions.push("Verify the certificate includes a verification URL");
  }
  
  return { 
    missingElements, 
    suggestedActions,
    detectedOrganizationName
  };
}

// Validation for Certificate of Good Standing (Short Form)
function validateCertificateOfGoodStandingShort(content, contentLower, pages, keyValuePairs, formFields) {
  const missingElements = [];
  const suggestedActions = [];
  let detectedOrganizationName = null;
  
  const hasGoodStanding = contentLower.includes("good standing") && 
                          contentLower.includes("active");
  
  if (!hasGoodStanding) {
    missingElements.push("Active and good standing status");
    suggestedActions.push("Verify entity is active and in good standing with the State of NJ");
  }
  
  const hasTreasury = contentLower.includes("department of treasury") || 
                     contentLower.includes("dept. of treasury") ||
                     contentLower.includes("dept of treasury") ||
                     contentLower.includes("treasurer of the state");
  
  if (!hasTreasury) {
    missingElements.push("Department of Treasury reference");
    suggestedActions.push("Verify certificate is issued by NJ Department of Treasury");
  }
  
  const hasDivision = contentLower.includes("division of revenue & enterprise services") || 
                     contentLower.includes("division of revenue and enterprise services");
  
  if (!hasDivision) {
    missingElements.push("Division of Revenue & Enterprise Services");
    suggestedActions.push("Verify certificate mentions Division of Revenue & Enterprise Services");
  }
  
  const hasStateSeal = contentLower.includes("official seal") || 
                      contentLower.includes("seal at trenton") ||
                      contentLower.includes("great seal") || 
                      contentLower.includes("testimony whereof");
  
  if (!hasStateSeal) {
    missingElements.push("State seal");
    suggestedActions.push("Verify the certificate has the State seal affixed");
  }
  
  const hasTreasurerSignature = contentLower.includes("state treasurer") || 
                               contentLower.includes("acting state treasurer") ||
                               contentLower.includes("treasurer of the state");
  
  if (!hasTreasurerSignature) {
    missingElements.push("State Treasurer signature");
    suggestedActions.push("Verify the certificate is signed by the State Treasurer");
  }
  
  return { 
    missingElements, 
    suggestedActions,
    detectedOrganizationName
  };
}

// Validation for Operating Agreement
function validateOperatingAgreement(content, contentLower, pages, keyValuePairs, formFields) {
  const missingElements = [];
  const suggestedActions = [];
  
  // Check for required elements
  if (!contentLower.includes("operating agreement")) {
    missingElements.push("Required text: 'Operating Agreement'");
  }
  
  // Check for signatures
  const hasSignatures = contentLower.includes("signature") || 
                       contentLower.includes("signed by") || 
                       contentLower.includes("undersigned") ||
                       /s\/?\/|_+\s*name/i.test(content);
  
  if (!hasSignatures) {
    missingElements.push("Member signatures");
    suggestedActions.push("Verify the operating agreement is signed by all members");
  }
  
  // Check for date
  const hasDate = /date[d]?(\s*on)?:|dated|executed on/i.test(content) || 
                 /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(content) ||
                 /\d{4}/.test(content);
  
  if (!hasDate) {
    missingElements.push("Date");
    suggestedActions.push("Verify the operating agreement is dated");
  }
  
  // Check for LLC formation language
  const hasFormationLanguage = contentLower.includes("certificate of formation") || 
                              contentLower.includes("articles of organization") || 
                              (contentLower.includes("form") && contentLower.includes("limited liability company"));
  
  if (!hasFormationLanguage) {
    missingElements.push("LLC formation language");
    suggestedActions.push("Verify the agreement contains references to LLC formation documents");
  }
  
  // Check for business purpose section
  const hasBusinessPurpose = contentLower.includes("business purpose") && 
                            (contentLower.includes("purpose of the company") || 
                             contentLower.match(/purpose.*is/i));
  
  if (!hasBusinessPurpose) {
    missingElements.push("Business purpose section");
    suggestedActions.push("Verify the agreement defines a business purpose");
  }
  
  // Check for New Jersey reference
  const hasNewJersey = contentLower.includes("new jersey") || 
                      contentLower.includes("nj");
  
  if (!hasNewJersey) {
    missingElements.push("New Jersey state reference");
    suggestedActions.push("Verify the agreement references New Jersey state law");
  }
  
  return { 
    missingElements, 
    suggestedActions
  };
}

// Validation for Certificate of Incorporation
function validateCertificateOfIncorporation(content, contentLower, pages, keyValuePairs, formFields) {
  const missingElements = [];
  const suggestedActions = [];
  const detectedOrganizationName = null;
  
  // Check for required elements in the document
  // 1. Check for Certificate title
  const hasCertificateTitle = contentLower.includes("certificate of inc") || 
                             contentLower.includes("certificate of incorporation");
  
  if (!hasCertificateTitle) {
    missingElements.push("Required text: 'Certificate of Incorporation'");
  }
  
  // 2. Check for NJ Department of Treasury
  const hasTreasury = contentLower.includes("new jersey department of the treasury") || 
                     contentLower.includes("nj department of the treasury");
  
  if (!hasTreasury) {
    missingElements.push("New Jersey Department of the Treasury");
    suggestedActions.push("Verify certificate is issued by the NJ Department of Treasury");
  }
  
  // 3. Check for Division of Revenue & Enterprise Services
  const hasDivision = contentLower.includes("division of revenue and enterprise services") || 
                     contentLower.includes("division of revenue & enterprise services");
  
  if (!hasDivision) {
    missingElements.push("Division of Revenue & Enterprise Services");
    suggestedActions.push("Verify certificate mentions Division of Revenue & Enterprise Services");
  }
  
  // 4. Check for Board of Directors listing
  const hasDirectors = contentLower.includes("board of directors") || 
                      contentLower.includes("directors:");
  
  if (!hasDirectors) {
    missingElements.push("Board of Directors listing");
    suggestedActions.push("Verify the certificate lists the Board of Directors");
  }
  
  // 5. Check for Incorporators section
  const hasIncorporators = contentLower.includes("incorporators:") || 
                          contentLower.includes("incorporator");
  
  if (!hasIncorporators) {
    missingElements.push("Incorporators section");
    suggestedActions.push("Verify the certificate lists the Incorporators");
  }
  
  // 6. Check for state seal
  const hasStateSeal = contentLower.includes("official seal") || 
                      contentLower.includes("seal at trenton") ||
                      contentLower.includes("testimony whereof") ||
                      (contentLower.includes("seal") && contentLower.includes("affixed"));
  
  if (!hasStateSeal) {
    missingElements.push("State seal");
    suggestedActions.push("Verify the certificate has the State seal affixed");
  }
  
  return { 
    missingElements, 
    suggestedActions,
    detectedOrganizationName
  };
}

// Validation for IRS Determination Letter
function validateIRSDeterminationLetter(content, contentLower, pages, keyValuePairs) {
  const missingElements = [];
  const suggestedActions = [];
  
  // Check for IRS letterhead
  const hasIRSLetterhead = contentLower.includes("internal revenue service") || 
                          contentLower.includes("department of the treasury");
  
  if (!hasIRSLetterhead) {
    missingElements.push("IRS letterhead");
    suggestedActions.push("Verify the letter is on IRS letterhead showing 'Internal Revenue Service'");
  }
  
  // Check for Employer Identification Number (EIN/FEIN)
  const hasEIN = contentLower.includes("employer identification number") || 
                contentLower.match(/ein\s*:/i);
  
  if (!hasEIN) {
    missingElements.push("Employer Identification Number (EIN)");
    suggestedActions.push("Verify the letter includes an Employer Identification Number");
  }
  
  // Check for Contact Person information
  const hasContactPerson = contentLower.includes("person to contact") || 
                          contentLower.includes("contact telephone");
  
  if (!hasContactPerson) {
    missingElements.push("Contact person information");
    suggestedActions.push("Verify the letter includes contact person details");
  }
  
  // Check for 'favorable determination' language
  // const hasFavorableDetermination = contentLower.includes("favorable determination") || 
  //                                  contentLower.includes("we are issuing this favorable");
  
  // if (!hasFavorableDetermination) {
  //   missingElements.push("Favorable determination statement");
  //   suggestedActions.push("Verify the letter explicitly states it is a favorable determination");
  // }
  
  // Check for Director's signature
  // const hasDirectorSignature = contentLower.includes("director") ||
  //                             contentLower.includes("sincerely");
  
  // if (!hasDirectorSignature) {
  //   missingElements.push("Director's signature");
  //   suggestedActions.push("Verify the letter contains the signature of an IRS Director/official");
  // }
  
  // Check for amendments information (specific to this type of letter)
  // const hasAmendmentsInfo = contentLower.includes("amendments dated");
  
  // if (!hasAmendmentsInfo) {
  //   missingElements.push("Amendments information");
  //   suggestedActions.push("Verify the letter references specific plan amendments");
  // }
  
  return { 
    missingElements, 
    suggestedActions
  };
}

// Validation for By-laws
function validateBylaws(content, contentLower, pages, keyValuePairs) {
  const missingElements = [];
  const suggestedActions = [];
  
  // Check for required elements
  if (!contentLower.includes("bylaws") && !contentLower.includes("by-laws")) {
    missingElements.push("Required text: 'Bylaws' or 'By-laws'");
  }
  
  // Check for New Jersey-specific language
  const hasNJReference = contentLower.includes("new jersey") ||
                        contentLower.includes("new jersey business corporation act") ||
                        contentLower.includes("department of the treasury");
  
  if (!hasNJReference) {
    missingElements.push("New Jersey state references");
    suggestedActions.push("Verify the bylaws reference New Jersey state law");
  }
  
  // Check for key sections typically found in bylaws
  const requiredSections = [
    { name: "Board of Directors", regex: /board of directors|directors/i },
    { name: "Meetings section", regex: /meeting[s]?|annual meeting/i },
    { name: "Amendments section", regex: /amendment[s]?|amend/i },
    { name: "Corporate formation", regex: /formation|organization|incorporate/i },
    { name: "Shareholders", regex: /shareholder[s]?|stockholder[s]?/i },
    { name: "Capital/Stock", regex: /capital|stock|shares/i },
    { name: "Books and Records", regex: /books and records|corporate records/i }
  ];
  
  for (const section of requiredSections) {
    if (!section.regex.test(content)) {
      missingElements.push(`${section.name}`);
      suggestedActions.push(`Verify bylaws contain a ${section.name.toLowerCase()} section`);
    }
  }
  
  // Check for specific corporate compliance elements
  const complianceElements = [
    { name: "Director duties", regex: /director.{1,30}(duties|responsibilities|liability)/i },
    { name: "Voting procedures", regex: /vot(e|ing)/i },
    { name: "Corporate seal", regex: /corporate seal/i }
  ];
  
  for (const element of complianceElements) {
    if (!element.regex.test(content)) {
      missingElements.push(`${element.name}`);
      suggestedActions.push(`Verify bylaws address ${element.name.toLowerCase()}`);
    }
  }
  
  // Check for page numbering
  const hasPageNumbering = /page\s+\d+\s+of\s+\d+/i.test(content);
  
  if (!hasPageNumbering) {
    missingElements.push("Page numbering");
    suggestedActions.push("Verify bylaws include proper page numbering (e.g., 'Page X of Y')");
  }
  
  // Check for statutory references
  const hasStatutoryReferences = content.match(/\d+a:\d+-\d+/i) || // NJ format 14A:X-X
                                content.match(/section\s+\d+a:/i);
  
  if (!hasStatutoryReferences) {
    missingElements.push("New Jersey statutory references");
    suggestedActions.push("Verify bylaws reference specific sections of the New Jersey Business Corporation Act");
  }
  
  return { 
    missingElements, 
    suggestedActions
  };
}

// Validation for Certificate of Authority
function validateCertificateOfAuthority(content, contentLower, pages, keyValuePairs, formFields) {
  const missingElements = [];
  const suggestedActions = [];
  
  // Check for required elements
  if (!contentLower.includes("certificate of authority")) {
    missingElements.push("Required text: 'Certificate of Authority'");
  }
  
  // Check for state seal and watermark
  const hasStateSeal = contentLower.includes("state seal") || 
                      contentLower.includes("great seal") || 
                      contentLower.includes("state of new jersey");
  
  if (!hasStateSeal) {
    missingElements.push("State seal");
    suggestedActions.push("Verify the certificate contains the state seal");
  }
  
  // Check for watermark
  const hasWatermark = contentLower.includes("watermark") || 
                      contentLower.includes("official document");
  
  if (!hasWatermark) {
    missingElements.push("Watermark in the background");
    suggestedActions.push("Verify the certificate has a watermark in the background");
  }
  
  // Check for issuance date
  const hasIssuanceDate = /date[d]?(\s*on)?:|dated|issuance date|issued on/i.test(content) || 
                          /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(content);
  
  if (!hasIssuanceDate) {
    missingElements.push("Issuance date");
    suggestedActions.push("Verify the certificate includes an issuance date");
  }
  
  return { 
    missingElements, 
    suggestedActions
  };
}

// Validation for Certificate of Authority - Automatic
function validateCertificateOfAuthorityAutomatic(content, contentLower, pages, keyValuePairs) {
  const missingElements = [];
  const suggestedActions = [];
  
  // Check for required elements
  if (!contentLower.includes("certificate of authority")) {
    missingElements.push("Required text: 'Certificate of Authority'");
  }
  
  // Check for state seal
  const hasStateSeal = contentLower.includes("state seal") || 
                      contentLower.includes("great seal") || 
                      contentLower.includes("state of new jersey");
  
  if (!hasStateSeal) {
    missingElements.push("State seal");
    suggestedActions.push("Verify the certificate contains the state seal");
  }
  
  // Check for applicant's name
  const hasApplicantName = keyValuePairs.some(pair => 
    pair.key && pair.key.content && 
    (pair.key.content.toLowerCase().includes('name') || 
     pair.key.content.toLowerCase().includes('entity'))
  );
  
  if (!hasApplicantName) {
    missingElements.push("Applicant's name");
    suggestedActions.push("Verify the certificate includes the applicant's name");
  }
  
  // Check for issuance date
  const hasIssuanceDate = /date[d]?(\s*on)?:|dated|issuance date|issued on/i.test(content) || 
                          /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(content);
  
  if (!hasIssuanceDate) {
    missingElements.push("Issuance date");
    suggestedActions.push("Verify the certificate includes an issuance date");
  }
  
  return { 
    missingElements, 
    suggestedActions
  };
}

// Helper function to check if a date in the document is within the last 6 months
function checkDateWithinSixMonths(content) {
  // Early exit if content is too short
  if (!content || content.length < 10) return false;

  const now = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(now.getMonth() - 6);
  
  // Match numeric date formats like MM/DD/YYYY or DD/MM/YYYY - limit the number of matches to improve performance
  const numericDateRegex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g;
  const numericDateMatches = Array.from(content.matchAll(numericDateRegex)).slice(0, 10); // Limit to first 10 matches

  // Check numeric dates
  for (const match of numericDateMatches) {
    const parts = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];

    // Try MM/DD/YYYY
    let dateMMDDYYYY = new Date(parts[2], parts[0] - 1, parts[1]);
    // Try DD/MM/YYYY
    let dateDDMMYYYY = new Date(parts[2], parts[1] - 1, parts[0]);

    if (
      (dateMMDDYYYY instanceof Date &&
        !isNaN(dateMMDDYYYY) &&
        dateMMDDYYYY >= sixMonthsAgo &&
        dateMMDDYYYY <= now) ||
      (dateDDMMYYYY instanceof Date &&
        !isNaN(dateDDMMYYYY) &&
        dateDDMMYYYY >= sixMonthsAgo &&
        dateDDMMYYYY <= now)
    ) {
      return true;
    }
  }

  // Match written date formats like "January 15, 2023" or "15 January 2023"
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthPattern = monthNames.join('|');
  const writtenDateRegex = new RegExp(`(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?[,\\s]+?(\\d{4})|(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})[,\\s]+?(\\d{4})`, 'gi');
  const writtenDateMatches = Array.from(content.matchAll(writtenDateRegex)).slice(0, 10); // Limit to first 10 matches

  // Check written dates
  for (const match of writtenDateMatches) {
    let month, day, year;
    
    // Format: "January 15, 2023"
    if (match[1]) {
      month = monthNames.indexOf(match[1].toLowerCase());
      day = parseInt(match[2]);
      year = parseInt(match[3]);
    } 
    // Format: "15 January 2023"
    else {
      day = parseInt(match[4]);
      month = monthNames.indexOf(match[5].toLowerCase());
      year = parseInt(match[6]);
    }

    if (month !== -1) {
      const date = new Date(year, month, day);
      if (
        date instanceof Date &&
        !isNaN(date) &&
        date >= sixMonthsAgo &&
        date <= now
      ) {
        return true;
      }
    }
  }

  // Format: "13th day of May, 2023"
  const ordinalDateRegex = /(\d{1,2})(st|nd|rd|th)? day of (\w+),\s*(\d{4})/gi;
  const ordinalMatches = Array.from(content.matchAll(ordinalDateRegex)).slice(0, 5); // Limit to first 5 matches
  
  for (const ordinalMatch of ordinalMatches) {
    let day = parseInt(ordinalMatch[1]);
    let month = monthNames.indexOf(ordinalMatch[3].toLowerCase());
    let year = parseInt(ordinalMatch[4]);

    if (month !== -1) {
      const date = new Date(year, month, day);
      if (
        date instanceof Date &&
        !isNaN(date) &&
        date >= sixMonthsAgo &&
        date <= now
      ) {
        return true;
      }
    }
  }

  return false;
}

// Validation for Certificate of Trade Name
function validateCertificateOfTradeName(content, contentLower, pages, keyValuePairs) {
  const missingElements = [];
  const suggestedActions = [];
  
  // Check for required elements
  if (!contentLower.includes("certificate of trade name")) {
    missingElements.push("Required text: 'Certificate of Trade Name'");
  }
  
  // Check for N.J.S.A. statute reference
  // const hasNJSAStatute = content.includes("N.J.S.A.");
  // if (!hasNJSAStatute) {
  //   missingElements.push("N.J.S.A. statute reference");
  //   suggestedActions.push("Verify document is the standard Certificate of Trade Name showing N.J.S.A. statute");
  // }
  
  return { 
    missingElements, 
    suggestedActions 
  };
}