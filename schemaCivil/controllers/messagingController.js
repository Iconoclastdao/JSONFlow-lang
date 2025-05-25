const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, useDefaults: true });
const messagingSchema = require('../schema/messaging/messaging.schema.json');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger')();

class MessagingController {
  constructor(messagingModel, chainAdapter, exchangeController) {
    this.messagingModel = messagingModel;
    this.chainAdapter = chainAdapter;
    this.exchangeController = exchangeController;
    this.validate = ajv.compile(messagingSchema);
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

  // Create a messaging platform
  async createPlatform(req, res) {
    try {
      const data = req.body;
      this.validateData(data);
      const platform = await this.messagingModel.createPlatform({
        ...data,
        function: messagingSchema.function,
        metadata: { ...messagingSchema.metadata, created: new Date().toISOString(), updated: new Date().toISOString() }
      });
      logger.info(`Platform created: ${platform.function}`);
      res.json({ id: platform.function, title: data.metadata.title });
    } catch (error) {
      logger.error(`Create platform failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // Get a platform by ID
  async getPlatform(req, res) {
    try {
      const { platformId } = req.params;
      const platform = await this.messagingModel.getPlatform(platformId);
      if (!platform) {
        return res.status(404).json({ error: 'Platform not found' });
      }
      res.json(platform);
    } catch (error) {
      logger.error(`Get platform failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // Start a conversation
  async startConversation(req, res) {
    try {
      const { platformId } = req.params;
      const { creator, soulboundId, participants, soulboundIds, messageType, groupId } = req.body;
      const conversationData = {
        id: uuidv4(),
        participants,
        soulboundIds,
        messageType: messageType || 'direct',
        groupId,
        messages: [],
        createdAt: new Date().toISOString()
      };
      this.validateData({ function: 'sovereignMessaging', schema: { inputs: { platformId, conversationData } } });

      const reputation = await this.chainAdapter.getReputation(creator);
      if (reputation < 10) {
        throw new Error('Insufficient reputation to start conversation');
      }

      const conversation = await this.messagingModel.createConversation(platformId, conversationData);
      await this.exchangeController.logComplianceEvent('conversation_started', creator, JSON.stringify({ platformId, conversationId: conversation.id }));
      logger.info(`Conversation started: ${conversation.id}`);
      res.json({ id: conversation.id });
    } catch (error) {
      logger.error(`Start conversation failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // Send a message
  async sendMessage(req, res) {
    try {
      const { platformId, conversationId } = req.params;
      const { sender, soulboundId, content } = req.body;
      const messageData = {
        id: uuidv4(),
        sender,
        soulboundId,
        content: {
          encryptionType: content.encryptionType || 'hybrid',
          data: content.data
        },
        timestamp: new Date().toISOString(),
        status: 'sent'
      };
      this.validateData({ function: 'sovereignMessaging', schema: { inputs: { platformId, messageData } } });

      const isValidSoulbound = await this.chainAdapter.verifySoulboundId(sender, soulboundId);
      if (!isValidSoulbound) {
        throw new Error(`Invalid soulbound ID for sender ${sender}`);
      }

      const message = await this.messagingModel.sendMessage(platformId, conversationId, messageData);
      await this.chainAdapter.storeMessage(messageData, messagingSchema.blockchain);
      logger.info(`Message sent: ${message.id}`);
      res.json({ id: message.id, timestamp: message.timestamp });
    } catch (error) {
      logger.error(`Send message failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // Create a group
  async createGroup(req, res) {
    try {
      const { platformId } = req.params;
      const { creator, soulboundId, members, soulboundIds, title } = req.body;
      const groupData = {
        id: uuidv4(),
        creator,
        soulboundId,
        members,
        soulboundIds,
        title,
        createdAt: new Date().toISOString()
      };
      this.validateData({ function: 'sovereignMessaging', schema: { inputs: { platformId, conversationData: groupData } } });

      const reputation = await this.chainAdapter.getReputation(creator);
      if (reputation < 20) {
        throw new Error('Insufficient reputation to create group');
      }

      const group = await this.messagingModel.createGroup(platformId, groupData);
      logger.info(`Group created: ${group.id}`);
      res.json({ id: group.id, title: group.title });
    } catch (error) {
      logger.error(`Create group failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // Update message status
  async updateMessageStatus(req, res) {
    try {
      const { platformId, conversationId, messageId } = req.params;
      const { recipient, soulboundId, status } = req.body;
      this.validateData({ function: 'sovereignMessaging', schema: { inputs: { platformId, messageData: { soulboundId } } } });

      const isValidSoulbound = await this.chainAdapter.verifySoulboundId(recipient, soulboundId);
      if (!isValidSoulbound) {
        throw new Error(`Invalid soulbound ID for recipient ${recipient}`);
      }

      const message = await this.messagingModel.updateMessageStatus(platformId, conversationId, messageId, recipient, status);
      logger.info(`Message status updated: ${message.id} to ${status}`);
      res.json({ id: message.id, status: message.status });
    } catch (error) {
      logger.error(`Update message status failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // Rotate encryption keys
  async rotateEncryptionKeys(req, res) {
    try {
      const { platformId } = req.params;
      const { agent, soulboundId } = req.body;
      this.validateData({ function: 'sovereignMessaging', schema: { inputs: { platformId } } });

      const isValidSoulbound = await this.chainAdapter.verifySoulboundId(agent, soulboundId);
      if (!isValidSoulbound) {
        throw new Error(`Invalid soulbound ID for agent ${agent}`);
      }

      const reputation = await this.chainAdapter.getReputation(agent);
      if (reputation < 50) {
        throw new Error('Insufficient reputation to rotate keys');
      }

      const result = await this.messagingModel.rotateEncryptionKeys(platformId);
      await this.exchangeController.logComplianceEvent('keys_rotated', agent, JSON.stringify({ platformId }));
      logger.info(`Encryption keys rotated for platform: ${platformId}`);
      res.json(result);
    } catch (error) {
      logger.error(`Key rotation failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // Propose a governance change
  async proposeGovernanceChange(req, res) {
    try {
      const { platformId } = req.params;
      const { agent, soulboundId, proposalData } = req.body;
      const platform = await this.messagingModel.getPlatform(platformId);
      this.validateData({ function: 'sovereignMessaging', schema: { inputs: { platformId } } });

      const isValidSoulbound = await this.chainAdapter.verifySoulboundId(agent, soulboundId);
      if (!isValidSoulbound) {
        throw new Error(`Invalid soulbound ID for agent ${agent}`);
      }

      const reputation = await this.chainAdapter.getReputation(agent);
      if (reputation < platform.platform.governance.proposalThreshold) {
        throw new Error('Insufficient reputation to submit proposal');
      }

      const proposalId = proposalData.id || uuidv4();
      const proposal = {
        ...proposalData,
        id: proposalId,
        proposer: agent,
        createdAt: new Date().toISOString(),
        status: 'pending'
      };

      await this.chainAdapter.submitProposal(messagingSchema.blockchain.contract.address, proposal);
      await this.chainAdapter.distributeKarmaWage(agent, platform.platform.karmaWage);
      await this.chainAdapter.updateReputation(agent, 0.7);
      await this.exchangeController.logComplianceEvent('proposal_submitted', agent, JSON.stringify({ platformId, proposalId }));
      logger.info(`Governance proposal submitted: ${proposalId}`);
      res.json({ proposal_id: proposalId });
    } catch (error) {
      logger.error(`Governance proposal failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = MessagingController;