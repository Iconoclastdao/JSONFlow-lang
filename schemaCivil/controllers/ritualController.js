const Ajv = require('ajv');
const logger = require('../utils/logger'); // Assumed logging utility, replace with your logger (e.g., winston)

// Initialize Ajv with strict mode disabled to allow custom keywords (metadata, nlp, steps, etc.)
const ajv = new Ajv({
  strict: false, // Allow non-standard keywords
  allErrors: true, // Report all validation errors for debugging
  verbose: true // Include schema and data in errors for better diagnostics
});

// Load the ritual schema
let schema;
try {
  schema = require('../schema/ritual.schema.json');
} catch (err) {
  logger.error('Failed to load ritual.schema.json:', err.message);
  throw new Error('Schema loading failed');
}

// Compile the schema
let validate;
try {
  validate = ajv.compile(schema);
  logger.info('Ritual schema compiled successfully');
} catch (err) {
  logger.error('Schema compilation failed:', err.message);
  throw new Error('Schema compilation failed');
}

/**
 * Middleware to validate ritual data and prepare metadata, nlp, and steps for downstream processing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateRitual = async (req, res, next) => {
  try {
    // Validate request body against schema
    const valid = validate(req.body);
    if (!valid) {
      const error = new Error('Validation failed');
      error.status = 400;
      error.details = validate.errors.map(err => ({
        path: err.instancePath,
        message: err.message,
        params: err.params
      }));
      logger.warn('Validation failed:', error.details);
      return next(error);
    }

    // Extract and store custom fields for downstream use
    const { metadata, nlp, steps } = req.body;
    
    // Store metadata for logging or audit
    req.app.locals.ritualMetadata = metadata || {};
    logger.info('Ritual metadata:', {
      schema_version: metadata?.schema_version,
      function: metadata?.function,
      tags: metadata?.tags
    });

    // Process NLP configuration if present
    if (nlp && nlp.mapIntent) {
      req.app.locals.nlpConfig = {
        intentMap: nlp.mapIntent,
        model: nlp.model || 'grok_3',
        language: nlp.language || 'en'
      };
      logger.debug('NLP config initialized:', req.app.locals.nlpConfig);
    }

    // Store steps for orchestration (e.g., blockchain operations)
    req.app.locals.ritualSteps = steps || [];
    logger.debug(`Loaded ${steps?.length || 0} ritual steps`);

    // Basic type checking for critical fields
    if (!Array.isArray(req.body.rituals)) {
      const error = new Error('Rituals must be an array');
      error.status = 400;
      return next(error);
    }

    // Example: Map NLP intents to actions if needed
    if (req.body.nlp?.mapIntent) {
      req.app.locals.actions = Object.keys(nlp.mapIntent).map(intent => ({
        intent,
        action: nlp.mapIntent[intent],
        nl_phrase: steps?.find(step => step.function === nlp.mapIntent[intent])?.nl_phrase
      }));
    }

    logger.info('Ritual validation successful');
    next();
  } catch (err) {
    logger.error('Unexpected error in validateRitual:', err.message);
    const error = new Error('Internal server error');
    error.status = 500;
    next(error);
  }
};

/**
 * Example middleware to execute a ritual step (e.g., blockchain operation)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const executeRitualStep = async (req, res, next) => {
  try {
    const { ritualSteps } = req.app.locals;
    if (!ritualSteps.length) {
      logger.warn('No ritual steps to execute');
      return res.status(400).json({ error: 'No steps provided' });
    }

    // Example: Execute the first step (simplified)
    const step = ritualSteps[0];
    logger.info('Executing step:', { id: step.id, type: step.type, nl_phrase: step.nl_phrase });

    // Placeholder for blockchain or NLP logic
    if (step.type === 'blockchain_operation') {
      // Simulate blockchain call (replace with actual Web3.js or ethers.js logic)
      logger.info(`Executing blockchain operation: ${step.nl_phrase}`, step.params);
      req.app.locals.stepResult = { status: 'success', operation: step.id };
    } else if (step.type === 'call' && req.app.locals.nlpConfig) {
      // Simulate NLP-driven action
      logger.info(`Executing NLP call: ${step.nl_phrase}`, step.args);
      req.app.locals.stepResult = { status: 'success', call: step.function };
    }

    next();
  } catch (err) {
    logger.error('Error executing ritual step:', err.message);
    const error = new Error('Step execution failed');
    error.status = 500;
    next(error);
  }
};

module.exports = {
  validateRitual,
  executeRitualStep
};