const { v4: uuidv4 } = require('uuid');
const ajv = require('../config/ajv');
const marketSchema = require('../schema/market/market.schema.json');

// Compile schema for validating market data
const validateMarketData = ajv.compile(marketSchema);

// Input validation schemas for request bodies
const createMarketSchema = {
  type: 'object',
  required: ['title', 'market'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string', minLength: 1 },
    market: {
      type: 'object',
      required: ['offers', 'allowUserListings', 'karmaWage'],
      properties: {
        offers: {
          type: 'array',
          items: {
            type: 'object',
            required: ['agent', 'soulboundId', 'title', 'price', 'currency'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              agent: { type: 'string', minLength: 1 },
              soulboundId: { type: 'string', minLength: 1 },
              title: { type: 'string', minLength: 1 },
              price: { type: 'number', minimum: 0 },
              currency: { type: 'string', minLength: 1 },
              expiry: { type: 'string', format: 'date-time' },
              accessPayload: {
                type: 'object',
                properties: { data: { type: ['string', 'object', 'null'] } },
                additionalProperties: false
              }
            },
            additionalProperties: false
          }
        },
        allowUserListings: { type: 'boolean' },
        karmaWage: { type: 'number', minimum: 0 },
        feeStructure: { type: 'object' },
        transactionHooks: {
          type: 'object',
          properties: {
            onVerify: { type: ['string', 'null'] },
            onBuy: { type: ['string', 'null'] },
            onExpire: { type: ['string', 'null'] }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

const createOfferSchema = {
  type: 'object',
  required: ['agent', 'soulboundId', 'title', 'price', 'currency'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    agent: { type: 'string', minLength: 1 },
    soulboundId: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1 },
    price: { type: 'number', minimum: 0 },
    currency: { type: 'string', minLength: 1 },
    expiry: { type: 'string', format: 'date-time' },
    accessPayload: {
      type: 'object',
      properties: { data: { type: ['string', 'object', 'null'] } },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

const verifyOfferSchema = {
  type: 'object',
  required: ['offerId'],
  properties: {
    offerId: { type: 'string', format: 'uuid' }
  },
  additionalProperties: false
};

const purchaseOfferSchema = {
  type: 'object',
  required: ['offerId', 'buyerId', 'buyerSoulboundId'],
  properties: {
    offerId: { type: 'string', format: 'uuid' },
    buyerId: { type: 'string', minLength: 1 },
    buyerSoulboundId: { type: 'string', minLength: 1 }
  },
  additionalProperties: false
};

const checkExpiredOffersSchema = {
  type: 'object',
  required: [],
  properties: {},
  additionalProperties: false
};

const validateCreateMarket = ajv.compile(createMarketSchema);
const validateCreateOffer = ajv.compile(createOfferSchema);
const validateVerifyOffer = ajv.compile(verifyOfferSchema);
const validatePurchaseOffer = ajv.compile(purchaseOfferSchema);
const validateCheckExpiredOffers = ajv.compile(checkExpiredOffersSchema);

class MarketController {
  constructor(exchangeController, chainAdapter) {
    if (!exchangeController || typeof exchangeController.logComplianceEvent !== 'function') {
      throw new Error('Valid exchangeController required');
    }
    if (!chainAdapter || typeof chainAdapter.verifySoulboundId !== 'function') {
      throw new Error('Valid chainAdapter required');
    }
    this.exchangeController = exchangeController;
    this.chainAdapter = chainAdapter;
    this.markets = new Map();
  }

  validateData(data) {
    const valid = validateMarketData(data);
    if (!valid) {
      throw new Error(`Data validation failed: ${JSON.stringify(validateMarketData.errors, null, 2)}`);
    }
    return valid;
  }

  async createMarket(req, res) {
    try {
      if (!validateCreateMarket(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(validateCreateMarket.errors, null, 2)}`);
      }

      const data = req.body;
      const marketId = data.id || uuidv4();
      const market = {
        ...data,
        id: marketId,
        type: 'market',
        createdAt: new Date().toISOString(),
        market: {
          ...data.market,
          offers: data.market.offers || []
        }
      };

      for (const offer of market.market.offers) {
        const isValidSoulbound = await this.chainAdapter.verifySoulboundId(offer.agent, offer.soulboundId);
        if (!isValidSoulbound) {
          throw new Error(`Invalid soulbound ID for agent ${offer.agent}`);
        }
        offer.id = offer.id || uuidv4();
        offer.createdAt = new Date().toISOString();
        offer.verified = false;
        offer.expiry = offer.expiry || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }

      this.markets.set(marketId, market);
      this.validateData(market);
      await this.chainAdapter.registerMarket(marketId, market);
      await this.exchangeController.logComplianceEvent(
        'market_created',
        'system',
        JSON.stringify({ id: marketId, title: market.title })
      );
      res.status(201).json({ id: marketId });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async getMarket(req, res) {
    try {
      const marketId = req.params.id;
      if (!ajv.validate({ type: 'string', format: 'uuid' }, marketId)) {
        throw new Error('Invalid marketId: must be a UUID');
      }

      const market = this.markets.get(marketId);
      if (!market) {
        throw new Error('Market not found');
      }
      res.status(200).json(market);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  async createOffer(req, res) {
    try {
      if (!validateCreateOffer(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(validateCreateOffer.errors, null, 2)}`);
      }

      const marketId = req.params.marketId;
      if (!ajv.validate({ type: 'string', format: 'uuid' }, marketId)) {
        throw new Error('Invalid marketId: must be a UUID');
      }

      const market = this.markets.get(marketId);
      if (!market) {
        throw new Error('Market not found');
      }
      if (!market.market.allowUserListings) {
        throw new Error('User listings not allowed');
      }

      const offerData = req.body;
      const isValidSoulbound = await this.chainAdapter.verifySoulboundId(offerData.agent, offerData.soulboundId);
      if (!isValidSoulbound) {
        throw new Error(`Invalid soulbound ID for agent ${offerData.agent}`);
      }

      const offerId = offerData.id || uuidv4();
      const offer = {
        ...offerData,
        id: offerId,
        createdAt: new Date().toISOString(),
        verified: false,
        expiry: offerData.expiry || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      market.market.offers.push(offer);
      this.validateData(market);
      await this.chainAdapter.distributeKarmaWage(offer.agent, market.market.karmaWage);
      await this.chainAdapter.registerOffer(marketId, offer);
      await this.exchangeController.logComplianceEvent(
        'offer_created',
        offer.agent,
        JSON.stringify({ marketId, offerId, title: offer.title })
      );
      res.status(201).json({ id: offerId });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async verifyOffer(req, res) {
    try {
      if (!validateVerifyOffer(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(validateVerifyOffer.errors, null, 2)}`);
      }

      const marketId = req.params.marketId;
      if (!ajv.validate({ type: 'string', format: 'uuid' }, marketId)) {
        throw new Error('Invalid marketId: must be a UUID');
      }

      const { offerId } = req.body;
      const market = this.markets.get(marketId);
      if (!market) {
        throw new Error('Market not found');
      }

      const offer = market.market.offers.find(o => o.id === offerId);
      if (!offer) {
        throw new Error('Offer not found');
      }

      if (market.market.transactionHooks?.onVerify) {
        await this.chainAdapter.executeHook(market.market.transactionHooks.onVerify, { marketId, offerId });
      }

      offer.verified = true;
      this.validateData(market);
      await this.chainAdapter.updateOffer(marketId, offer);
      await this.exchangeController.logComplianceEvent(
        'offer_verified',
        'system',
        JSON.stringify({ marketId, offerId })
      );
      res.status(200).json({ message: 'Offer verified' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async purchaseOffer(req, res) {
    try {
      if (!validatePurchaseOffer(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(validatePurchaseOffer.errors, null, 2)}`);
      }

      const marketId = req.params.marketId;
      if (!ajv.validate({ type: 'string', format: 'uuid' }, marketId)) {
        throw new Error('Invalid marketId: must be a UUID');
      }

      const { offerId, buyerId, buyerSoulboundId } = req.body;
      const market = this.markets.get(marketId);
      if (!market) {
        throw new Error('Market not found');
      }

      const offer = market.market.offers.find(o => o.id === offerId);
      if (!offer || !offer.verified) {
        throw new Error('Offer not found or not verified');
      }

      const isValidSoulbound = await this.chainAdapter.verifySoulboundId(buyerId, buyerSoulboundId);
      if (!isValidSoulbound) {
        throw new Error(`Invalid soulbound ID for buyer ${buyerId}`);
      }

      await this.chainAdapter.processPayment(buyerId, offer.agent, offer.price, offer.currency, market.market.feeStructure);
      if (market.market.transactionHooks?.onBuy) {
        await this.chainAdapter.executeHook(market.market.transactionHooks.onBuy, { marketId, offerId, buyerId });
      }

      await this.chainAdapter.updateReputation(offer.agent, 1);
      await this.chainAdapter.distributeKarmaWage(buyerId, market.market.karmaWage);
      await this.exchangeController.logComplianceEvent(
        'offer_purchased',
        buyerId,
        JSON.stringify({ marketId, offerId, buyerId })
      );
      res.status(200).json({ message: 'Purchase successful', accessPayload: offer.accessPayload });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async checkExpiredOffers(req, res) {
    try {
      if (!validateCheckExpiredOffers(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(validateCheckExpiredOffers.errors, null, 2)}`);
      }

      const marketId = req.params.marketId;
      if (!ajv.validate({ type: 'string', format: 'uuid' }, marketId)) {
        throw new Error('Invalid marketId: must be a UUID');
      }

      const market = this.markets.get(marketId);
      if (!market) {
        throw new Error('Market not found');
      }

      const now = new Date();
      const expiredOffers = [];
      for (const offer of market.market.offers) {
        if (offer.expiry && new Date(offer.expiry) < now) {
          if (market.market.transactionHooks?.onExpire) {
            await this.chainAdapter.executeHook(market.market.transactionHooks.onExpire, { marketId, offerId: offer.id });
          }
          await this.exchangeController.logComplianceEvent(
            'offer_expired',
            'system',
            JSON.stringify({ marketId, offerId: offer.id })
          );
          expiredOffers.push(offer.id);
        }
      }

      market.market.offers = market.market.offers.filter(o => !expiredOffers.includes(o.id));
      this.validateData(market);
      res.status(200).json({ message: 'Expired offers processed', expired: expiredOffers });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = MarketController;