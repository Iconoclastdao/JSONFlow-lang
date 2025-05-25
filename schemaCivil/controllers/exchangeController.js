const { v4: uuidv4 } = require('uuid');
const ajv = require('../config/ajv');
const logger = require('../config/logger');
let exchangeSchema;

try {
  exchangeSchema = require('../schema/exchange/exchange.schema.json');
} catch (error) {
  logger.error('Failed to load exchange.schema.json', { error: error.message });
  throw new Error('Critical schema missing: ../../schema/exchange/exchange.schema.json');
}

// Compile schema for validating exchange data
const validateExchangeData = ajv.compile(exchangeSchema);

class ExchangeController {
  constructor(chainAdapter) {
    if (!chainAdapter || typeof chainAdapter.logEvent !== 'function') {
      throw new Error('Valid chainAdapter required');
    }
    this.chainAdapter = chainAdapter;
    this.events = new Map(); // In-memory store for events
    this.auditLogs = new Map(); // In-memory store for audit logs
  }

  validateData(data) {
    const valid = validateExchangeData(data);
    if (!valid) {
      const error = new Error(`Data validation failed: ${JSON.stringify(validateExchangeData.errors, null, 2)}`);
      this.logAuditEvent('event_validation', 'failed', { error: error.message });
      throw error;
    }
    return valid;
  }

  async logAuditEvent(action, status, details) {
    const auditId = uuidv4();
    const auditLog = {
      id: auditId,
      action,
      timestamp: new Date().toISOString(),
      details: { status, ...details }
    };
    this.auditLogs.set(auditId, auditLog);
    this.validateData({ exchange: { events: [], auditLogs: [auditLog] } });
    return auditId;
  }

  async logComplianceEvent(eventType, userId, payload, context = {}) {
    try {
      const validEventTypes = [
        'post_published', 'comment_added', 'reaction_added', 'post_updated',
        'market_created', 'offer_created', 'offer_verified', 'offer_purchased',
        'user_registered', 'profile_updated', 'data_submitted', 'data_validated',
        'game_created', 'bet_placed', 'ritual_initiated', 'proposal_submitted'
      ];
      if (!validEventTypes.includes(eventType)) {
        throw new Error(`Invalid event type: ${eventType}`);
      }
      if (!userId || !/^(0x)?[0-9a-fA-F]{40}$/.test(userId)) {
        throw new Error('Invalid userId: must be a valid Ethereum address');
      }
      if (!context.module || !['feed', 'market', 'identity', 'oracle', 'casino', 'ritual', 'governance'].includes(context.module)) {
        throw new Error('Invalid or missing context.module');
      }

      const eventId = uuidv4();
      const event = {
        id: eventId,
        eventType,
        userId,
        payload: typeof payload === 'string' ? payload : { ...payload, metadata: payload.metadata || {} },
        createdAt: new Date().toISOString(),
        context: {
          soulboundId: context.soulboundId || 'default-soulbound-id',
          transactionId: context.transactionId || null,
          module: context.module
        }
      };

      this.validateData({ exchange: { events: [event], auditLogs: [] } });
      this.events.set(eventId, event);

      // Log to blockchain via ChainAdapter
      const blockchainResult = await this.chainAdapter.logEvent(eventId, event);
      if (!blockchainResult.success) {
        await this.logAuditEvent('blockchain_submission', 'failed', { error: 'Blockchain submission failed', transactionId: blockchainResult.transactionId });
        throw new Error(`Failed to log event to blockchain: ${blockchainResult.error || 'Unknown error'}`);
      }

      await this.logAuditEvent('blockchain_submission', 'success', { transactionId: blockchainResult.transactionId });
      return { id: eventId, success: true, transactionId: blockchainResult.transactionId };
    } catch (error) {
      await this.logAuditEvent('error_handling', 'failed', { error: error.message, eventType, userId });
      throw Object.assign(error, { status: 400 });
    }
  }
}

module.exports = ExchangeController;