const fs = require('fs').promises;
const path = require('path');

const schemasDir = path.join(__dirname, '../schema');
const controllersDir = path.join(__dirname, '../controllers');

async function generateControllers() {
  try {
    // Ensure controllers directory exists
    await fs.mkdir(controllersDir, { recursive: true });

    const files = await fs.readdir(schemasDir, { withFileTypes: true });

    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.schema.json')) {
        const resourceName = path.basename(file.name, '.schema.json');
        const controllerFileName = `${resourceName}Controller.js`;
        const controllerFilePath = path.join(controllersDir, controllerFileName);

        const controllerTemplate = `
/**
 * Controller for ${resourceName} endpoints
 */
const ${capitalize(resourceName)} = require('../models/${resourceName}Model');

/**
 * Controller functions for ${resourceName}
 */
module.exports = {
  async create${capitalize(resourceName)}(req, res) {
    // TODO: Implement create logic
    res.status(501).json({ message: 'Not implemented' });
  },
  async getAll${capitalize(resourceName)}s(req, res) {
    // TODO: Implement get all logic
    res.status(501).json({ message: 'Not implemented' });
  },
  async get${capitalize(resourceName)}ById(req, res) {
    // TODO: Implement get by ID logic
    res.status(501).json({ message: 'Not implemented' });
  },
  async update${capitalize(resourceName)}(req, res) {
    // TODO: Implement update logic
    res.status(501).json({ message: 'Not implemented' });
  },
  async delete${capitalize(resourceName)}(req, res) {
    // TODO: Implement delete logic
    res.status(501).json({ message: 'Not implemented' });
  },
};
`;

        await fs.writeFile(controllerFilePath, controllerTemplate.trim());
        console.log(`✅ Generated controller: ${controllerFileName}`);
      }
    }
  } catch (error) {
    console.error('❌ Error generating controllers:', error.message);
    process.exit(1);
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Run the generator
generateControllers();