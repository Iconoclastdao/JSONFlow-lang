const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({
  allErrors: true,
  useDefaults: true,
  verbose: true, // Detailed error messages for transparency
  strict: false, // Disable strict mode to allow union types
  allowUnionTypes: true // Explicitly allow union types
});

addFormats(ajv); // Adds support for "date-time", "uuid", etc.

module.exports = ajv;