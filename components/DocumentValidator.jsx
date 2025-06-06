'use client';

import { useState, useEffect } from 'react';
import Header from './Header';
import DocumentTypeSelector from './DocumentTypeSelector';
import FormFields from './FormFields';
import FileUploadArea from './FileUploadArea';
import ValidationButton from './ValidationButton';
import ErrorMessage from './ErrorMessage';
import ValidationResults from './ValidationResults';

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
      
      // Check file size (50MB limit)
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        return;
      }
      
      // Show warning for large files
      if (selectedFile.size > 4 * 1024 * 1024) { // 4MB threshold for chunked upload
        console.log(`Large file detected: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB - Will use chunked upload`);
      }
      
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setValidationResult(null);
      setError(null);
    }
  };

  // Chunked upload function for large files
  const uploadFileInChunks = async (file, documentType, formFields) => {
    const chunkSize = 4 * 1024 * 1024; // 4MB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Uploading ${file.name} in ${totalChunks} chunks`);
    
    // Upload chunks
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      const chunkFormData = new FormData();
      chunkFormData.append('chunk', chunk);
      chunkFormData.append('chunkIndex', chunkIndex.toString());
      chunkFormData.append('totalChunks', totalChunks.toString());
      chunkFormData.append('fileName', file.name);
      chunkFormData.append('fileId', fileId);
      
      const chunkResponse = await fetch('/api/upload-chunk', {
        method: 'POST',
        body: chunkFormData,
      });
      
      if (!chunkResponse.ok) {
        throw new Error(`Failed to upload chunk ${chunkIndex + 1}/${totalChunks}`);
      }
      
      const chunkResult = await chunkResponse.json();
      
      // If upload is complete, process the file
      if (chunkResult.complete) {
        console.log('All chunks uploaded, processing document...');
        
        // Convert base64 back to ArrayBuffer for browser compatibility
        const binaryString = atob(chunkResult.buffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create a new FormData for the validation API
        const validationFormData = new FormData();
        const reconstructedFile = new File([bytes.buffer], file.name, { type: file.type });
        validationFormData.append('file', reconstructedFile);
        validationFormData.append('documentType', documentType);
        
        // Add form fields to the request
        Object.entries(formFields).forEach(([key, value]) => {
          if (value) validationFormData.append(key, value);
        });
        
        // Call the validation API
        const validationResponse = await fetch('/api/validate-document', {
          method: 'POST',
          body: validationFormData,
        });
        
        if (!validationResponse.ok) {
          throw new Error(`Validation error: ${validationResponse.statusText}`);
        }
        
        return await validationResponse.json();
      }
      
      console.log(`Uploaded chunk ${chunkIndex + 1}/${totalChunks}`);
    }
    
    throw new Error('File upload incomplete');
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
      // Check if file is larger than 4MB and use chunked upload
      if (file.size > 4 * 1024 * 1024) {
        console.log('Using chunked upload for large file');
        const result = await uploadFileInChunks(file, documentType, formFields);
        setValidationResult(result);
      } else {
        // Use regular upload for smaller files
        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', documentType);
        
        // Add form fields to the request
        Object.entries(formFields).forEach(([key, value]) => {
          if (value) formData.append(key, value);
        });

        const response = await fetch('/api/validate-document', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }

        const result = await response.json();
        setValidationResult(result);
      }
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