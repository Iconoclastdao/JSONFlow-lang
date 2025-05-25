const DashboardsModel = require('../models/dashboardsModel');
const Ajv = require('ajv');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

class DashboardsController {
  constructor(exchangeModel, chainAdapter, casinoController) {
    this.ajv = new Ajv({ allErrors: true, useDefaults: true });
    this.model = new DashboardsModel(chainAdapter, exchangeModel, casinoController.model);
    this.exchangeModel = exchangeModel;
    this.chainAdapter = chainAdapter;
    this.casinoController = casinoController;

    this.createDashboardSchema = {
      type: 'object',
      required: ['owner', 'soulboundId', 'title', 'layout', 'governance', 'chainConfig'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        owner: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
        soulboundId: { type: 'string', minLength: 1 },
        title: { type: 'string', minLength: 1 },
        description: { type: 'string' },
        layout: {
          type: 'object',
          required: ['x', 'y', 'w', 'h'],
          properties: {
            x: { type: 'integer', minimum: 0 },
            y: { type: 'integer', minimum: 0 },
            w: { type: 'integer', minimum: 1 },
            h: { type: 'integer', minimum: 1 }
          }
        },
        widgets: { type: 'array', items: { type: 'object' } },
        karmaWage: {
          type: 'object',
          required: ['amount', 'currency'],
          properties: {
            amount: { type: 'number', minimum: 0 },
            currency: { type: 'string' },
            frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] }
          }
        },
        governance: {
          type: 'object',
          required: ['votingContract', 'disputeResolution'],
          properties: {
            votingContract: { type: 'string' },
            proposalThreshold: { type: 'number', minimum: 0 },
            disputeResolution: { type: 'string', enum: ['arbitration', 'voting', 'oracle'] }
          }
        },
        chainConfig: {
          type: 'object',
          required: ['chains'],
          properties: {
            chains: { type: 'array', items: { type: 'string', enum: ['ethereum'] }, minItems: 1 },
            bridgeContract: { type: 'string' }
          }
        }
      },
      additionalProperties: false
    };

    this.addWidgetSchema = {
      type: 'object',
      required: ['type', 'dataSource'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        type: { type: 'string', enum: ['casino-games', 'casino-bets', 'casino-stats', 'nl'] },
        dataSource: {
          type: 'object',
          required: ['type', 'id'],
          properties: {
            type: { type: 'string', enum: ['casino', 'nl'] },
            id: { type: 'string' },
            query: { type: 'string' }
          }
        },
        config: {
          type: 'object',
          properties: {
            refreshInterval: { type: 'integer', minimum: 0 },
            displayMode: { type: 'string', enum: ['table', 'chart', 'list', 'card'] },
            responsive: { type: 'boolean' }
          }
        },
        layout: {
          type: 'object',
          required: ['x', 'y', 'w', 'h'],
          properties: {
            x: { type: 'integer', minimum: 0 },
            y: { type: 'integer', minimum: 0 },
            w: { type: 'integer', minimum: 1 },
            h: { type: 'integer', minimum: 1 }
          }
        },
        nl: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['chat', 'command'] },
            model: { type: 'string', minLength: 1 },
            bindingTarget: { type: 'string', minLength: 1 },
            mapIntent: { type: 'object' },
            language: { type: 'string' },
            history: { type: 'boolean' },
            contextWindow: { type: 'integer', minimum: 0 },
            confidenceThreshold: { type: 'number', minimum: 0, maximum: 1 },
            fallbackAction: { type: 'string' }
          }
        }
      },
      additionalProperties: false
    };

    this.validateCreateDashboard = this.ajv.compile(this.createDashboardSchema);
    this.validateAddWidget = this.ajv.compile(this.addWidgetSchema);
  }

  async createDashboard(req, res) {
    try {
      if (!this.validateCreateDashboard(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(this.validateCreateDashboard.errors, null, 2)}`);
      }

      const dashboard = await this.model.createDashboard(req.body);
      res.status(201).json({ id: dashboard.id });
    } catch (error) {
      logger.error(`Create dashboard error: ${error.message}`);
      throw error; // Handled by errorHandler middleware
    }
  }

  async getDashboard(req, res) {
    try {
      const dashboard = await this.model.getDashboard(req.params.id);
      res.status(200).json(dashboard);
    } catch (error) {
      logger.error(`Get dashboard error: ${error.message}`);
      throw error;
    }
  }

  async addWidget(req, res) {
    try {
      if (!this.validateAddWidget(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(this.validateAddWidget.errors, null, 2)}`);
      }

      const widget = await this.model.addWidget(req.params.id, req.body);
      res.status(201).json({ id: widget.id });
    } catch (error) {
      logger.error(`Add widget error: ${error.message}`);
      throw error;
    }
  }

  async updateLayout(req, res) {
    try {
      const { ownerId, layout } = req.body;
      const layoutResult = await this.model.updateLayout(req.params.id, ownerId, layout);
      res.status(200).json(layoutResult);
    } catch (error) {
      logger.error(`Update layout error: ${error.message}`);
      throw error;
    }
  }

  async fetchWidgetData(req, res) {
    try {
      const { dashboardId, widgetId } = req.params;
      const result = await this.model.fetchWidgetData(dashboardId, widgetId);
      res.status(200).json(result);
    } catch (error) {
      logger.error(`Fetch widget data error: ${error.message}`);
      throw error;
    }
  }

  async proposeGovernanceChange(req, res) {
    try {
      const { ownerId, proposalData } = req.body;
      const proposal = await this.model.submitProposal(req.params.id, ownerId, proposalData);
      res.status(201).json({ proposal_id: proposal.id });
    } catch (error) {
      logger.error(`Propose governance change error: ${error.message}`);
      throw error;
    }
  }

  async shareDashboard(req, res) {
    try {
      const { ownerId, targetAgent } = req.body;
      const dashboard = await this.model.getDashboard(req.params.id);
      if (!dashboard || dashboard.owner !== ownerId) {
        throw new Error('Dashboard not found or unauthorized');
      }

      if (dashboard.transactionHooks?.onDashboardShare) {
        await this.chainAdapter.executeHook(dashboard.transactionHooks.onDashboardShare, {
          dashboardId: req.params.id,
          targetAgent
        });
      }

      await this.chainAdapter.distributeKarmaWage(dashboard.owner, dashboard.karmaWage);
      await this.chainAdapter.updateReputation(dashboard.owner, 0.3);

      await this.exchangeModel.logComplianceEvent(
        'dashboard_shared',
        ownerId,
        JSON.stringify({ dashboardId: req.params.id, targetAgent })
      );
      res.status(200).json({ message: 'Dashboard shared successfully' });
    } catch (error) {
      logger.error(`Share dashboard error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = DashboardsController;