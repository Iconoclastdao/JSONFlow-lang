const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const glob = require('glob');
const ajv = require('../config/ajv');
const logger = require('../config/logger');
const errorHandler = require('../middleware/errorHandler');
const { executeJSONFlow } = require('../jsonflow-executor');
const router = express.Router();

// Initialize controllers
const ExchangeController = require('../controllers/exchangeController');
const ChainAdapter = require('../adapters/chainAdapter');
const agentController = require('../controllers/agentController');
const apiController = require('../controllers/apiController');
const casinoController = require('../controllers/casinoController');
const ritualController = require('../controllers/ritualController');
const governanceController = require('../controllers/governanceController');
const FeedController = require('../controllers/feedController');
const MarketController = require('../controllers/marketController');

// Instantiate controllers
const exchangeController = new ExchangeController(); // Replace with actual initialization
const chainAdapter = new ChainAdapter(); // Replace with actual initialization
const feedController = new FeedController(exchangeController, chainAdapter);
const marketController = new MarketController(exchangeController, chainAdapter);

const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return next(Object.assign(new Error('Missing JWT token'), { status: 401 }));
  }
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is missing');
    }
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    next(Object.assign(error, { status: 403 }));
  }
};

// Load schemas
const schemaDir = path.join(__dirname, '../schema');
const schemas = {};
const criticalSchemas = ['sovereign-api', 'agent', 'ritual', 'governance', 'oracle', 'casino', 'market', 'feed'];
glob.sync(`${schemaDir}/**/*.schema.json`).forEach(file => {
  try {
    const schema = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const schemaName = path.basename(file, '.schema.json');
    schemas[schemaName] = schema;
    if (criticalSchemas.includes(schemaName)) {
      logger.info(`Loaded critical schema: ${schemaName}`);
      ajv.addSchema(schema, schema.$id || schemaName);
    }
  } catch (error) {
    const schemaName = path.basename(file, '.schema.json');
    if (criticalSchemas.includes(schemaName)) {
      logger.error(`Critical schema load error: ${file}`, { error: error.message });
      process.exit(1);
    } else {
      logger.warn(`Schema load error: ${file}`, { error: error.message });
    }
  }
});

const getSchemaValidator = (schemaName, module, action) => {
  if (!schemas[schemaName]) {
    logger.warn(`Schema ${schemaName} not found`);
    return () => true;
  }
  const schema = module && action
    ? schemas[schemaName].properties?.[module]?.properties?.[action] || schemas[schemaName]
    : schemas[schemaName];
  return schema ? ajv.compile(schema) : () => true;
};

const validateWith = (schemaName, module, action) => {
  const validate = getSchemaValidator(schemaName, module, action);
  return (req, res, next) => {
    if (!validate(req.body)) {
      logger.warn(`Schema validation failed for ${schemaName}.${module}.${action}`, { errors: validate.errors });
      return res.status(400).json({ errors: validate.errors });
    }
    next();
  };
};

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`Request validation failed`, { errors: errors.array() });
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// 🔐 Identity
router.post(
  '/identity/register',
  body('username').isString().notEmpty().trim(),
  body('publicKey').isString().notEmpty().matches(/^(0x)?[0-9a-fA-F]{40}$/),
  validateRequest,
  validateWith('agent', 'identity', 'register'),
  async (req, res, next) => {
    try {
      const result = await agentController.register(req.body);
      res.status(201).json({ message: 'User registered', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/identity/authenticate',
  body('username').isString().notEmpty().trim(),
  body('signature').isString().notEmpty().matches(/^(0x)?[0-9a-fA-F]{128}$/),
  validateRequest,
  validateWith('agent', 'identity', 'authenticate'),
  async (req, res, next) => {
    try {
      const result = await agentController.authenticate(req.body);
      res.status(200).json({ message: 'User authenticated', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/identity/updateProfile',
  authenticateJWT,
  body('username').isString().notEmpty().trim(),
  body('profileData').isObject(),
  validateRequest,
  validateWith('agent', 'identity', 'updateProfile'),
  async (req, res, next) => {
    try {
      const result = await agentController.updateProfile(req.body);
      res.status(200).json({ message: 'Profile updated', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/identity/reputation',
  authenticateJWT,
  async (req, res, next) => {
    try {
      const result = await executeJSONFlow({ workflow: 'identity-reputation', params: { username: req.user.username } });
      res.status(200).json({ message: 'Reputation retrieved', data: result });
    } catch (e) {
      next(e);
    }
  }
);

// 🔮 Oracle
router.post(
  '/oracle/submitData',
  authenticateJWT,
  body('data').isString().notEmpty(),
  body('signature').isString().notEmpty().matches(/^(0x)?[0-9a-fA-F]{128}$/),
  validateRequest,
  validateWith('oracle', 'oracle', 'submitData'),
  async (req, res, next) => {
    try {
      const result = await apiController.submitData(req.body);
      res.status(201).json({ message: 'Data submitted', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/oracle/validateData',
  authenticateJWT,
  body('dataId').isString().notEmpty().isUUID(),
  validateRequest,
  validateWith('oracle', 'oracle', 'validateData'),
  async (req, res, next) => {
    try {
      const result = await apiController.validateData(req.body);
      res.status(200).json({ message: 'Data validated', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/oracle/updateData',
  authenticateJWT,
  body('dataId').isString().notEmpty().isUUID(),
  body('data').isString().notEmpty(),
  validateRequest,
  validateWith('oracle', 'oracle', 'updateData'),
  async (req, res, next) => {
    try {
      const result = await apiController.updateData(req.body);
      res.status(200).json({ message: 'Data updated', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/oracle/consensus',
  authenticateJWT,
  async (req, res, next) => {
    try {
      const result = await executeJSONFlow({ workflow: 'oracle-consensus', params: req.query });
      res.status(200).json({ message: 'Consensus retrieved', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/oracle/rewards',
  authenticateJWT,
  body('dataId').isString().notEmpty().isUUID(),
  validateRequest,
  validateWith('oracle', 'oracle', 'rewards'),
  async (req, res, next) => {
    try {
      const result = await apiController.rewards(req.body);
      res.status(200).json({ message: 'Rewards distributed', data: result });
    } catch (e) {
      next(e);
    }
  }
);

// 🎲 Casino
router.post(
  '/casino/createGame',
  authenticateJWT,
  body('gameType').isString().notEmpty().isIn(['slot', 'poker', 'roulette']),
  validateRequest,
  validateWith('casino', 'casino', 'createGame'),
  async (req, res, next) => {
    try {
      const result = await casinoController.createGame(req.body);
      res.status(201).json({ message: 'Game created', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/casino/play',
  authenticateJWT,
  body('gameId').isString().notEmpty().isUUID(),
  body('wager').isNumeric().isFloat({ min: 0 }),
  validateRequest,
  validateWith('casino', 'casino', 'placeBet'),
  async (req, res, next) => {
    try {
      const result = await casinoController.placeBet(req.body);
      res.status(200).json({ message: 'Bet placed', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/casino/resolveGame',
  authenticateJWT,
  body('gameId').isString().notEmpty().isUUID(),
  validateRequest,
  validateWith('casino', 'casino', 'resolveGame'),
  async (req, res, next) => {
    try {
      const result = await casinoController.resolveGame(req.body);
      res.status(200).json({ message: 'Game resolved', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/casino/updateGame',
  authenticateJWT,
  body('gameId').isString().notEmpty().isUUID(),
  body('updates').isObject(),
  validateRequest,
  validateWith('casino', 'casino', 'updateGame'),
  async (req, res, next) => {
    try {
      const result = await casinoController.updateGame(req.body);
      res.status(200).json({ message: 'Game updated', data: result });
    } catch (e) {
      next(e);
    }
  }
);

// 🏛️ Market
router.post(
  '/market/create',
  authenticateJWT,
  body('title').isString().notEmpty().trim(),
  body('market.allowUserListings').isBoolean(),
  body('market.karmaWage').isNumeric().isFloat({ min: 0 }),
  validateRequest,
  validateWith('market', 'market', 'createMarket'),
  async (req, res, next) => {
    try {
      const result = await marketController.createMarket(req, res);
      res.status(201).json({ message: 'Market created', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/market/:id',
  authenticateJWT,
  async (req, res, next) => {
    try {
      const result = await marketController.getMarket(req, res);
      res.status(200).json({ message: 'Market retrieved', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/market/:marketId/offer',
  authenticateJWT,
  body('agent').isString().notEmpty().trim(),
  body('soulboundId').isString().notEmpty().trim(),
  body('title').isString().notEmpty().trim(),
  body('price').isNumeric().isFloat({ min: 0 }),
  body('currency').isString().notEmpty().isIn(['USD', 'ETH', 'BTC']),
  body('expiry').isString().isISO8601().toDate(),
  validateRequest,
  validateWith('market', 'market', 'createOffer'),
  async (req, res, next) => {
    try {
      const result = await marketController.createOffer(req, res);
      res.status(201).json({ message: 'Offer created', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/market/:marketId/verifyOffer',
  authenticateJWT,
  body('offerId').isString().notEmpty().isUUID(),
  validateRequest,
  validateWith('market', 'market', 'verifyOffer'),
  async (req, res, next) => {
    try {
      const result = await marketController.verifyOffer(req, res);
      res.status(200).json({ message: 'Offer verified', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/market/:marketId/purchaseOffer',
  authenticateJWT,
  body('offerId').isString().notEmpty().isUUID(),
  body('buyerId').isString().notEmpty().trim(),
  body('buyerSoulboundId').isString().notEmpty().trim(),
  validateRequest,
  validateWith('market', 'market', 'purchaseOffer'),
  async (req, res, next) => {
    try {
      const result = await marketController.purchaseOffer(req, res);
      res.status(200).json({ message: 'Offer purchased', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/market/:marketId/checkExpiredOffers',
  authenticateJWT,
  validateRequest,
  validateWith('market', 'market', 'checkExpiredOffers'),
  async (req, res, next) => {
    try {
      const result = await marketController.checkExpiredOffers(req, res);
      res.status(200).json({ message: 'Expired offers processed', data: result });
    } catch (e) {
      next(e);
    }
  }
);

// 📡 Feed
router.post(
  '/feed/publish',
  authenticateJWT,
  body('channel').isString().notEmpty().trim(),
  body('payload.content').isString().notEmpty().trim(),
  body('payload.metadata').isObject().optional(),
  validateRequest,
  validateWith('feed', 'feed', 'publish'),
  async (req, res, next) => {
    try {
      await feedController.publish(req, res);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/feed/comment',
  authenticateJWT,
  body('postId').isString().notEmpty().isUUID(),
  body('comment').isString().notEmpty().trim(),
  validateRequest,
  validateWith('feed', 'feed', 'comment'),
  async (req, res, next) => {
    try {
      await feedController.comment(req, res);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/feed/react',
  authenticateJWT,
  body('postId').isString().notEmpty().isUUID(),
  body('reaction').isString().notEmpty().isIn(['like', 'love', 'dislike', 'share']),
  validateRequest,
  validateWith('feed', 'feed', 'react'),
  async (req, res, next) => {
    try {
      await feedController.react(req, res);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/feed/updatePost',
  authenticateJWT,
  body('postId').isString().notEmpty().isUUID(),
  body('updates.content').isString().notEmpty().trim().optional(),
  body('updates.metadata').isObject().optional(),
  validateRequest,
  validateWith('feed', 'feed', 'updatePost'),
  async (req, res, next) => {
    try {
      await feedController.updatePost(req, res);
    } catch (e) {
      next(e);
    }
  }
);

// 🔥 Ritual
router.post(
  '/ritual/initiate',
  authenticateJWT,
  body('ritualType').isString().notEmpty().trim(),
  body('participants').isArray().isLength({ min: 1 }),
  validateRequest,
  validateWith('ritual', 'ritual', 'initiate'),
  async (req, res, next) => {
    try {
      const result = await ritualController.initiate(req.body);
      res.status(201).json({ message: 'Ritual initiated', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/ritual/execute',
  authenticateJWT,
  body('ritualId').isString().notEmpty().isUUID(),
  body('inputs').isObject(),
  validateRequest,
  validateWith('ritual', 'ritual', 'execute'),
  async (req, res, next) => {
    try {
      const result = await ritualController.execute(req.body);
      res.status(200).json({ message: 'Ritual executed', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/ritual/complete',
  authenticateJWT,
  body('ritualId').isString().notEmpty().isUUID(),
  validateRequest,
  validateWith('ritual', 'ritual', 'complete'),
  async (req, res, next) => {
    try {
      const result = await ritualController.complete(req.body);
      res.status(200).json({ message: 'Ritual completed', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/ritual/status',
  authenticateJWT,
  async (req, res, next) => {
    try {
      const result = await executeJSONFlow({ workflow: 'ritual-status', params: req.query });
      res.status(200).json({ message: 'Ritual status retrieved', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/ritual/updateStatus',
  authenticateJWT,
  body('ritualId').isString().notEmpty().isUUID(),
  body('status').isString().notEmpty().trim(),
  validateRequest,
  validateWith('ritual', 'ritual', 'updateStatus'),
  async (req, res, next) => {
    try {
      const result = await ritualController.updateStatus(req.body);
      res.status(200).json({ message: 'Ritual status updated', data: result });
    } catch (e) {
      next(e);
    }
  }
);

// 🗳️ Governance
router.post(
  '/governance/propose',
  authenticateJWT,
  body('proposal').isObject().notEmpty(),
  validateRequest,
  validateWith('governance', 'governance', 'propose'),
  async (req, res, next) => {
    try {
      const result = await governanceController.propose(req.body);
      res.status(201).json({ message: 'Proposal submitted', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/governance/vote',
  authenticateJWT,
  body('proposalId').isString().notEmpty().isUUID(),
  body('vote').isString().notEmpty().isIn(['yes', 'no', 'abstain']),
  validateRequest,
  validateWith('governance', 'governance', 'vote'),
  async (req, res, next) => {
    try {
      const result = await governanceController.vote(req.body);
      res.status(200).json({ message: 'Vote cast', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/governance/execute',
  authenticateJWT,
  body('proposalId').isString().notEmpty().isUUID(),
  validateRequest,
  validateWith('governance', 'governance', 'execute'),
  async (req, res, next) => {
    try {
      const result = await governanceController.execute(req.body);
      res.status(200).json({ message: 'Proposal executed', data: result });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/governance/updateProposal',
  authenticateJWT,
  body('proposalId').isString().notEmpty().isUUID(),
  body('updates').isObject().notEmpty(),
  validateRequest,
  validateWith('governance', 'governance', 'updateProposal'),
  async (req, res, next) => {
    try {
      const result = await governanceController.updateProposal(req.body);
      res.status(200).json({ message: 'Proposal updated', data: result });
    } catch (e) {
      next(e);
    }
  }
);

// Error middleware
router.use(errorHandler);

module.exports = router;