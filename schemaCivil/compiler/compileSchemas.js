const fs = require('fs').promises;
const path = require('path');
const ajv = require('../config/ajv');

// Standard package.json schema
const packageJsonSchema = {
  type: 'object',
  properties: {
    dependencies: {
      type: 'object',
      additionalProperties: { type: 'string' }
    },
    devDependencies: {
      type: 'object',
      additionalProperties: { type: 'string' }
    }
  },
  additionalProperties: true
};

async function validateSchemas(schemaDir) {
  try {
    const files = await fs.readdir(schemaDir, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(schemaDir, file.name);

      if (filePath.includes('node_modules') || file.name.startsWith('.')) continue;

      if (file.isDirectory()) {
        await validateSchemas(filePath);
      } else if (file.name.endsWith('.json')) {
        try {
          const data = await fs.readFile(filePath, 'utf-8');
          const schema = JSON.parse(data);
          console.log(`Processing schema: ${filePath}, $id: ${schema.$id || 'none'}`);

          if (file.name === 'package.json') {
            const validate = ajv.compile(packageJsonSchema);
            const valid = validate(JSON.parse(data));
            if (!valid) {
              console.error(`❌ INVALID: ${filePath}`);
              console.error('Schema errors:', JSON.stringify(validate.errors, null, 2));
              continue;
            }
          } else {
            const schemaName = path.basename(file, '.json');
            if (schema.$id && !ajv.getSchema(schema.$id)) {
              ajv.addSchema(schema, schema.$id);
              console.log(`✅ Registered schema with $id: ${schema.$id}`);
            } else if (!schema.$id) {
              console.log(`Compiling schema without $id: ${filePath}`);
              ajv.compile(schema);
            } else {
              console.warn(`⚠️ Schema with $id ${schema.$id} already registered, skipping: ${filePath}`);
            }
          }
          console.log(`✅ VALID: ${filePath}`);
        } catch (err) {
          console.error(`❌ INVALID: ${filePath}`);
          if (err instanceof SyntaxError) {
            console.error('Invalid JSON:', err.message);
          } else if (err.errors) {
            console.error('Schema errors:', JSON.stringify(err.errors, null, 2));
          } else {
            console.error('Error:', err.message || err);
          }
        }
      }
    }
  } catch (err) {
    console.error(`❌ Error reading directory ${schemaDir}:`, err.message);
  }
}

// Start validation
(async () => {
  try {
    ajv.removeSchema();
    await validateSchemas(path.resolve(__dirname, '../schema'));
    console.log('✅ Schema validation completed successfully');
  } catch (err) {
    console.error('❌ Fatal error in validation:', err.message);
    process.exit(1);
  }
})();