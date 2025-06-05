'use client';

import { useState, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';

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

  const documentTypes =  [
    { value: 'tax-clearance-online', label: 'Tax Clearance Certificate (Online Generated)' },
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
      // Create form data for the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      
      // Add form fields to the request
      Object.entries(formFields).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

      // Call your API route that will interface with Azure AI
      const response = await fetch('/api/validate-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
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
    <div className="container mx-auto">
      <div className="col-span-full rounded-lg shadow-sm mb-5">
          <h1 className="sm:text-xl md:text-2xl lg:text-3xl font-bold text-center text-white">NJ EASE - Entrepreneurial Application Screening Engine</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[80vh]">
        {/* Header - Spans full width */}
        
        {/* Document Upload Section - Left */}
        <div className="lg:col-span-7 bg-white p-6 rounded-lg shadow-sm h-full">
          
          <div className="mb-5">
            <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">Document Type</label>
            <select
              value={documentType}
              onChange={(e) => {
                setDocumentType(e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 text-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
            >
              {documentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Centralized form fields */}
          <div className="mb-5">
            {requiredFields.organizationName && (
              <div className="mb-4">
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="organizationName"
                  value={formFields.organizationName}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-600 text-sm md:text-base ${
                    fieldErrors.organizationName 
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="Enter organization name"
                />
                {fieldErrors.organizationName && (
                  <p className="text-xs md:text-sm text-red-600 mt-1">{fieldErrors.organizationName}</p>
                )}
              </div>
            )}
            
            {requiredFields.fein && (
              <div className="mb-4">
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">
                  FEIN (Federal Employer Identification Number) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="fein"
                  value={formFields.fein}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-600 text-sm md:text-base ${
                    fieldErrors.fein 
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="Enter FEIN"
                />
                {fieldErrors.fein && (
                  <p className="text-xs md:text-sm text-red-600 mt-1">{fieldErrors.fein}</p>
                )}
                <p className="text-xs md:text-sm text-gray-500 mt-1">This will be used to verify the last 3 digits on the tax clearance</p>
              </div>
            )}
          </div>
          
          <div className="mb-6">
            <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">Upload Document</label>
            <div 
              className={`w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors duration-200 ${
                isDragOver 
                  ? 'border-blue-500 bg-blue-100' 
                  : file 
                    ? 'border-green-400 bg-green-50 hover:border-green-500' 
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              }`}
              onClick={() => !isDragOver && document.getElementById('file-upload').click()}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                id="file-upload"
                type="file"
                accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileChange}
              />
              
              {isDragOver ? (
                <>
                  <Upload className="h-12 w-12 text-blue-500 mb-2" />
                  <p className="text-base md:text-lg font-medium text-blue-600">Drop your file here!</p>
                  <p className="text-sm md:text-base text-blue-500 mt-1">Release to upload</p>
                </>
              ) : file ? (
                <>
                  <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                  <p className="text-sm md:text-base text-gray-600 text-center font-medium">{fileName}</p>
                  <p className="text-xs md:text-sm text-gray-500 mt-1">Click to change file or drag a new one</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm md:text-base text-gray-600 font-medium">Click to browse files</p>
                  <p className="text-xs md:text-sm text-gray-500 mt-1">or drag & drop your document here</p>
                  <p className="text-xs md:text-sm text-gray-400 mt-2 bg-gray-100 px-2 py-1 rounded">PDF, DOCX, DOC, JPG, PNG (Max 50MB)</p>
                </>
              )}
            </div>
          </div>
          
          <div className="flex justify-center">
            <button
              className={`px-6 py-2 rounded-md font-medium transition-colors text-sm md:text-base ${
                isUploading
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              onClick={validateDocument}
              disabled={isUploading}
            >
              {isUploading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Validating...
                </div>
              ) : "Validate Document"}
            </button>
          </div>
          
          {error && (
            <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-md w-full">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-sm md:text-base text-red-600">{error}</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Validation Results Section - Right side, full height */}
        <div className="lg:col-span-5">
          <div 
            className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-200 h-full"
          >
            
            {validationResult ? (
              <>
                <div className={`flex items-center mb-6 p-5 rounded-xl shadow-md border-2 ${validationResult.missingElements && validationResult.missingElements.length > 0 
                  ? 'bg-gradient-to-r from-red-50 via-red-100 to-red-50 border-red-200' 
                  : 'bg-gradient-to-r from-emerald-50 via-emerald-100 to-emerald-50 border-emerald-200'
                }`}>
                  {validationResult.missingElements && validationResult.missingElements.length > 0 ? (
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500 shadow-lg mr-4">
                      <AlertCircle className="h-6 w-6 text-white" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500 shadow-lg mr-4">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className={`font-bold text-xl mb-1 ${validationResult.missingElements && validationResult.missingElements.length > 0 ? 'text-red-800' : 'text-emerald-800'}`}>
                      {validationResult.missingElements && validationResult.missingElements.length > 0 ? 'Validation Failed' : 'Validation Passed'}
                    </h3>
                    <p className={`text-sm ${validationResult.missingElements && validationResult.missingElements.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {validationResult.missingElements && validationResult.missingElements.length > 0 
                        ? 'Document validation completed with issues' 
                        : 'Document validation completed successfully'
                      }
                    </p>
                  </div>
                </div>
                
                {validationResult.missingElements && validationResult.missingElements.length > 0 && (
                  <div className="mb-6 p-5 bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl shadow-sm">
                    <div className="flex items-center mb-3">
                      <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                      <p className="text-base font-semibold text-red-800">Issues Found</p>
                    </div>
                    <ul className="space-y-2 ml-2">
                      {validationResult.missingElements.map((item, index) => (
                        <li key={index} className="flex items-start">
                          <div className="w-2 h-2 rounded-full bg-red-500 mt-2 mr-3 flex-shrink-0"></div>
                          <p className="text-sm text-red-700 leading-relaxed">{item}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {(!validationResult.missingElements || validationResult.missingElements.length === 0) && validationResult.documentInfo && (
                  <div className="mb-6 p-5 bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200 rounded-xl shadow-sm">
                    <div className="flex items-center mb-3">
                      <CheckCircle className="h-5 w-5 text-emerald-600 mr-2" />
                      <p className="text-base font-semibold text-emerald-800">Document Information</p>
                    </div>
                    <div className="bg-white/60 p-4 rounded-lg border border-emerald-200/50">
                      <div className="grid grid-cols-1 gap-2">
                        {validationResult.documentInfo.pageCount && (
                          <div className="flex items-center text-xs text-emerald-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></div>
                            <span>Pages: <span className="font-medium">{validationResult.documentInfo.pageCount}</span></span>
                          </div>
                        )}
                        {validationResult.documentInfo.wordCount && (
                          <div className="flex items-center text-xs text-emerald-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></div>
                            <span>Words: <span className="font-medium">{validationResult.documentInfo.wordCount}</span></span>
                          </div>
                        )}
                        {validationResult.documentInfo.containsHandwriting !== undefined && (
                          <div className="flex items-center text-xs text-emerald-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></div>
                            <span>Contains handwriting: <span className="font-medium">{validationResult.documentInfo.containsHandwriting ? 'Yes' : 'No'}</span></span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {validationResult.suggestedActions && validationResult.suggestedActions.length > 0 && (
                  <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-xl shadow-sm">
                    <div className="flex items-center mb-3">
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center mr-2">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-base font-semibold text-blue-800">Suggested Actions</p>
                    </div>
                    <ul className="space-y-2 ml-2">
                      {validationResult.suggestedActions.map((action, index) => (
                        <li key={index} className="flex items-start">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 mr-3 flex-shrink-0"></div>
                          <p className="text-sm text-blue-700 leading-relaxed">{action}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              // Empty state when no validation has been performed
              <div className="p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center h-full">
                <div className="bg-blue-50 rounded-full p-4 mb-4">
                  <FileText className="h-14 w-14 text-blue-500" />
                </div>
                <h3 className="text-gray-800 text-lg font-medium mb-2 text-center">No Document Validated</h3>
                <p className="text-gray-600 text-center max-w-xs mb-4">
                  Your document validation results will appear here after you upload and validate a document.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}