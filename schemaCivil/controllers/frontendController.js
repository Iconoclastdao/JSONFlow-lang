const Ajv = require('ajv');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const frontendSchema = require('../schema/frontend/frontend.schema.json');
const frontendAgentSchema = require('../schema/frontend/frontend-agent.schema.json');
const { executeJSONFlow } = require('../jsonflow-executor');

class FrontendController {
  constructor(exchangeController, dashboardsController, ritualController, casinoController, chainAdapter) {
    this.ajv = new Ajv({ allErrors: true, useDefaults: true });
    this.validateFrontend = this.ajv.compile(frontendSchema);
    this.validateAgent = this.ajv.compile(frontendAgentSchema);
    this.exchangeController = exchangeController;
    this.dashboardsController = dashboardsController;
    this.ritualController = ritualController;
    this.casinoController = casinoController;
    this.chainAdapter = chainAdapter;
    this.frontendData = {
      components: [],
      layouts: [],
      themes: []
    };
    this.agents = new Map();
  }

  validateFrontendData(data) {
    const valid = this.validateFrontend(data);
    if (!valid) {
      const error = new Error(`Frontend validation failed: ${JSON.stringify(this.validateFrontend.errors, null, 2)}`);
      logger.error(error.message);
      throw error;
    }
    return valid;
  }

  validateAgentData(data) {
    const valid = this.validateAgent(data);
    if (!valid) {
      const error = new Error(`Agent validation failed: ${JSON.stringify(this.validateAgent.errors, null, 2)}`);
      logger.error(error.message);
      throw error;
    }
    return valid;
  }

  async createAgent(agentData, userId) {
    try {
      this.validateAgentData(agentData);
      const agentId = agentData.id || uuidv4();
      const agent = {
        ...agentData,
        id: agentId,
        type: 'frontend',
        identity: {
          ...agentData.identity,
          created: new Date().toISOString()
        },
        status: agentData.status || 'active',
        meta: {
          schema_version: '5.3.1',
          version: '1.0.0',
          author: agentData.meta?.author || 'xAI Team',
          description: agentData.meta?.description || 'Frontend agent for casino dashboard',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          tags: agentData.meta?.tags || ['frontend', 'casino', 'dashboard']
        }
      };

      // Verify soulbound identity
      const isValidSoulbound = await this.chainAdapter.verifySoulboundId(agent.identity.publicKey, agentData.soulboundId);
      if (!isValidSoulbound) {
        throw new Error(`Invalid soulbound ID for ${agent.identity.publicKey}`);
      }

      this.agents.set(agentId, agent);
      await this.chainAdapter.registerAgent(agentId, agent);

      // Trigger JSONFlow workflow
      const workflowResult = await executeJSONFlow({
        workflow: 'create-frontend-agent',
        params: { agentId, userId, agent }
      });

      // Log events
      await this.ritualController.logEvent(
        'agent_created',
        userId,
        JSON.stringify({ agentId, type: agent.type, workflowResult }),
        workflowResult.txHash
      );
      await this.exchangeController.logComplianceEvent(
        'agent_created',
        userId,
        JSON.stringify({ agentId, type: agent.type })
      );

      logger.info(`Frontend agent created: ${agentId}`);
      return agent;
    } catch (error) {
      logger.error(`Create agent error: ${error.message}`);
      throw error;
    }
  }

  async addComponent(id, type, config, userId, agentId) {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const component = {
        id,
        type,
        config: { ...config, responsive: config.responsive ?? true },
        createdAt: new Date().toISOString()
      };
      this.frontendData.components.push(component);
      this.validateFrontendData(this.frontendData);

      // Update agent frontend components
      agent.frontend.components = agent.frontend.components || [];
      agent.frontend.components.push({
        id,
        framework: 'react',
        component: config.workflow || id,
        props: config
      });
      agent.meta.updated = new Date().toISOString();

      // Trigger JSONFlow workflow
      const workflowResult = await executeJSONFlow({
        workflow: config.workflow || 'add-component',
        params: { id, type, config, userId, agentId }
      });

      // Sync with dashboard if applicable
      if (config.module === 'casino') {
        await this.dashboardsController.addWidget(config.dashboardId, {
          id,
          type: config.widgetType || 'casino-' + type,
          dataSource: { type: 'casino', id: config.gameId || 'game-1' }
        });
      }

      // Log events
      await this.ritualController.logEvent(
        'component_added',
        userId,
        JSON.stringify({ id, type, workflowResult, agentId }),
        workflowResult.txHash
      );
      await this.exchangeController.logComplianceEvent(
        'component_added',
        userId,
        JSON.stringify({ id, type, agentId })
      );

      logger.info(`Component added: ${id} by agent ${agentId}`);
      return component;
    } catch (error) {
      logger.error(`Add component error: ${error.message}`);
      throw error;
    }
  }

  async updateLayout(userId, layoutId, x, y, w, h, agentId) {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      let layout = this.frontendData.layouts.find(l => l.id === layoutId && l.user === userId);
      const layoutData = { x, y, w, h, timestamp: new Date().toISOString() };

      if (!layout) {
        layout = { id: layoutId, user: userId, ...layoutData };
        this.frontendData.layouts.push(layout);
      } else {
        Object.assign(layout, layoutData);
      }
      this.validateFrontendData(this.frontendData);

      // Update agent layout
      agent.frontend.layout = layoutData;
      agent.meta.updated = new Date().toISOString();

      // Trigger JSONFlow workflow
      const workflowResult = await executeJSONFlow({
        workflow: 'update-layout',
        params: { userId, layoutId, x, y, w, h, agentId }
      });

      // Sync with dashboards
      await this.dashboardsController.updateLayout(layoutId, userId, layoutData);

      // Log events
      await this.ritualController.logEvent(
        'layout_updated',
        userId,
        JSON.stringify({ layoutId, x, y, w, h, workflowResult, agentId }),
        workflowResult.txHash
      );

      logger.info(`Layout updated: ${layoutId} by agent ${agentId}`);
      return layout;
    } catch (error) {
      logger.error(`Update layout error: ${error.message}`);
      throw error;
    }
  }

  async setTheme(userId, theme, agentId) {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const existingTheme = this.frontendData.themes.find(t => t.user === userId);
      const themeData = { user: userId, theme, timestamp: new Date().toISOString() };

      if (existingTheme) {
        Object.assign(existingTheme, themeData);
      } else {
        this.frontendData.themes.push(themeData);
      }
      this.validateFrontendData(this.frontendData);

      // Update agent theme in memory
      agent.memory.context.environment.theme = theme;
      agent.meta.updated = new Date().toISOString();

      // Trigger JSONFlow workflow
      const workflowResult = await executeJSONFlow({
        workflow: 'set-theme',
        params: { userId, theme, agentId }
      });

      // Log events
      await this.ritualController.logEvent(
        'theme_updated',
        userId,
        JSON.stringify({ theme, workflowResult, agentId }),
        workflowResult.txHash
      );
      await this.exchangeController.logComplianceEvent(
        'theme_updated',
        userId,
        JSON.stringify({ theme, agentId })
      );

      logger.info(`Theme updated for user ${userId} by agent ${agentId}`);
      return themeData;
    } catch (error) {
      logger.error(`Set theme error: ${error.message}`);
      throw error;
    }
  }

  async processNLPCommand(userId, inputText, agentId) {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Trigger JSONFlow NLP workflow
      const workflowResult = await executeJSONFlow({
        workflow: 'nlp-interaction',
        params: { userId, input_text: inputText, agentId }
      });

      let result;
      if (workflowResult.intent === 'update_layout') {
        const { layoutId, x, y, w, h } = workflowResult.params;
        result = await this.updateLayout(userId, layoutId, x, y, w, h, agentId);
      } else if (workflowResult.intent === 'casino_action') {
        const { gameId, action } = workflowResult.params;
        if (action === 'place_bet') {
          result = await this.casinoController.placeBet({ body: { gameId, userId } });
        } else if (action === 'get_games') {
          result = await this.casinoController.getGameBets({ params: { id: gameId } });
        }
      } else {
        result = workflowResult;
      }

      // Update agent memory
      agent.memory.shortTerm.push(`NLP: ${inputText} -> ${JSON.stringify(workflowResult)}`);
      agent.meta.updated = new Date().toISOString();

      // Log events
      await this.ritualController.logEvent(
        'nlp_processed',
        userId,
        JSON.stringify({ inputText, workflowResult, agentId }),
        workflowResult.txHash
      );

      logger.info(`NLP command processed by agent ${agentId}: ${inputText}`);
      return result;
    } catch (error) {
      logger.error(`Process NLP command error: ${error.message}`);
      throw error;
    }
  }

  getFrontendData(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }
    return {
      ...this.frontendData,
      agent: {
        id: agent.id,
        components: agent.frontend.components,
        layout: agent.frontend.layout
      }
    };
  }

  async executeStep(agentId, stepId, params) {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const step = agent.steps.find(s => s.id === stepId);
      if (!step) {
        throw new Error('Step not found');
      }

      let result;
      switch (step.type) {
        case 'blockchain_operation':
          result = await this.chainAdapter.executeOperation(step.chain, step.action, params || step.params);
          break;
        case 'ritual_execute':
          result = await this.ritualController.executeRitual(step.ritual, params || step.parameters);
          break;
        case 'ai_infer':
          result = await executeJSONFlow({
            workflow: 'ai-infer',
            params: { model: step.model, input: params || step.input }
          });
          break;
        default:
          throw new Error(`Unsupported step type: ${step.type}`);
      }

      // Log execution
      await this.ritualController.logEvent(
        'step_executed',
        agent.identity.publicKey,
        JSON.stringify({ agentId, stepId, result }),
        result.txHash
      );

      logger.info(`Step ${stepId} executed by agent ${agentId}`);
      return result;
    } catch (error) {
      logger.error(`Execute step error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = FrontendController;