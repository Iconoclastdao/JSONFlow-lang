const CasinoModel = require('./casinoModel');
const Ajv = require('ajv');

class CasinoController {
  constructor(exchangeController, stateStore, blockchainClient) {
    if (!exchangeController || typeof exchangeController.logComplianceEvent !== 'function') {
      throw new Error('Valid exchangeController required');
    }
    this.ajv = new Ajv({ allErrors: true });
    this.model = new CasinoModel(stateStore, blockchainClient);
    this.exchangeController = exchangeController;

    this.createGameSchema = {
      type: 'object',
      required: ['gameType', 'parameters', 'userId'],
      properties: {
        gameType: { type: 'string', enum: ['dice', 'roulette', 'slots'] },
        parameters: { type: 'object' },
        userId: { type: 'string', format: 'uuid' }
      },
      additionalProperties: false
    };

    this.placeBetSchema = {
      type: 'object',
      required: ['gameId', 'amount', 'userId'],
      properties: {
        gameId: { type: 'string', format: 'uuid' },
        amount: { type: 'number', minimum: 0.01 },
        userId: { type: 'string', format: 'uuid' }
      },
      additionalProperties: false
    };

    this.resolveGameSchema = {
      type: 'object',
      required: ['gameId', 'userId'],
      properties: {
        gameId: { type: 'string', format: 'uuid' },
        userId: { type: 'string', format: 'uuid' }
      },
      additionalProperties: false
    };

    this.validateCreateGame = this.ajv.compile(this.createGameSchema);
    this.validatePlaceBet = this.ajv.compile(this.placeBetSchema);
    this.validateResolveGame = this.ajv.compile(this.resolveGameSchema);
  }

  async createGame(req, res) {
    try {
      if (!this.validateCreateGame(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(this.validateCreateGame.errors, null, 2)}`);
      }

      const { gameType, parameters, userId } = req.body;
      const game = await this.model.createGame({ gameType, parameters, userId });
      await this.exchangeController.logComplianceEvent(
        'game_created',
        userId,
        JSON.stringify({ gameId: game.id, gameType })
      );
      res.status(201).json(game);
    } catch (error) {
      await this.exchangeController.logComplianceEvent('error', 'system', JSON.stringify({ error: error.message }));
      res.status(400).json({ message: error.message });
    }
  }

  async placeBet(req, res) {
    try {
      if (!this.validatePlaceBet(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(this.validatePlaceBet.errors, null, 2)}`);
      }

      const { gameId, amount, userId } = req.body;
      const game = this.model.getCasinoData().schema.outputs.gameResult;
      if (!game || game.id !== gameId || game.status !== 'active') {
        throw new Error('Invalid or inactive game');
      }

      const bet = await this.model.placeBet({ gameId, amount, userId });
      await this.exchangeController.logComplianceEvent(
        'bet_placed',
        userId,
        JSON.stringify({ gameId, amount })
      );
      res.status(201).json(bet);
    } catch (error) {
      await this.exchangeController.logComplianceEvent('error', 'system', JSON.stringify({ error: error.message }));
      res.status(400).json({ message: error.message });
    }
  }

  async resolveGame(req, res) {
    try {
      if (!this.validateResolveGame(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(this.validateResolveGame.errors, null, 2)}`);
      }

      const { gameId, userId } = req.body;
      const game = await this.model.resolveGame(gameId, userId);
      await this.exchangeController.logComplianceEvent(
        'game_resolved',
        userId,
        JSON.stringify({ gameId })
      );
      res.status(200).json(game);
    } catch (error) {
      await this.exchangeController.logComplianceEvent('error', 'system', JSON.stringify({ error: error.message }));
      res.status(400).json({ message: error.message });
    }
  }

  async getGameBets(req, res) {
    try {
      const gameId = req.params.id;
      if (!this.ajv.validate({ type: 'string', format: 'uuid' }, gameId)) {
        throw new Error('Invalid gameId: must be a UUID');
      }

      const bets = await this.model.getGameBets(gameId);
      res.status(200).json(bets);
    } catch (error) {
      await this.exchangeController.logComplianceEvent('error', 'system', JSON.stringify({ error: error.message }));
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = CasinoController;