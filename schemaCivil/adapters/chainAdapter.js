const { ethers } = require('ethers');
const logger = require('../config/logger');

// Smart contract ABI for DApp operations (simplified for demonstration)
const contractABI = [
  "function verifySoulboundId(address user, string memory soulboundId) view returns (bool)",
  "function registerMarket(bytes32 marketId, string memory metadata) returns (bool)",
  "function registerOffer(bytes32 marketId, bytes32 offerId, string memory metadata) returns (bool)",
  "function updateOffer(bytes32 marketId, bytes32 offerId, string memory metadata) returns (bool)",
  "function logEvent(bytes32 eventId, string memory eventType, address user, string memory metadata) returns (bool)",
  "function registerPost(bytes32 postId, string memory metadata) returns (bool)",
  "function registerComment(bytes32 postId, bytes32 commentId, string memory metadata) returns (bool)",
  "function registerReaction(bytes32 postId, bytes32 reactionId, string memory metadata) returns (bool)",
  "function updatePost(bytes32 postId, string memory metadata) returns (bool)"
];

class ChainAdapter {
  constructor() {
    this.isTestMode = !process.env.ETHEREUM_RPC_URL || !process.env.CONTRACT_ADDRESS || !process.env.PRIVATE_KEY;
    if (this.isTestMode) {
      logger.warn('ChainAdapter running in test mode: using in-memory storage');
      this.storage = new Map(); // In-memory fallback
    } else {
      // Initialize Ethereum provider and wallet
      this.provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
      this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
      this.contract = new ethers.Contract(
        process.env.CONTRACT_ADDRESS,
        contractABI,
        this.wallet
      );
    }
  }

  // Convert UUID to bytes32 for blockchain
  toBytes32(id) {
    if (!ethers.isHexString(id, 16)) {
      return ethers.id(id).slice(0, 66); // Truncate to 32 bytes
    }
    return id;
  }

  // Serialize data to JSON string for blockchain storage
  serializeMetadata(data) {
    return JSON.stringify(data);
  }

  async verifySoulboundId(userId, soulboundId) {
    try {
      if (this.isTestMode) {
        return { success: true }; // Assume valid in test mode
      }
      if (!ethers.isAddress(userId)) {
        throw new Error('Invalid Ethereum address');
      }
      const result = await this.contract.verifySoulboundId(userId, soulboundId);
      return { success: result };
    } catch (error) {
      logger.error('verifySoulboundId failed', { error: error.message, userId, soulboundId });
      return { success: false, error: error.message };
    }
  }

  async registerMarket(marketId, marketData) {
    try {
      const metadata = this.serializeMetadata(marketData);
      if (this.isTestMode) {
        this.storage.set(`market:${marketId}`, marketData);
        return { success: true, transactionId: `tx-market-${marketId}` };
      }
      const tx = await this.contract.registerMarket(this.toBytes32(marketId), metadata);
      const receipt = await tx.wait();
      return { success: true, transactionId: receipt.transactionHash };
    } catch (error) {
      logger.error('registerMarket failed', { error: error.message, marketId });
      return { success: false, error: error.message };
    }
  }

  async registerOffer(marketId, offerId, offerData) {
    try {
      const metadata = this.serializeMetadata(offerData);
      if (this.isTestMode) {
        this.storage.set(`offer:${marketId}:${offerId}`, offerData);
        return { success: true, transactionId: `tx-offer-${offerId}` };
      }
      const tx = await this.contract.registerOffer(
        this.toBytes32(marketId),
        this.toBytes32(offerId),
        metadata
      );
      const receipt = await tx.wait();
      return { success: true, transactionId: receipt.transactionHash };
    } catch (error) {
      logger.error('registerOffer failed', { error: error.message, marketId, offerId });
      return { success: false, error: error.message };
    }
  }

  async updateOffer(marketId, offerId, updates) {
    try {
      const metadata = this.serializeMetadata(updates);
      if (this.isTestMode) {
        this.storage.set(`offer:${marketId}:${offerId}`, updates);
        return { success: true, transactionId: `tx-update-offer-${offerId}` };
      }
      const tx = await this.contract.updateOffer(
        this.toBytes32(marketId),
        this.toBytes32(offerId),
        metadata
      );
      const receipt = await tx.wait();
      return { success: true, transactionId: receipt.transactionHash };
    } catch (error) {
      logger.error('updateOffer failed', { error: error.message, marketId, offerId });
      return { success: false, error: error.message };
    }
  }

  async logEvent(eventId, eventData) {
    try {
      const metadata = this.serializeMetadata(eventData);
      if (this.isTestMode) {
        this.storage.set(`event:${eventId}`, eventData);
        return { success: true, transactionId: `tx-event-${eventId}` };
      }
      const tx = await this.contract.logEvent(
        this.toBytes32(eventId),
        eventData.eventType,
        eventData.userId,
        metadata
      );
      const receipt = await tx.wait();
      return { success: true, transactionId: receipt.transactionHash };
    } catch (error) {
      logger.error('logEvent failed', { error: error.message, eventId });
      return { success: false, error: error.message };
    }
  }

  async registerPost(postId, postData) {
    try {
      const metadata = this.serializeMetadata(postData);
      if (this.isTestMode) {
        this.storage.set(`post:${postId}`, postData);
        return { success: true, transactionId: `tx-post-${postId}` };
      }
      const tx = await this.contract.registerPost(this.toBytes32(postId), metadata);
      const receipt = await tx.wait();
      return { success: true, transactionId: receipt.transactionHash };
    } catch (error) {
      logger.error('registerPost failed', { error: error.message, postId });
      return { success: false, error: error.message };
    }
  }

  async registerComment(postId, commentData) {
    try {
      const commentId = commentData.id;
      const metadata = this.serializeMetadata(commentData);
      if (this.isTestMode) {
        this.storage.set(`comment:${postId}:${commentId}`, commentData);
        return { success: true, transactionId: `tx-comment-${commentId}` };
      }
      const tx = await this.contract.registerComment(
        this.toBytes32(postId),
        this.toBytes32(commentId),
        metadata
      );
      const receipt = await tx.wait();
      return { success: true, transactionId: receipt.transactionHash };
    } catch (error) {
      logger.error('registerComment failed', { error: error.message, postId });
      return { success: false, error: error.message };
    }
  }

  async registerReaction(postId, reactionData) {
    try {
      const reactionId = reactionData.id;
      const metadata = this.serializeMetadata(reactionData);
      if (this.isTestMode) {
        this.storage.set(`reaction:${postId}:${reactionId}`, reactionData);
        return { success: true, transactionId: `tx-reaction-${reactionId}` };
      }
      const tx = await this.contract.registerReaction(
        this.toBytes32(postId),
        this.toBytes32(reactionId),
        metadata
      );
      const receipt = await tx.wait();
      return { success: true, transactionId: receipt.transactionHash };
    } catch (error) {
      logger.error('registerReaction failed', { error: error.message, postId });
      return { success: false, error: error.message };
    }
  }

  async updatePost(postId, postData) {
    try {
      const metadata = this.serializeMetadata(postData);
      if (this.isTestMode) {
        this.storage.set(`post:${postId}`, postData);
        return { success: true, transactionId: `tx-update-post-${postId}` };
      }
      const tx = await this.contract.updatePost(this.toBytes32(postId), metadata);
      const receipt = await tx.wait();
      return { success: true, transactionId: receipt.transactionHash };
    } catch (error) {
      logger.error('updatePost failed', { error: error.message, postId });
      return { success: false, error: error.message };
    }
  }
}

module.exports = ChainAdapter;