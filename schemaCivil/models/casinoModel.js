const crypto = require('crypto');
const Ajv = require('ajv');
const casinoSchema = require('./casino.schema.json');

class CasinoModel {
  constructor(stateStore, blockchainClient) {
    this.ajv = new Ajv({ allErrors: true });
    this.validate = this.ajv.compile(casinoSchema);
    this.stateStore = stateStore || { store: 'in-memory', data: { games: [], bets: [] } };
    this.blockchainClient = blockchainClient || { logTransaction: async () => {} };
    this.casinoData = {
      function: 'casinoModule',
      schema: {
        inputs: { createGame: {}, placeBet: {}, resolveGame: {} },
        outputs: { gameResult: {}, betResult: {} }
      },
      metadata: {
        schema_version: '5.3.1',
        version: '1.0.0',
        author: 'xAI Team',
        description: 'Casino module for game creation and betting.',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ['casino', 'blockchain', 'betting'],
        examples: ['https://github.com/xai/casino-examples'],
        docs: 'https://docs.xai/casino',
        tooling: ['vscode', 'jsonflow-cli'],
        compliance: ['GDPR', 'PCI-DSS'],
        license: 'MIT'
      },
      security: {
        authentication: { type: 'jwt', provider: 'auth0' },
        authorization: { type: 'rbac', roles: ['player', 'admin'], permissions: ['create_game', 'place_bet', 'resolve_game'] },
        encryption: { algorithm: 'AES-256', key_management: 'vault' },
        secrets: { manager: 'hashicorp-vault', refs: ['casino_key_ref'] }
      },
      observability: {
        logging: { provider: 'loki', level: 'info' },
        metrics: { provider: 'prometheus', endpoints: ['http://metrics.sovereign.local/casino'] },
        tracing: { provider: 'opentelemetry', sampling_rate: 1 },
        telemetry: { provider: 'opentelemetry' }
      },
      orchestration: { type: 'sequential', runtime: 'nodejs' },
      blockchain: {
        chain: 'ethereum',
        network: { rpc_url: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID', chain_id: 1 }
      }
    };
    this.validateData(this.casinoData);
  }

  validateData(data) {
    if (!this.validate(data)) {
      throw new Error(`Data validation failed: ${JSON.stringify(this.validate.errors, null, 2)}`);
    }
    return true;
  }

  async createGame(game) {
    const gameData = {
      id: crypto.randomUUID(),
      ...game,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    this.casinoData.schema.outputs.gameResult = gameData;
    this.stateStore.data.games.push(gameData);
    await this.blockchainClient.logTransaction('game_created', { game: gameData.id });
    this.validateData(this.casinoData);
    return gameData;
  }

  async placeBet(bet) {
    const betData = {
      id: crypto.randomUUID(),
      ...bet,
      status: 'placed',
      timestamp: new Date().toISOString()
    };
    this.casinoData.schema.outputs.betResult = betData;
    this.stateStore.data.bets.push(betData);
    await this.blockchainClient.logTransaction('bet_placed', { bet: betData.id });
    this.validateData(this.casinoData);
    return betData;
  }

  async resolveGame(gameId, userId) {
    const game = this.stateStore.data.games.find(g => g.id === gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    game.status = 'resolved';
    game.updatedAt = new Date().toISOString();
    this.casinoData.schema.outputs.gameResult = game;
    await this.blockchainClient.logTransaction('game_resolved', { game: gameId, user: userId });
    this.validateData(this.casinoData);
    return game;
  }

  async getGameBets(gameId) {
    return this.stateStore.data.bets.filter(b => b.gameId === gameId);
  }

  getCasinoData() {
    return this.casinoData;
  }
}

module.exports = CasinoModel;