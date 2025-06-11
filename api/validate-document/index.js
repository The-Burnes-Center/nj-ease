import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";

// Configuration from environment variables
const endpoint = process.env.DI_ENDPOINT;
const key = process.env.DI_KEY;

// Helper function to normalize organization names for better matching
function normalizeOrganizationName(name) {
  if (!name || typeof name !== 'string') return '';
  
  let normalized = name.toLowerCase().trim();
  
  // Remove common punctuation and extra spaces
  normalized = normalized.replace(/[,\.]/g, '').replace(/\s+/g, ' ').trim();
  
  // Define abbreviation mappings (abbreviation -> full form)
  const abbreviationMap = {
    'llc': 'limited liability company',
    'inc': 'incorporated',
    'corp': 'corporation',
    'co': 'company',
    'ltd': 'limited',
    'lp': 'limited partnership',
    'llp': 'limited liability partnership',
    'pllc': 'professional limited liability company',
    'pc': 'professional corporation',
    'pa': 'professional association',
    'plc': 'professional limited company'
  };
  
  // Create reverse mapping (full form -> abbreviation)
  const reverseMap = {};
  Object.entries(abbreviationMap).forEach(([abbr, full]) => {
    reverseMap[full] = abbr;
  });
  
  // Replace abbreviations with full forms
  Object.entries(abbreviationMap).forEach(([abbr, full]) => {
    // More robust pattern to ensure we only match actual entity type abbreviations
    // This matches the abbreviation only when it's:
    // 1. At word boundaries (\b)
    // 2. Optionally followed by a period
    // 3. At the end of the string or followed by whitespace/punctuation
    const abbrPattern = new RegExp(`\\b${abbr}\\.?(?=\\s|$|[,;])`, 'gi');
    normalized = normalized.replace(abbrPattern, full);
  });
  
  return normalized;
}

// Helper function to check if two organization names match (accounting for abbreviations)
function organizationNamesMatch(name1, name2) {
  if (!name1 || !name2) return false;
  
  const normalized1 = normalizeOrganizationName(name1);
  const normalized2 = normalizeOrganizationName(name2);
  
  // Direct match after normalization
  if (normalized1 === normalized2) return true;
  
  // Check if one contains the other (for partial matches)
  // But only if they have the same entity type or one doesn't have an entity type
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    // Extract entity types to ensure we're not matching different entity types
    const getEntityType = (name) => {
      const entityTypes = ['limited liability company', 'incorporated', 'corporation', 'company', 'limited', 'limited partnership', 'limited liability partnership', 'professional limited liability company', 'professional corporation', 'professional association', 'professional limited company'];
      for (const entityType of entityTypes) {
        if (name.includes(entityType)) {
          return entityType;
        }
      }
      return null;
    };
    
    const entity1 = getEntityType(normalized1);
    const entity2 = getEntityType(normalized2);
    
    // Allow match only if:
    // 1. Both have the same entity type, or
    // 2. One has no entity type (partial name), or  
    // 3. One is a more specific version of the other (like "company" vs "limited liability company")
    if (entity1 === entity2 || 
        entity1 === null || 
        entity2 === null ||
        (entity1 && entity2 && (entity1.includes(entity2) || entity2.includes(entity1)))) {
      return true;
    }
    
    // Different entity types should not match
    return false;
  }
  
  // More restrictive core business name matching
  // Only do this if the entity types are compatible
  const removeEntitySuffixes = (name) => {
    return name.replace(/\b(limited liability company|incorporated|corporation|company|limited|limited partnership|limited liability partnership|professional limited liability company|professional corporation|professional association|professional limited company)\b/gi, '').trim();
  };
  
  const core1 = removeEntitySuffixes(normalized1);
  const core2 = removeEntitySuffixes(normalized2);
  
  if (core1 && core2 && core1.length > 2 && core2.length > 2 && core1 === core2) {
    // Extract entity types to ensure compatibility
    const getEntityType = (name) => {
      const entityTypes = ['limited liability company', 'incorporated', 'corporation', 'company', 'limited', 'limited partnership', 'limited liability partnership', 'professional limited liability company', 'professional corporation', 'professional association', 'professional limited company'];
      for (const entityType of entityTypes) {
        if (name.includes(entityType)) {
          return entityType;
        }
      }
      return null;
    };
    
    const entity1 = getEntityType(normalized1);
    const entity2 = getEntityType(normalized2);
    
    // Only match core names if entity types are the same or compatible
    if (entity1 === entity2 || 
        entity1 === null || 
        entity2 === null ||
        // Allow some compatible entity types (these are variations of similar concepts)
        (entity1 === 'corporation' && entity2 === 'incorporated') ||
        (entity1 === 'incorporated' && entity2 === 'corporation') ||
        (entity1 === 'company' && entity2 === 'corporation') ||
        (entity1 === 'corporation' && entity2 === 'company')) {
      return true;
    }
  }
  
  return false;
}

function validateDocumentByType(options) {
  const { documentType, content, contentLower, pages, languages, styles, tables, keyValuePairs, entities, formFields } = options;
  
  switch(documentType) {
    case 'tax-clearance-online':
      return validateTaxClearanceOnline(content, contentLower, pages, keyValuePairs, formFields);
    case 'tax-clearance-manual':
      return validateTaxClearanceManual(content, contentLower, pages, keyValuePairs, formFields);
    case 'cert-alternative-name':
      return validateCertificateAlternativeName(content, contentLower, pages, keyValuePairs, formFields);
    case 'cert-trade-name':
      return validateCertificateOfTradeName(content, contentLower, pages, keyValuePairs);
    case 'cert-formation':
      return validateCertificateOfFormation(content, contentLower, pages, keyValuePairs, formFields);
    case 'cert-formation-independent':
      return validateCertificateOfFormationIndependent(content, contentLower, pages, keyValuePairs, formFields);
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
    if (!organizationNamesMatch(formFields.organizationName, detectedOrganizationName)) {
      missingElements.push("Organization name doesn't match the one on the certificate");
      suggestedActions.push("Verify that the correct organization name was entered");
    }
  }
  
  // Check for required keywords
  if (!contentLower.includes("clearance certificate")) {
    missingElements.push("Required keyword: 'Clearance Certificate'");
  }
  
  // Check for Serial#
  const hasSerial = contentLower.includes("serial#") || 
                   contentLower.includes("serial #") ||
                   contentLower.includes("serial number") ||
                   content.match(/serial[\s#]*:?\s*\d+/i);
                   
  if (!hasSerial) {
    missingElements.push("Serial Number is missing");
    suggestedActions.push("Verify this is an online-generated certificate with a Serial Number");
  }
  
  // Check for State of New Jersey
  if (!contentLower.includes("state of new jersey") && 
      !contentLower.includes("new jersey")) {
    missingElements.push("Required keyword: 'State of New Jersey'");
  }
  
  // Check for Department of Treasury
  if (!contentLower.includes("department of the treasury")) {
    missingElements.push("Required keyword: Department of the Treasury");
  }
  
  // Check for Division of Taxation
  if (!contentLower.includes("division of taxation")) {
    missingElements.push("Required keyword: Division of Taxation");
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
    missingElements.push("Tax Clearance Certificate is issued by the Department of Environmental Protection");
    suggestedActions.push("This agency is not accepted. Please provide a valid tax clearance certificate from a different agency");
  }
  
  // Check for date within 6 months
  const isDateWithinSixMonths = checkDateWithinSixMonths(content);
  if (!isDateWithinSixMonths) {
    missingElements.push("Certificate must be dated within the past six months");
    suggestedActions.push("Obtain a more recent tax clearance certificate");
  }
  
  // Check for signature
  const hasSignature = content.includes("Acting Director") ||
                       content.match(/Marita\s+R\.\s+Sciarrotta|John\s+J\.\s+Ficara/i);
  
  if (!hasSignature) {
    missingElements.push("Signature is missing");
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
    if (!organizationNamesMatch(formFields.organizationName, detectedOrganizationName)) {
      missingElements.push("Organization name doesn't match the one on the certificate");
      suggestedActions.push("Verify that the correct organization name was entered");
    }
  }
  
  // Check for required keywords
  if (!contentLower.includes("clearance certificate")) {
    missingElements.push("Required keyword: 'Clearance Certificate'");
  }
  
  // Check for State of New Jersey
  if (!contentLower.includes("state of new jersey")) {
    missingElements.push("Required keyword: 'State of New Jersey'");
  }

  // Check for BATC Manual indication - this is a REQUIRED check for manual certificates
  if (!contentLower.includes("batc") && !contentLower.includes("manual")) {
    missingElements.push("Required keyword: 'BATC - Manual'");
    suggestedActions.push("Verify this is a manually generated tax clearance certificate");
  }
  
  // Check for Department of Treasury
  if (!contentLower.includes("department of the treasury")) {
    missingElements.push("Required keyword: Department of the Treasury");
  }
  
  // Check for Division of Taxation
  if (!contentLower.includes("division of taxation")) {
    missingElements.push("Required keyword: Division of Taxation");
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
    missingElements.push("Tax Clearance Certificate is issued by the Department of Environmental Protection");
    suggestedActions.push("This agency is not accepted. Please provide a valid tax clearance certificate from a different agency");
  }
  
  // Check for date within 6 months
  const isDateWithinSixMonths = checkDateWithinSixMonths(content);
  if (!isDateWithinSixMonths) {
    missingElements.push("Certificate must be dated within the past six months");
    suggestedActions.push("Obtain a more recent tax clearance certificate");
  }
  
  // Check for signature
  const hasSignature = content.includes("Acting Director") || 
                       content.includes("Director of Taxation") ||
                       content.match(/Marita\s+R\.\s+Sciarrotta|John\s+J\.\s+Ficara/i);
  
  if (!hasSignature) {
    missingElements.push("Signature is missing");
    suggestedActions.push("Verify the certificate has been signed by an authorized official");
  }

  return {
    missingElements, 
    suggestedActions,
    detectedOrganizationName
  };
}

// Validation for Certificate of Alternative Name
function validateCertificateAlternativeName(content, contentLower, pages, keyValuePairs, formFields) {
  const missingElements = [];
  const suggestedActions = [];
  let detectedOrganizationName = null;
  
  // Check for required elements and extract organization name
  const hasCertificateKeyword = contentLower.includes("certificate of alternate name") || contentLower.includes("certificate of renewal of alternate name") || contentLower.includes("registration of alternate name");
  
  if (!hasCertificateKeyword) {
    missingElements.push("Required keyword: 'Certificate of Alternate Name'");
  } else {
    // Find the organization name that appears after the certificate keywords
    let certIndex = -1;
    let certKeyword = "";
    
    if (contentLower.includes("certificate of alternate name")) {
      certIndex = contentLower.indexOf("certificate of alternate name");
      certKeyword = "certificate of alternate name";
    } else if (contentLower.includes("certificate of renewal of alternate name")) {
      certIndex = contentLower.indexOf("certificate of renewal of alternate name");
      certKeyword = "certificate of renewal of alternate name";
    } else if (contentLower.includes("name of corporation/business:")) {
      certIndex = contentLower.indexOf("name of corporation/business:");
      certKeyword = "name of corporation/business:";
    }
    
    if (certIndex !== -1) {
      // Get the text after the certificate keyword
      const textAfterCert = content.substring(certIndex + certKeyword.length);
      
      // Split into lines and find the organization name
      const lines = textAfterCert.split('\n');
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i].trim();
        // Skip empty lines, dates, or lines with less than 3 characters
        if (line && line.length > 3 && !line.match(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/)) {
          // Skip lines that have typical headers or metadata
          if (!line.toLowerCase().includes("state of") && 
              !line.toLowerCase().includes("department of") &&
              !line.toLowerCase().includes("division of") &&
              !line.toLowerCase().includes("new jersey") &&
              !line.toLowerCase().includes("treasury") &&
              !line.toLowerCase().includes("revenue")) {
            detectedOrganizationName = line;
            // If it's all caps or has business entity indicators, it's very likely the org name
            if ((line === line.toUpperCase() && line.length > 5) || 
                /LLC|INC|CORP|CORPORATION|COMPANY|LP|LLP/i.test(line)) {
              break;  // We're confident this is the org name
            }
          }
        }
      }
    }
  }
  
  // Check for organization name match if provided
  if (formFields && formFields.organizationName && detectedOrganizationName) {
    if (!organizationNamesMatch(formFields.organizationName, detectedOrganizationName)) {
      missingElements.push("Organization name doesn't match the one on the certificate");
      suggestedActions.push(`Verify that the correct organization name was entered. Certificate shows: "${detectedOrganizationName}"`);
    }
  }

  // Check for Division of Revenue in the top center
  const hasDivisionOfRevenue = contentLower.includes("division of revenue");
  if (!hasDivisionOfRevenue) {
    missingElements.push("Required keyword: 'Division of Revenue'");
    suggestedActions.push("Verify document has been issued by the Division of Revenue");
  }
  
  // Check for date stamp by Dept. of Treasury
  const hasTreasuryDateStamp = contentLower.includes("state treasurer") ||contentLower.includes("great seal") || contentLower.includes("seal at trenton");
  
  if (!hasTreasuryDateStamp) {
    missingElements.push("Date stamp by Department of Treasury is missing");
    suggestedActions.push("Verify document has been properly stamped by the Department of Treasury");
  }

  return { 
    missingElements, 
    suggestedActions,
    detectedOrganizationName
  };
}

// Validation for Certificate of Formation
function validateCertificateOfFormation(content, contentLower, pages, keyValuePairs, formFields) {
  const missingElements = [];
  const suggestedActions = [];
  let detectedOrganizationName = null;

  // Look for organization name after specific phrases
  const searchPhrases = [
    "certificate of formation",
    "short form standing",
    "long form standing with officers and directors",
    "name of domestic corporation:",
    "name:",
    "above-named",
    "entity name"
  ];
  
  let foundIndex = -1;
  let foundPhraseLength = 0;
  
  // Find which phrase exists in the content
  for (const phrase of searchPhrases) {
    const index = contentLower.indexOf(phrase);
    if (index !== -1) {
      foundIndex = index;
      foundPhraseLength = phrase.length;
      break;
    }
  }
  
  if (foundIndex !== -1) {
    // Get the text after the found phrase
    const textAfterPhrase = content.substring(foundIndex + foundPhraseLength);
    
    // Split into lines and find the organization name
    const lines = textAfterPhrase.split('\n');
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      // Skip empty lines or lines with less than 3 characters
      if (line && line.length > 3 && !line.match(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/)) {
        // Skip lines that have typical metadata
        if (!line.toLowerCase().includes("short form standing") && 
            !line.toLowerCase().includes("long form standing") &&
            !line.toLowerCase().includes("new jersey department") &&
            !line.toLowerCase().includes("date filed") &&
            !line.toLowerCase().includes("state of") &&
            !line.toLowerCase().includes("department of") &&
            !line.toLowerCase().includes("division of") &&
            !line.toLowerCase().includes("treasury")) {
          detectedOrganizationName = line;
          // If it's all caps or has business entity indicators, it's very likely the org name
          if ((line === line.toUpperCase() && line.length > 5) || 
              /LLC|INC|CORP|CORPORATION|COMPANY|LP|LLP/i.test(line)) {
            break;  // We're confident this is the org name
          }
        }
      }
    }
  }
  
  // Fallback: Try traditional methods if the advanced logic didn't find anything
  if (!detectedOrganizationName) {
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
  }
  
  // Check for organization name match if provided
  if (formFields.organizationName && detectedOrganizationName) {
    if (!organizationNamesMatch(formFields.organizationName, detectedOrganizationName)) {
      missingElements.push("Organization name doesn't match the one on the certificate");
      suggestedActions.push("Verify that the correct organization name was entered");
    }
  }
  
  // Check for required elements
  if (!contentLower.includes("certificate of formation") && !contentLower.includes("short form standing") && !contentLower.includes("long form standing")) {
    missingElements.push("Required keyword: 'Certificate of Formation'");
  }
  
  // Check for NJ Department/Treasury references
  if (!contentLower.includes("new jersey department of the treasury") && 
      !contentLower.includes("new jersey") &&
      !contentLower.includes("division of revenue")) {
    missingElements.push("Certificate is not issued by the NJ Department of the Treasury");
    suggestedActions.push("Verify certificate is issued by the NJ Department of the Treasury");
  }
  
  // Check for signature of state official
  const hasSignature = /signature|signed|authorized representative/i.test(content) ||
                      /state treasurer|organizer|treasurer/i.test(content);
  
  if (!hasSignature) {
    missingElements.push("Signature of authorized state official is missing");
    suggestedActions.push("Verify document has been signed by an authorized state official");
  }

  // Check for presence of any date
  const hasDate = checkForDatePresence(content);
  if (!hasDate) {
    missingElements.push("Document must contain a date");
    suggestedActions.push("Verify that the document includes a stamped date");
  }
  
  // Check for verification info
  const hasVerificationInfo = /verify this certificate|verification|certification/i.test(content);
  
  if (!hasVerificationInfo) {
    missingElements.push("Certificate verification information is missing");
    suggestedActions.push("Verify document contains certificate verification information");
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
    if (!organizationNamesMatch(formFields.organizationName, detectedOrganizationName)) {
      missingElements.push("Organization name doesn't match the one on the certificate");
      suggestedActions.push("Verify that the correct organization name was entered");
    }
  }

  // Check for FEIN match if provided
  if (formFields.fein && detectedOrganizationName) {
    const feinName = formFields.fein.trim();
    const detectedOrgNameLower = detectedOrganizationName.toLowerCase().trim();
    
    if (!detectedOrgNameLower.includes(feinName) && !feinName.includes(detectedOrgNameLower)) {
      missingElements.push("FEIN (Federal Employer Identification Number) doesn't match the one on the certificate");
      suggestedActions.push("Verify that the correct FEIN was entered");
    }
  }
  
  // Check for required elements
  if (!contentLower.includes("certificate of formation")) {
    missingElements.push("Required keyword: 'Certificate of Formation'");
  }
  
  // Check for stamp
  const hasFilingDate = /filed/i.test(content);
  if (!hasFilingDate) {
    missingElements.push("Required keyword: 'Filed'");
    suggestedActions.push("Verify document is stamped by the Department of the Treasury");
  }
  
  // Check for signature of state official
  const hasSignature = /signature|signed|authorized representative/i.test(content) ||
                      /state treasurer|organizer|treasurer/i.test(content);
  
  if (!hasSignature) {
    missingElements.push("Signature of authorized state official is missing");
    suggestedActions.push("Verify document has been signed by an authorized state official");
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
    missingElements.push("Required keyword: 'Operating Agreement'");
  }
  
  // Check for signatures
  const hasSignatures = contentLower.includes("signature") || 
                       contentLower.includes("signed by") || 
                       contentLower.includes("undersigned") ||
                       /s\/?\/|_+\s*name/i.test(content);
  
  if (!hasSignatures) {
    missingElements.push("Member signatures are missing");
    suggestedActions.push("Verify the operating agreement is signed by all members");
  }
  
  // Check for date
  const hasDate = /date[d]?(\s*on)?:|dated|executed on/i.test(content) || 
                 /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(content) ||
                 /\d{4}/.test(content);
  
  if (!hasDate) {
    missingElements.push("Date is missing");
    suggestedActions.push("Verify the operating agreement is dated");
  }
  
  // Check for New Jersey reference
  const hasNewJersey = contentLower.includes("new jersey") || 
                      contentLower.includes("nj");
  
  if (!hasNewJersey) {
    missingElements.push("New Jersey state reference is missing");
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
  
  // 4. Check for Board of Directors listing
  const hasDirectors = contentLower.includes("board of directors") || 
                      contentLower.includes("directors") || 
                      contentLower.includes("incorporators") ||
                      contentLower.includes("trustees") ||
                      contentLower.includes("shareholders");
  
  if (!hasDirectors) {
    missingElements.push("Board of Directors section is missing");
    suggestedActions.push("Verify the certificate lists the Board of Directors");
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
    missingElements.push("IRS letterhead is missing");
    suggestedActions.push("Verify the letter is on IRS letterhead showing 'Internal Revenue Service'");
  }

  // Check for signature
  const hasSignature = content.includes("Sincerely,") ||
                       content.includes("Director");
  
  if (!hasSignature) {
    missingElements.push("Signature is missing");
    suggestedActions.push("Verify the certificate has been signed by an authorized official");
  }
  
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
  if (!contentLower.includes("bylaws") && !contentLower.includes("by-laws") && !contentLower.includes("by laws")) {
    missingElements.push("Required keyword: 'Bylaws'");
  }
  
  // Check for presence of any date
  const hasDate = checkForDatePresence(content);
  if (!hasDate) {
    missingElements.push("Document must contain a date");
    suggestedActions.push("Verify that the by-laws document includes a date");
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
  let detectedOrganizationName = null;
  
  // Check for required elements
  if (!contentLower.includes("certificate of authority")) {
    missingElements.push("Required keyword: 'Certificate of Authority'");
  }

  // Check for New Jersey-specific language
  const hasNJReference = contentLower.includes("state of new jersey") ||
                        contentLower.includes("new jersey");
  
  if (!hasNJReference) {
    missingElements.push("Required keyword: 'State of New Jersey'");
    suggestedActions.push("Verify the certificate mentions State of New Jersey");
  }
  
  // Check for Division of Taxation
  const hasTaxationOrTreasury = contentLower.includes("division of taxation") || contentLower.includes("department of the treasury");
  
  if (!hasTaxationOrTreasury) {
    missingElements.push("Required keyword: 'Division of Taxation' or 'Department of the Treasury'");
    suggestedActions.push("Verify the certificate is issued by the Division of Taxation or Department of the Treasury");
  }
  
  // Detect organization name
  // Look for organization name after specific phrases
  const searchPhrases = [
    "this authorization is good only for the named person at the location specified herein this authorization is null and void if any change of ownership or address is effected",
    "change in ownership or address.",
    "certificate of authority"
  ];
  
  let foundIndex = -1;
  let foundPhraseLength = 0;
  
  // Find which phrase exists in the content
  for (const phrase of searchPhrases) {
    const index = contentLower.indexOf(phrase);
    if (index !== -1) {
      foundIndex = index;
      foundPhraseLength = phrase.length;
      break;
    }
  }
  
  if (foundIndex !== -1) {
    // Get the text after the found phrase
    const textAfterPhrase = content.substring(foundIndex + foundPhraseLength);
    
    // Split into lines and find the organization name
    const lines = textAfterPhrase.split('\n');
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      // Skip empty lines or lines with less than 3 characters
      if (line && line.length > 3 && !line.match(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/)) {
        // Skip lines that have typical metadata
        if (!line.toLowerCase().includes("tax registration") && 
            !line.toLowerCase().includes("tax effective date") &&
            !line.toLowerCase().includes("document locator") &&
            !line.toLowerCase().includes("date issued") &&
            !line.toLowerCase().includes("state of") &&
            !line.toLowerCase().includes("department of") &&
            !line.toLowerCase().includes("division of")) {
          detectedOrganizationName = line;
          // If it's all caps or has business entity indicators, it's very likely the org name
          if ((line === line.toUpperCase() && line.length > 5) || 
              /LLC|INC|CORP|CORPORATION|COMPANY|LP|LLP/i.test(line)) {
            break;  // We're confident this is the org name
          }
        }
      }
    }
  }
  
  // Check for organization name match if provided
  if (formFields && formFields.organizationName && detectedOrganizationName) {
    if (!organizationNamesMatch(formFields.organizationName, detectedOrganizationName)) {
      missingElements.push("Organization name doesn't match the one on the certificate");
      suggestedActions.push(`Verify that the correct organization name was entered. Certificate shows: "${detectedOrganizationName}"`);
    }
  }
  
  return { 
    missingElements, 
    suggestedActions,
    detectedOrganizationName
  };
}

// Validation for Certificate of Trade Name
function validateCertificateOfTradeName(content, contentLower, pages, keyValuePairs) {
  const missingElements = [];
  const suggestedActions = [];
  
  // Check for required elements
  if (!contentLower.includes("certificate of trade name")) {
    missingElements.push("Required keyword: 'Certificate of Trade Name'");
    suggestedActions.push(`Verify that the document is a Certificate of Trade Name`);
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

// Helper function to check if any date is present in the document
function checkForDatePresence(content) {
  // Early exit if content is too short
  if (!content || content.length < 10) return false;
  
  // Match numeric date formats like MM/DD/YYYY, DD/MM/YYYY, MM-DD-YYYY, etc.
  const numericDateRegex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g;
  const numericDateMatches = content.match(numericDateRegex);
  
  if (numericDateMatches && numericDateMatches.length > 0) {
    // Validate that at least one match looks like a real date
    for (const match of numericDateMatches.slice(0, 10)) { // Check first 10 matches for performance
      const parts = match.split(/[\/\-\.]/);
      const num1 = parseInt(parts[0]);
      const num2 = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      
      // Basic validation: reasonable year and month/day ranges
      if (year >= 1900 && year <= 2100 && 
          num1 >= 1 && num1 <= 31 && 
          num2 >= 1 && num2 <= 31) {
        return true;
      }
    }
  }
  
  // Match written date formats like "January 15, 2023", "15 January 2023", etc.
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthPattern = monthNames.join('|');
  const writtenDateRegex = new RegExp(`(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?[,\\s]*?(\\d{4})|(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})[,\\s]*?(\\d{4})`, 'gi');
  const writtenDateMatches = content.match(writtenDateRegex);
  
  if (writtenDateMatches && writtenDateMatches.length > 0) {
    return true;
  }
  
  // Match ordinal date formats like "13th day of May, 2023"
  const ordinalDateRegex = /(\d{1,2})(st|nd|rd|th)?\s+day\s+of\s+(\w+)[,\s]*(\d{4})/gi;
  const ordinalMatches = content.match(ordinalDateRegex);
  
  if (ordinalMatches && ordinalMatches.length > 0) {
    return true;
  }
  
  // Match year-only formats like "2023" or "©2023" (but be more specific to avoid false positives)
  const yearOnlyRegex = /(?:©\s*|copyright\s*|adopted\s*|effective\s*|revised\s*|amended\s*|dated\s*|year\s*)(\d{4})/gi;
  const yearMatches = content.match(yearOnlyRegex);
  
  if (yearMatches && yearMatches.length > 0) {
    return true;
  }
  
  return false;
}

// Helper function to extract text from spans
function* getTextOfSpans(content, spans) {
  for (const span of spans) {
    yield content.slice(span.offset, span.offset + span.length);
  }
}

// Helper function to parse request data (simplified for base64 only)
const parseRequestData = (req) => {
  return new Promise((resolve, reject) => {
    try {
      // Expect JSON body with base64 encoded file
      if (!req.body || typeof req.body !== 'object') {
        reject(new Error("Expected JSON request body"));
        return;
      }

      const { file, documentType, organizationName, fein, fileType, fileName } = req.body;

      if (!file || typeof file !== 'string') {
        reject(new Error("Missing or invalid file data. Expected base64 string."));
        return;
      }

      // Decode base64 file
      let fileBuffer;
      try {
        fileBuffer = Buffer.from(file, 'base64');
      } catch (decodeError) {
        reject(new Error("Invalid base64 file data"));
        return;
      }

      const fileData = {
        data: fileBuffer,
        type: fileType || 'application/pdf',
        name: fileName || 'document'
      };

      resolve({
        file: fileData,
        documentType: documentType || "tax-clearance-online",
        organizationName: organizationName || "",
        fein: fein || ""
      });

    } catch (error) {
      reject(error);
    }
  });
};

// Main Azure Function handler using ES7 async/await
export default async (context, req) => {
  context.log('Validate document function processed a request.');

  // Enable CORS
  context.res = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    }
  };

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    context.res.status = 200;
    return;
  }

  try {
    // Validate environment variables
    if (!endpoint || !key) {
      context.log.error('Missing required environment variables: DI_ENDPOINT or DI_KEY');
      context.res = {
        ...context.res,
        status: 500,
        body: { error: "Server configuration error: Missing Document Intelligence credentials" }
      };
      return;
    }

    // Set a timeout to abort if processing takes too long
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Processing timeout")), 50000); // 50 second timeout
    });

    // Main processing function
    const processingPromise = async () => {
      // Parse the multipart form data
      const { file, documentType, organizationName, fein } = await parseRequestData(req);
      
      if (!file) {
        context.res = {
          ...context.res,
          status: 400,
          body: { error: "No file provided" }
        };
        return;
      }

      // Convert the file into a Buffer
      const buffer = Buffer.from(file.data);
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

      context.res = {
        ...context.res,
        status: 200,
        body: {
          success: validationResults.missingElements.length === 0,
          missingElements: validationResults.missingElements,
          suggestedActions: validationResults.suggestedActions || [],
          documentInfo,
          organizationNameMatches: !validationResults.missingElements.some(
            element => element.includes("Organization name doesn't match")
          )
        }
      };
    };

    // Race between processing and timeout
    await Promise.race([processingPromise(), timeoutPromise]);

  } catch (error) {
    context.log.error("Error in document validation:", error);
    
    const statusCode = error.message === "Processing timeout" ? 504 : 500;
    const errorMessage = error.message === "Processing timeout" 
      ? "Request timed out. Document processing took too long."
      : error.message || "Failed to validate document";

    context.res = {
      ...context.res,
      status: statusCode,
      body: { error: errorMessage }
    };
  }
};