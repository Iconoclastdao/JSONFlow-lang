const Ajv = require('ajv');
const { v4: uuidv4 } = require('uuid');
const dashboardSchema = require('../schema/dashboards/dashboard.schema.json');
const logger = require('../config/logger');

class DashboardsModel {
  constructor(chainAdapter, exchangeModel, casinoModel) {
    this.ajv = new Ajv({ allErrors: true, useDefaults: true });
    this.validate = this.ajv.compile(dashboardSchema);
    this.chainAdapter = chainAdapter;
    this.exchangeModel = exchangeModel;
    this.casinoModel = casinoModel;
    this.dashboards = new Map();
  }

  validateData(data) {
    const valid = this.validate(data);
    if (!valid) {
      const error = new Error(`Validation failed: ${JSON.stringify(this.validate.errors, null, 2)}`);
      logger.error(error.message);
      throw error;
    }
    return valid;
  }

  async createDashboard(data) {
    this.validateData(data);
    const dashboardId = data.id || uuidv4();
    const dashboard = {
      ...data,
      id: dashboardId,
      type: 'dashboard',
      createdAt: new Date().toISOString(),
      meta: {
        schema_version: '5.3.1',
        version: '1.0.0',
        author: 'xAI Team',
        description: data.description || 'Casino dashboard for games and betting.',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ['casino', 'dashboard', 'blockchain']
      }
    };

    const isValidSoulbound = await this.chainAdapter.verifySoulboundId(dashboard.owner, dashboard.soulboundId);
    if (!isValidSoulbound) {
      const error = new Error(`Invalid soulbound ID for owner ${dashboard.owner}`);
      logger.error(error.message);
      throw error;
    }

    this.dashboards.set(dashboardId, dashboard);
    await this.chainAdapter.registerDashboard(dashboardId, dashboard);
    await this.exchangeModel.logComplianceEvent(
      'dashboard_created',
      dashboard.owner,
      JSON.stringify({ id: dashboardId, title: dashboard.title })
    );
    logger.info(`Dashboard created: ${dashboardId}`);
    return dashboard;
  }

  getDashboard(dashboardId) {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      const error = new Error('Dashboard not found');
      logger.error(error.message);
      throw error;
    }
    return dashboard;
  }

  async addWidget(dashboardId, widgetData) {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      const error = new Error('Dashboard not found');
      logger.error(error.message);
      throw error;
    }

    this.validateData({ widgets: [widgetData] });
    const widgetId = widgetData.id || uuidv4();
    const widget = {
      ...widgetData,
      id: widgetId,
      createdAt: new Date().toISOString()
    };

    if (!Array.isArray(dashboard.widgets)) {
      dashboard.widgets = [];
    }
    dashboard.widgets.push(widget);
    dashboard.meta.updated = new Date().toISOString();

    await this.chainAdapter.updateDashboard(dashboardId, dashboard);
    await this.exchangeModel.logComplianceEvent(
      'widget_added',
      dashboard.owner,
      JSON.stringify({ dashboardId, widgetId, type: widget.type })
    );
    logger.info(`Widget added: ${widgetId} to dashboard ${dashboardId}`);
    return widget;
  }

  async updateLayout(dashboardId, ownerId, layout) {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard || dashboard.owner !== ownerId) {
      const error = new Error('Dashboard not found or unauthorized');
      logger.error(error.message);
      throw error;
    }

    this.validateData({ layout });
    dashboard.layout = { ...layout, timestamp: new Date().toISOString() };
    dashboard.meta.updated = new Date().toISOString();

    await this.chainAdapter.updateDashboard(dashboardId, dashboard);
    await this.exchangeModel.logComplianceEvent(
      'layout_updated',
      ownerId,
      JSON.stringify({ dashboardId, layout })
    );
    logger.info(`Layout updated for dashboard ${dashboardId}`);
    return dashboard.layout;
  }

  async submitProposal(dashboardId, ownerId, proposalData) {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard || dashboard.owner !== ownerId) {
      const error = new Error('Dashboard not found or unauthorized');
      logger.error(error.message);
      throw error;
    }

    const reputation = await this.chainAdapter.getReputation(ownerId);
    if (reputation < dashboard.governance.proposalThreshold) {
      const error = new Error('Insufficient reputation to submit proposal');
      logger.error(error.message);
      throw error;
    }

    const proposalId = proposalData.id || uuidv4();
    const proposal = {
      ...proposalData,
      id: proposalId,
      proposer: ownerId,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    await this.chainAdapter.submitProposal(dashboard.governance.votingContract, proposal);
    await this.exchangeModel.logComplianceEvent(
      'proposal_submitted',
      ownerId,
      JSON.stringify({ dashboardId, proposalId })
    );
    logger.info(`Proposal submitted: ${proposalId} for dashboard ${dashboardId}`);
    return proposal;
  }

  async fetchWidgetData(dashboardId, widgetId) {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      const error = new Error('Dashboard not found');
      logger.error(error.message);
      throw error;
    }

    const widget = dashboard.widgets.find(w => w.id === widgetId);
    if (!widget) {
      const error = new Error('Widget not found');
      logger.error(error.message);
      throw error;
    }

    let data;
    switch (widget.dataSource.type) {
      case 'casino':
        const casinoData = this.casinoModel.getCasinoData();
        if (widget.type === 'casino-games') {
          data = casinoData.schema.outputs.gameResult.id ? [casinoData.schema.outputs.gameResult] : [];
        } else if (widget.type === 'casino-bets') {
          data = await this.casinoModel.getGameBets(widget.dataSource.id);
        } else if (widget.type === 'casino-stats') {
          const bets = await this.casinoModel.getGameBets(widget.dataSource.id);
          data = {
            labels: ['Placed', 'Settled'],
            dataset: [
              {
                label: 'Bets',
                data: [
                  bets.filter(b => b.status === 'placed').length,
                  bets.filter(b => b.status === 'settled').length
                ]
              }
            ]
          };
        }
        break;
      case 'nl':
        data = { message: 'Natural language panel ready' };
        break;
      default:
        const error = new Error(`Unsupported data source type: ${widget.dataSource.type}`);
        logger.error(error.message);
        throw error;
    }

    await this.chainAdapter.distributeKarmaWage(dashboard.owner, dashboard.karmaWage);
    await this.exchangeModel.logComplianceEvent(
      'widget_data_fetched',
      dashboard.owner,
      JSON.stringify({ dashboardId, widgetId })
    );
    logger.info(`Widget data fetched: ${widgetId} for dashboard ${dashboardId}`);
    return { widgetId, data };
  }
}

module.exports = DashboardsModel;