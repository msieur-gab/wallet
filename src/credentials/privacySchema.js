/**
 * Privacy Schema for Credential Disclosure
 *
 * Defines minimal claims for each credential type when using "Privacy First" mode.
 * Full disclosure mode shows all claims from the credential.
 *
 * This gives users control over what information they share while maintaining
 * credential authenticity through signature verification.
 */

/**
 * Credential Privacy Schema
 * Maps credential types to their minimal disclosure claims
 */
export const PRIVACY_SCHEMA = {
  // Health & Medical
  'VaccinationCredential': {
    minimalClaims: ['vaccinated', 'vaccineName'],
    description: 'Shows vaccination status and type only',
    hidden: ['manufacturer', 'doseNumber', 'dateAdministered', 'lotNumber', 'administeredBy', 'facilityName']
  },

  // Identity & Age
  'AgeCredential': {
    minimalClaims: ['over18', 'over21', 'verifiedDate'],
    description: 'Shows age verification only',
    hidden: ['dateOfBirth', 'fullName', 'address']
  },

  'ResidencyCredential': {
    minimalClaims: ['country', 'verifiedDate'],
    description: 'Shows country only',
    hidden: ['state', 'city', 'address', 'postalCode']
  },

  // Employment
  'EmploymentCredential': {
    minimalClaims: ['employed', 'jobTitle'],
    description: 'Shows employment status and title only',
    hidden: ['department', 'startDate', 'endDate', 'employeeId', 'salary', 'manager']
  },

  'SkillCredential': {
    minimalClaims: ['skill', 'level'],
    description: 'Shows skill and level only',
    hidden: ['yearsOfExperience', 'endorsedBy', 'projects', 'certifications']
  },

  // Education
  'EducationCredential': {
    minimalClaims: ['degree', 'major'],
    description: 'Shows degree and major only',
    hidden: ['gpa', 'graduationDate', 'honors', 'courses', 'studentId']
  },

  'CertificationCredential': {
    minimalClaims: ['certificationName', 'certificationDate'],
    description: 'Shows certification name and date only',
    hidden: ['expirationDate', 'certificationId', 'issuingBody', 'score']
  },

  // Membership
  'MembershipCredential': {
    minimalClaims: ['member', 'membershipLevel'],
    description: 'Shows membership status and level only',
    hidden: ['memberSince', 'membershipId', 'expirationDate', 'benefits', 'renewalDate']
  },

  // Default for unknown types
  'default': {
    minimalClaims: [], // Will extract first 2-3 non-sensitive fields
    description: 'Shows basic information only',
    hidden: []
  }
};

/**
 * Get minimal claims for a credential type
 */
export function getMinimalClaims(credentialType, allClaims) {
  const schema = PRIVACY_SCHEMA[credentialType] || PRIVACY_SCHEMA['default'];

  // If schema defines specific fields, use those
  if (schema.minimalClaims.length > 0) {
    const minimal = {};
    schema.minimalClaims.forEach(field => {
      if (allClaims[field] !== undefined) {
        minimal[field] = allClaims[field];
      }
    });
    return minimal;
  }

  // Default: use first 2-3 simple fields (avoid nested objects, IDs, dates)
  const entries = Object.entries(allClaims).filter(([key, value]) => {
    return key !== 'id' &&
           typeof value !== 'object' &&
           !key.toLowerCase().includes('id') &&
           !key.toLowerCase().includes('date');
  });

  return Object.fromEntries(entries.slice(0, 3));
}

/**
 * Get list of hidden claims for a credential type
 */
export function getHiddenClaims(credentialType, allClaims) {
  const schema = PRIVACY_SCHEMA[credentialType] || PRIVACY_SCHEMA['default'];
  const minimalClaims = getMinimalClaims(credentialType, allClaims);

  return Object.keys(allClaims).filter(key =>
    key !== 'id' && !(key in minimalClaims)
  );
}

/**
 * Get description for privacy mode
 */
export function getPrivacyDescription(credentialType) {
  const schema = PRIVACY_SCHEMA[credentialType] || PRIVACY_SCHEMA['default'];
  return schema.description;
}

/**
 * Check if a credential type has a privacy schema defined
 */
export function hasPrivacySchema(credentialType) {
  return credentialType in PRIVACY_SCHEMA;
}
