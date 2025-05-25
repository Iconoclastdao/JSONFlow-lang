const { v4: uuidv4 } = require('uuid');
const ajv = require('../config/ajv');
const feedSchema = require('../schema/feed/feed.schema.json');

// Compile schema for validating feed data
const validateFeedData = ajv.compile(feedSchema);

// Input validation schemas for request bodies
const publishSchema = {
  type: 'object',
  required: ['channel', 'payload'],
  properties: {
    channel: { type: 'string', minLength: 1 },
    payload: {
      type: 'object',
      properties: {
        content: { type: 'string', minLength: 1 },
        metadata: { type: 'object', additionalProperties: true }
      },
      required: ['content'],
      additionalProperties: false
    }
  },
  additionalProperties: false
};

const commentSchema = {
  type: 'object',
  required: ['postId', 'comment'],
  properties: {
    postId: { type: 'string', format: 'uuid' },
    comment: { type: 'string', minLength: 1 }
  },
  additionalProperties: false
};

const reactSchema = {
  type: 'object',
  required: ['postId', 'reaction'],
  properties: {
    postId: { type: 'string', format: 'uuid' },
    reaction: { type: 'string', enum: ['like', 'love', 'dislike', 'share'] }
  },
  additionalProperties: false
};

const updatePostSchema = {
  type: 'object',
  required: ['postId', 'updates'],
  properties: {
    postId: { type: 'string', format: 'uuid' },
    updates: {
      type: 'object',
      properties: {
        content: { type: 'string', minLength: 1 },
        metadata: { type: 'object', additionalProperties: true }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

const validatePublish = ajv.compile(publishSchema);
const validateComment = ajv.compile(commentSchema);
const validateReact = ajv.compile(reactSchema);
const validateUpdatePost = ajv.compile(updatePostSchema);

class FeedController {
  constructor(exchangeController, chainAdapter) {
    if (!exchangeController || typeof exchangeController.logComplianceEvent !== 'function') {
      throw new Error('Valid exchangeController required');
    }
    if (!chainAdapter || typeof chainAdapter.verifySoulboundId !== 'function') {
      throw new Error('Valid chainAdapter required');
    }
    this.exchangeController = exchangeController;
    this.chainAdapter = chainAdapter;
    this.posts = new Map(); // In-memory store for posts
  }

  validateData(data) {
    const valid = validateFeedData(data);
    if (!valid) {
      throw new Error(`Data validation failed: ${JSON.stringify(validateFeedData.errors, null, 2)}`);
    }
    return valid;
  }

  async publish(req, res) {
    try {
      if (!validatePublish(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(validatePublish.errors, null, 2)}`);
      }

      const { channel, payload } = req.body;
      const userId = req.user.id; // From JWT
      const soulboundId = req.user.soulboundId || 'default-soulbound-id'; // Adjust based on your JWT payload

      const isValidSoulbound = await this.chainAdapter.verifySoulboundId(userId, soulboundId);
      if (!isValidSoulbound) {
        throw new Error(`Invalid soulbound ID for user ${userId}`);
      }

      const postId = uuidv4();
      const post = {
        id: postId,
        channel,
        userId,
        payload: {
          ...payload,
          comments: [],
          reactions: []
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.posts.set(postId, post);
      this.validateData({ feed: { posts: [post] } });
      await this.chainAdapter.registerPost(postId, post);
      await this.exchangeController.logComplianceEvent(
        'post_published',
        userId,
        JSON.stringify({ postId, channel })
      );
      res.status(201).json({ message: 'Feed published', data: { id: postId } });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async comment(req, res) {
    try {
      if (!validateComment(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(validateComment.errors, null, 2)}`);
      }

      const { postId, comment } = req.body;
      const userId = req.user.id;
      const soulboundId = req.user.soulboundId || 'default-soulbound-id';

      const post = this.posts.get(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      const isValidSoulbound = await this.chainAdapter.verifySoulboundId(userId, soulboundId);
      if (!isValidSoulbound) {
        throw new Error(`Invalid soulbound ID for user ${userId}`);
      }

      const commentId = uuidv4();
      const commentData = {
        id: commentId,
        userId,
        content: comment,
        createdAt: new Date().toISOString()
      };

      post.payload.comments.push(commentData);
      post.updatedAt = new Date().toISOString();
      this.validateData({ feed: { posts: [post] } });
      await this.chainAdapter.registerComment(postId, commentData);
      await this.exchangeController.logComplianceEvent(
        'comment_added',
        userId,
        JSON.stringify({ postId, commentId })
      );
      res.status(201).json({ message: 'Comment added', data: { id: commentId } });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async react(req, res) {
    try {
      if (!validateReact(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(validateReact.errors, null, 2)}`);
      }

      const { postId, reaction } = req.body;
      const userId = req.user.id;
      const soulboundId = req.user.soulboundId || 'default-soulbound-id';

      const post = this.posts.get(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      const isValidSoulbound = await this.chainAdapter.verifySoulboundId(userId, soulboundId);
      if (!isValidSoulbound) {
        throw new Error(`Invalid soulbound ID for user ${userId}`);
      }

      const reactionId = uuidv4();
      const reactionData = {
        id: reactionId,
        userId,
        type: reaction,
        createdAt: new Date().toISOString()
      };

      post.payload.reactions.push(reactionData);
      post.updatedAt = new Date().toISOString();
      this.validateData({ feed: { posts: [post] } });
      await this.chainAdapter.registerReaction(postId, reactionData);
      await this.exchangeController.logComplianceEvent(
        'reaction_added',
        userId,
        JSON.stringify({ postId, reactionId, reaction })
      );
      res.status(201).json({ message: 'Reaction added', data: { id: reactionId } });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async updatePost(req, res) {
    try {
      if (!validateUpdatePost(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(validateUpdatePost.errors, null, 2)}`);
      }

      const { postId, updates } = req.body;
      const userId = req.user.id;
      const soulboundId = req.user.soulboundId || 'default-soulbound-id';

      const post = this.posts.get(postId);
      if (!post) {
        throw new Error('Post not found');
      }
      if (post.userId !== userId) {
        throw new Error('Unauthorized: Only the post owner can update');
      }

      const isValidSoulbound = await this.chainAdapter.verifySoulboundId(userId, soulboundId);
      if (!isValidSoulbound) {
        throw new Error(`Invalid soulbound ID for user ${userId}`);
      }

      post.payload.content = updates.content || post.payload.content;
      post.payload.metadata = updates.metadata || post.payload.metadata;
      post.updatedAt = new Date().toISOString();
      this.validateData({ feed: { posts: [post] } });
      await this.chainAdapter.updatePost(postId, post);
      await this.exchangeController.logComplianceEvent(
        'post_updated',
        userId,
        JSON.stringify({ postId })
      );
      res.status(200).json({ message: 'Post updated', data: { id: postId } });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = FeedController;