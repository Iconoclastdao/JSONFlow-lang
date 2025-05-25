const fs = require('fs').promises;
const path = require('path');

async function generateRoutes() {
  const schemaPath = path.resolve(__dirname, '../schema/api/api.schema.json');
  const outputPath = path.resolve(__dirname, '../routes/generatedRoutes.js');

  let apiSchema;
  try {
    const schemaData = await fs.readFile(schemaPath, 'utf-8');
    apiSchema = JSON.parse(schemaData);
  } catch (e) {
    console.error(`❌ Could not load sovereign-api.schema.json: ${e.message}`);
    process.exit(1);
  }

  const endpoints = [];
  const modules = apiSchema.properties || {};
  for (const [module, moduleSchema] of Object.entries(modules)) {
    const actions = moduleSchema.properties || {};
    for (const [action, actionSchema] of Object.entries(actions)) {
      endpoints.push({
        path: `/${module}/${action}`,
        method: 'POST', // Assume POST for all actions (customize as needed)
        workflow: `${module}-${action}`,
        description: `${action} action for ${module} module`
      });
    }
  }

  let routeContent = `
const express = require('express');
const router = express.Router();
const { executeJSONFlow } = require('../jsonflow-executor');

`;

  for (const endpoint of endpoints) {
    const { path, method, workflow, description } = endpoint;
    routeContent += `
/**
 * ${description}
 * Method: ${method}
 * Workflow: ${workflow}
 */
router.${method.toLowerCase()}('${path}', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: '${workflow}', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
`;
  }

  routeContent += `
module.exports = router;
`;

  try {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, routeContent);
    console.log(`✅ Generated routes at ${outputPath}`);
  } catch (error) {
    console.error(`❌ Error writing routes: ${error.message}`);
    process.exit(1);
  }
}

generateRoutes();