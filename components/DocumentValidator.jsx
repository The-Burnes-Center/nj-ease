'use client';
/**
 * DocumentValidator.jsx
 * ---------------------------------------------
 * Top-level React (Next.js) component responsible for the entire
 * "upload → validate → results" flow on the front-end of the
 * AI-Document-Validator application.
 *
 * Responsibilities
 * 1.  Provides the page layout, theming (light / dark) and responsive grid.
 * 2.  Orchestrates all UI sub-components:
 *     - Header
 *     - DocumentTypeSelector
 *     - FormFields
 *     - FileUploadArea
 *     - ValidationButton
 *     - ErrorMessage
 *     - ValidationResults
 * 3.  Manages application state via React hooks:
 *     • file / fileName                      – uploaded document reference
 *     • isUploading                          – loading spinner flag
 *     • validationResult                     – JSON returned from API
 *     • error                                – human-readable error message
 *     • documentType                         – selected doc-type option
 *     • formFields / requiredFields          – dynamic form data + validation
 *     • fieldErrors                          – per-field validation messages
 *     • drag & drop state (isDragOver, …)    – UX niceties
 *     • isDarkMode                           – user-/system-preferred theme
 * 4.  Validates user input before making the /api/validate-document call.
 * 5.  Converts the file into base64 so it can be transported as JSON.
 *
 * Network contract
 * ---------------
 * Expects POST /api/validate-document with the schema:
 * {
 *   file:           <string  – base64>,
 *   documentType:   <string>,
 *   fileType:       <string mime-type>,
 *   fileName:       <string>,
 *   organizationName?: <string>,
 *   fein?:            <string>
 * }
 * and renders the response in the ValidationResults panel.
 *
 * NOTE:  Keep this component as a thin orchestrator – complex logic for
 * file parsing / validation should live in the backend Azure Function
 * (see api/validate-document/index.js).
 * ---------------------------------------------
 */

import { useState, useEffect } from 'react';
import Header from './Header';
import DocumentTypeSelector from './DocumentTypeSelector';
import FormFields from './FormFields';
import FileUploadArea from './FileUploadArea';
import ValidationButton from './ValidationButton';
import ErrorMessage from './ErrorMessage';
import ValidationResults from './ValidationResults';

// Add a configurable base URL for the API so that local development can point
// to a separately-hosted Azure Functions instance (e.g. http://localhost:7071).
// If the env var is undefined we fall back to the relative path which works in
// production (Static Web Apps serves frontend & API under the same host).
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

export default function DocumentValidator() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState(null);
  const [documentType, setDocumentType] = useState('tax-clearance-online');
  const [formFields, setFormFields] = useState({
    organizationName: '',
    fein: ''
  });
  const [requiredFields, setRequiredFields] = useState({
    organizationName: false,
    fein: false
  });
  // Add validation error states
  const [fieldErrors, setFieldErrors] = useState({
    organizationName: '',
    fein: ''
  });
  // Add drag & drop states
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  
  // Add theme state
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
    }
  }, []);

  // Save theme to localStorage when changed
  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const documentTypes =  [
    { value: 'tax-clearance-online', label: 'Tax Clearance Certificate (Online)' },
    { value: 'tax-clearance-manual', label: 'Tax Clearance Certificate (Manually Generated)' },
    { value: 'cert-alternative-name', label: 'Certificate of Alternative Name' },
    { value: 'cert-trade-name', label: 'Certificate of Trade Name' },
    { value: 'cert-formation', label: 'Certificate of Formation' },
    { value: 'cert-formation-independent', label: 'Certificate of Formation - Independent' },
    { value: 'operating-agreement', label: 'Operating Agreement' },
    { value: 'cert-incorporation', label: 'Certificate of Incorporation' },
    { value: 'irs-determination', label: 'IRS Determination Letter' },
    { value: 'bylaws', label: 'By-laws' },
    { value: 'cert-authority', label: 'Certificate of Authority' }
  ];

  // Set required fields based on document type
  useEffect(() => {
    const newRequiredFields = {
      organizationName: false,
      fein: false
    };
    
    switch(documentType) {
      case 'tax-clearance-online':
      case 'tax-clearance-manual':
        newRequiredFields.organizationName = true;
        newRequiredFields.fein = true;
        break;
      case 'operating-agreement':
      case 'cert-formation':
      case 'cert-formation-independent':
      case 'cert-incorporation':
      case 'cert-authority':
      case 'cert-alternative-name':
        newRequiredFields.organizationName = true;
        break;
      default:
        break;
    }
    
    setRequiredFields(newRequiredFields);
    
    // Reset validation result when document type changes
    setValidationResult(null);
    setError(null);
  }, [documentType]);

  // Enhanced file handling function
  const handleFile = (selectedFile) => {
    if (selectedFile) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain', 'image/png', 'image/jpeg', 'image/jpg'];
      const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg'];
      
      const fileExtension = '.' + selectedFile.name.split('.').pop().toLowerCase();
      const isValidType = allowedTypes.includes(selectedFile.type) || allowedExtensions.includes(fileExtension);
      
      if (!isValidType) {
        setError('Please select a valid file type: PDF, DOCX, DOC, TXT, PNG, JPG, or JPEG');
        return;
      }
      
      // Check file size (23MB limit)
      if (selectedFile.size > 23 * 1024 * 1024) {
        setError('File size must be less than 23 MB');
        return;
      }
      
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setValidationResult(null);
      setError(null);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    handleFile(selectedFile);
  };

  // Drag & Drop event handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCount = prev - 1;
      if (newCount <= 0) {
        setIsDragOver(false);
      }
      return newCount;
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragCounter(0);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFile(droppedFile);
      e.dataTransfer.clearData();
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormFields(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Add validation function for required fields
  const validateRequiredFields = () => {
    const errors = {};
    let isValid = true;

    if (requiredFields.organizationName && !formFields.organizationName.trim()) {
      errors.organizationName = 'Organization Name is required';
      isValid = false;
    }

    if (requiredFields.fein && !formFields.fein.trim()) {
      errors.fein = 'FEIN is required';
      isValid = false;
    }

    setFieldErrors(errors);
    return isValid;
  };

  // Helper function to convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remove data:mime/type;base64, prefix to get pure base64
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const validateDocument = async () => {
    // Check if file is uploaded
    if (!file) {
      setError('Please upload a document first');
      return;
    }
    
    // Validate required fields first
    if (!validateRequiredFields()) {
      setError('Please fill in all required fields');
      return;
    }
    
    setIsUploading(true);
    setError(null);
    
    try {
      // Convert file to base64
      const base64File = await fileToBase64(file);
      
      // Create JSON payload with base64 encoded file
      const payload = {
        file: base64File,
        documentType: documentType,
        fileType: file.type,
        fileName: file.name,
        ...formFields // Spread the form fields (organizationName, fein)
      };

      // Call your API route with JSON payload
      const response = await fetch(`${API_BASE_URL}/api/validate-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Error: ${response.statusText}`);
      }

      const result = await response.json();
      setValidationResult(result);
    } catch (err) {
      console.error('Error validating document:', err);
      setError(err.message || 'Failed to validate document');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`min-h-screen w-full transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800' 
        : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100'
    }`}>
      <div className="w-full h-full flex flex-col px-6 py-6">
        {/* Header */}
        <Header isDarkMode={isDarkMode} toggleTheme={toggleTheme} />

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Document Upload Section - Left */}
          <div className="lg:col-span-7 flex flex-col">
            <div className={`${
              isDarkMode
                ? 'bg-gray-800/80 border-gray-700/20'
                : 'bg-white/80 border-white/20'
            } backdrop-blur-sm p-4 sm:p-5 md:p-5 rounded-2xl shadow-xl border transition-all duration-300 h-full`}>
              <DocumentTypeSelector 
                documentType={documentType}
                setDocumentType={setDocumentType}
                documentTypes={documentTypes}
                isDarkMode={isDarkMode}
              />
              
              <FormFields 
                requiredFields={requiredFields}
                formFields={formFields}
                handleInputChange={handleInputChange}
                fieldErrors={fieldErrors}
                isDarkMode={isDarkMode}
              />
              
              <FileUploadArea 
                file={file}
                fileName={fileName}
                isDragOver={isDragOver}
                handleFileChange={handleFileChange}
                handleDragEnter={handleDragEnter}
                handleDragLeave={handleDragLeave}
                handleDragOver={handleDragOver}
                handleDrop={handleDrop}
                isDarkMode={isDarkMode}
              />
              
              <ValidationButton 
                isUploading={isUploading}
                validateDocument={validateDocument}
                isDarkMode={isDarkMode}
              />
              
              <ErrorMessage error={error} isDarkMode={isDarkMode} />
            </div>
          </div>
          
          {/* Validation Results Section */}
          <div className="lg:col-span-5 flex flex-col">
            <div className={`${
              isDarkMode
                ? 'bg-gray-800/80 border-gray-700/20'
                : 'bg-white/80 border-white/20'
            } backdrop-blur-sm p-6 rounded-2xl shadow-xl border transition-all duration-300 h-full`}>
              <ValidationResults validationResult={validationResult} isDarkMode={isDarkMode} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}