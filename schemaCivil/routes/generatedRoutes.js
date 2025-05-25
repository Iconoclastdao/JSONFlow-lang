
const express = require('express');
const router = express.Router();
const { executeJSONFlow } = require('../jsonflow-executor');


/**
 * schema_version action for metadata module
 * Method: POST
 * Workflow: metadata-schema_version
 */
router.post('/metadata/schema_version', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'metadata-schema_version', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * version action for metadata module
 * Method: POST
 * Workflow: metadata-version
 */
router.post('/metadata/version', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'metadata-version', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * author action for metadata module
 * Method: POST
 * Workflow: metadata-author
 */
router.post('/metadata/author', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'metadata-author', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * description action for metadata module
 * Method: POST
 * Workflow: metadata-description
 */
router.post('/metadata/description', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'metadata-description', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * created action for metadata module
 * Method: POST
 * Workflow: metadata-created
 */
router.post('/metadata/created', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'metadata-created', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * updated action for metadata module
 * Method: POST
 * Workflow: metadata-updated
 */
router.post('/metadata/updated', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'metadata-updated', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * tags action for metadata module
 * Method: POST
 * Workflow: metadata-tags
 */
router.post('/metadata/tags', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'metadata-tags', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * visualization action for metadata module
 * Method: POST
 * Workflow: metadata-visualization
 */
router.post('/metadata/visualization', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'metadata-visualization', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * examples action for metadata module
 * Method: POST
 * Workflow: metadata-examples
 */
router.post('/metadata/examples', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'metadata-examples', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * docs action for metadata module
 * Method: POST
 * Workflow: metadata-docs
 */
router.post('/metadata/docs', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'metadata-docs', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * tooling action for metadata module
 * Method: POST
 * Workflow: metadata-tooling
 */
router.post('/metadata/tooling', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'metadata-tooling', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * compliance action for metadata module
 * Method: POST
 * Workflow: metadata-compliance
 */
router.post('/metadata/compliance', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'metadata-compliance', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * license action for metadata module
 * Method: POST
 * Workflow: metadata-license
 */
router.post('/metadata/license', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'metadata-license', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * inputs action for schema module
 * Method: POST
 * Workflow: schema-inputs
 */
router.post('/schema/inputs', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'schema-inputs', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * outputs action for schema module
 * Method: POST
 * Workflow: schema-outputs
 */
router.post('/schema/outputs', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'schema-outputs', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * authentication action for security module
 * Method: POST
 * Workflow: security-authentication
 */
router.post('/security/authentication', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'security-authentication', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * authorization action for security module
 * Method: POST
 * Workflow: security-authorization
 */
router.post('/security/authorization', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'security-authorization', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * encryption action for security module
 * Method: POST
 * Workflow: security-encryption
 */
router.post('/security/encryption', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'security-encryption', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * secrets action for security module
 * Method: POST
 * Workflow: security-secrets
 */
router.post('/security/secrets', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'security-secrets', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * logging action for observability module
 * Method: POST
 * Workflow: observability-logging
 */
router.post('/observability/logging', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'observability-logging', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * metrics action for observability module
 * Method: POST
 * Workflow: observability-metrics
 */
router.post('/observability/metrics', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'observability-metrics', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * tracing action for observability module
 * Method: POST
 * Workflow: observability-tracing
 */
router.post('/observability/tracing', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'observability-tracing', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * telemetry action for observability module
 * Method: POST
 * Workflow: observability-telemetry
 */
router.post('/observability/telemetry', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'observability-telemetry', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * type action for orchestration module
 * Method: POST
 * Workflow: orchestration-type
 */
router.post('/orchestration/type', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'orchestration-type', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * runtime action for orchestration module
 * Method: POST
 * Workflow: orchestration-runtime
 */
router.post('/orchestration/runtime', async (req, res) => {
  try {
    const data = req.body;
    const result = await executeJSONFlow({ workflow: 'orchestration-runtime', params: data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
