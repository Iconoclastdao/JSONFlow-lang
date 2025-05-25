const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv);
const Agent = require('../models/agentModel');
const agentSchema = require('../schema/agent/agent.schema.json');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

class AgentController {
  constructor(chainAdapter, exchangeController) {
    if (!chainAdapter || !exchangeController) {
      throw new Error('chainAdapter and exchangeController are required');
    }
    this.chainAdapter = chainAdapter;
    this.exchangeController = exchangeController;
    this.validate = ajv.compile(agentSchema);
  }

  // Validate input data against schema
  validateData(data) {
    const valid = this.validate(data);
    if (!valid) {
      const error = new Error(`Validation failed: ${JSON.stringify(this.validate.errors, null, 2)}`);
      logger.error(error.message);
      throw error;
    }
    return valid;
  }

  // Create a sovereign agent
  async createAgent(req, res) {
    try {
      const { nodeId, username, walletAddress, aiBond, type, coreLogic } = req.body;
      const agentData = {
        id: nodeId || uuidv4(),
        name: username,
        type: type || 'logic',
        identity: {
          publicKey: walletAddress,
          did: `did:ethr:${walletAddress}`,
          created: new Date().toISOString()
        },
        coreLogic: coreLogic || 'agents/defaultLogic.js',
        status: 'active',
        reputation_score: 50,
        staking_balance: 0.0,
        votes_cast: 0,
        projects_owned: [],
        ai_bond: aiBond || { agentId: uuidv4(), bondType: 'passive' }
      };
      this.validateData({ function: 'sovereignAgent', schema: { inputs: agentData } });

      const agent = await Agent.create(agentData);
      await this.exchangeController.logComplianceEvent('agent_created', agent.id, JSON.stringify({ type, username }));
      logger.info(`Agent created: ${agent.id}`);
      res.status(201).json({ agentId: agent.id });
    } catch (error) {
      logger.error(`Create agent failed: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  }

  // Get all agents
  async getAllAgents(req, res) {
    try {
      const agents = await Agent.find();
      res.status(200).json(agents);
    } catch (error) {
      logger.error(`Get all agents failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // Get agent by ID
  async getAgentById(req, res) {
    try {
      const agent = await Agent.findOne({ id: req.params.id });
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      res.status(200).json(agent);
    } catch (error) {
      logger.error(`Get agent failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // Update agent
  async updateAgent(req, res) {
    try {
      const { status, aiBond, reputationScore, stakingBalance } = req.body;
      const agentData = { status, ai_bond: aiBond, reputation_score: reputationScore, staking_balance: stakingBalance };
      this.validateData({ function: 'sovereignAgent', schema: { inputs: agentData } });

      const agent = await Agent.findOneAndUpdate(
        { id: req.params.id },
        { ...agentData, lastActive: new Date().toISOString() },
        { new: true }
      );
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      await this.exchangeController.logComplianceEvent('agent_updated', req.params.id, JSON.stringify(agentData));
      logger.info(`Agent updated: ${agent.id}`);
      res.status(200).json({ agentId: agent.id });
    } catch (error) {
      logger.error(`Update agent failed: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  }

  // Delete agent
  async deleteAgent(req, res) {
    try {
      const agent = await Agent.findOneAndDelete({ id: req.params.id });
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      await this.exchangeController.logComplianceEvent('agent_deleted', req.params.id, JSON.stringify({}));
      logger.info(`Agent deleted: ${req.params.id}`);
      res.status(200).json({ message: 'Agent deleted successfully' });
    } catch (error) {
      logger.error(`Delete agent failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // Assign task to agent
  async assignTask(req, res) {
    try {
      const { agentId, taskType, target, params } = req.body;
      const task = {
        id: uuidv4(),
        agent: agentId,
        type: taskType,
        target,
        params: params || {},
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      this.validateData({ function: 'sovereignAgent', schema: { inputs: { nodeId: agentId } } });

      const agent = await Agent.findOneAndUpdate(
        { id: agentId },
        { $push: { tasks: task } },
        { new: true }
      );
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      await this.exchangeController.logComplianceEvent('task_assigned', agentId, JSON.stringify({ taskType, target }));
      logger.info(`Task assigned to agent: ${agentId}`);
      res.status(201).json({ taskId: task.id });
    } catch (error) {
      logger.error(`Assign task failed: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  }

  // Fetch and record entropy
  async recordEntropy(req, res) {
    try {
      const { agentId, contract, method = 'getEntropy', format = 'int' } = req.body;
      const entropyRequest = { contract, method, format };
      this.validateData({ function: 'sovereignAgent', schema: { inputs: { nodeId: agentId, entropyRequest } } });

      const entropyValue = await this.chainAdapter.executeContract(
        agentSchema.blockchain.contract.address,
        method,
        []
      );
      const entropy = {
        id: uuidv4(),
        agent: agentId,
        value: format === 'int' ? parseInt(entropyValue, 16) : entropyValue,
        timestamp: new Date().toISOString()
      };

      const agent = await Agent.findOneAndUpdate(
        { id: agentId },
        { $push: { entropyRecords: entropy } },
        { new: true }
      );
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      await this.exchangeController.logComplianceEvent('entropy_recorded', agentId, JSON.stringify({ entropyValue }));
      logger.info(`Entropy recorded for agent: ${agentId}`);
      res.status(201).json({ entropyId: entropy.id, entropyValue: entropy.value });
    } catch (error) {
      logger.error(`Record entropy failed: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  }

  // Get agent tasks
  async getAgentTasks(req, res) {
    try {
      const agent = await Agent.findOne({ id: req.params.id });
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      res.status(200).json(agent.tasks || []);
    } catch (error) {
      logger.error(`Get agent tasks failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = AgentController;