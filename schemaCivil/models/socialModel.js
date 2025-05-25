const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { v4: uuidv4 } = require('uuid');
const socialSchema = require('../schema/social/social.schema.json');

const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv); // Enable date-time and other formats
const validate = ajv.compile(socialSchema);

class SocialModel {
  constructor(chainAdapter, exchangeController) {
    if (!chainAdapter || !exchangeController) {
      throw new Error('chainAdapter and exchangeController are required');
    }
    this.chainAdapter = chainAdapter;
    this.exchangeController = exchangeController;
    this.platforms = new Map();
  }

  validateData(data) {
    const valid = validate(data);
    if (!valid) {
      const errorMessage = `Validation failed: ${JSON.stringify(validate.errors, null, 2)}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    return valid;
  }

  async createPlatform(data) {
    try {
      this.validateData(data);
      const platformId = data.id || uuidv4();
      const platform = {
        ...data,
        id: platformId,
        type: 'social',
        createdAt: new Date().toISOString(),
      };

      for (const post of platform.platform.posts || []) {
        const isValid = await this.chainAdapter.verifySoulboundId(post.creator, post.soulboundId);
        if (!isValid) throw new Error(`Invalid soulbound ID for creator ${post.creator}`);
      }

      for (const group of platform.platform.groups || []) {
        const isValid = await this.chainAdapter.verifySoulboundId(group.creator, group.soulboundId);
        if (!isValid) throw new Error(`Invalid soulbound ID for creator ${group.creator}`);
      }

      this.platforms.set(platformId, platform);
      await this.chainAdapter.registerPlatform(platformId, platform);
      await this.exchangeController.logComplianceEvent(
        'platform_created',
        'system',
        JSON.stringify({ id: platformId, title: platform.title })
      );
      return platform;
    } catch (error) {
      console.error('Error in createPlatform:', error.message, error.stack);
      throw error;
    }
  }

  getPlatform(platformId) {
    try {
      const platform = this.platforms.get(platformId);
      if (!platform) throw new Error('Platform not found');
      return platform;
    } catch (error) {
      console.error('Error in getPlatform:', error.message, error.stack);
      throw error;
    }
  }

  async createPost(platformId, postData) {
    try {
      if (!platformId || !postData || !postData.creator || !postData.soulboundId) {
        throw new Error('Missing required fields: platformId, postData, creator, soulboundId');
      }
      const platform = this.getPlatform(platformId);
      this.validateData({ platform: { posts: [postData] } });

      const isValid = await this.chainAdapter.verifySoulboundId(postData.creator, postData.soulboundId);
      if (!isValid) throw new Error(`Invalid soulbound ID for creator ${postData.creator}`);

      const reputation = await this.chainAdapter.getReputation(postData.creator);
      const threshold = platform.platform.governance.proposalThreshold;
      if (reputation < threshold / 2) throw new Error('Insufficient reputation to create post');

      if (postData.visibility === 'group') {
        const group = platform.platform.groups.find(g => g.id === postData.groupId);
        if (!group || !group.members.includes(postData.creator)) {
          throw new Error('Group not found or creator not a member');
        }
      }

      const post = {
        ...postData,
        id: postData.id || uuidv4(),
        status: 'active',
        comments: [],
        reactions: [],
        createdAt: new Date().toISOString(),
        expiry: postData.expiry || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      platform.platform.posts.push(post);

      if (platform.platform.transactionHooks?.onPostCreate) {
        await this.chainAdapter.executeHook(platform.platform.transactionHooks.onPostCreate, {
          platformId,
          postId: post.id,
        });
      }

      await this.chainAdapter.registerPost(platformId, post);
      await this.chainAdapter.distributeKarmaWage(post.creator, platform.platform.karmaWage);
      await this.chainAdapter.updateReputation(post.creator, 0.5);

      await this.exchangeController.logComplianceEvent(
        'post_created',
        post.creator,
        JSON.stringify({ platformId, postId: post.id, tags: post.tags })
      );

      return post;
    } catch (error) {
      console.error('Error in createPost:', error.message, error.stack);
      throw error;
    }
  }

  async addComment(platformId, postId, commentData) {
    try {
      if (!platformId || !postId || !commentData || !commentData.creator || !commentData.soulboundId) {
        throw new Error('Missing required fields: platformId, postId, creator, soulboundId');
      }
      const platform = this.getPlatform(platformId);
      const post = platform.platform.posts.find(p => p.id === postId);
      if (!post || post.status !== 'active') throw new Error('Post not found or not active');

      this.validateData({ platform: { posts: [{ comments: [commentData] }] } });

      const isValid = await this.chainAdapter.verifySoulboundId(commentData.creator, commentData.soulboundId);
      if (!isValid) throw new Error(`Invalid soulbound ID for creator ${commentData.creator}`);

      const reputation = await this.chainAdapter.getReputation(commentData.creator);
      const threshold = platform.platform.governance.proposalThreshold;
      if (reputation < threshold / 4) throw new Error('Insufficient reputation to comment');

      const comment = {
        ...commentData,
        id: commentData.id || uuidv4(),
        createdAt: new Date().toISOString(),
      };

      post.comments.push(comment);

      if (platform.platform.transactionHooks?.onComment) {
        await this.chainAdapter.executeHook(platform.platform.transactionHooks.onComment, {
          platformId,
          postId,
          commentId: comment.id,
        });
      }

      await this.chainAdapter.updatePost(platformId, post);
      await this.chainAdapter.distributeKarmaWage(comment.creator, platform.platform.karmaWage);
      await this.chainAdapter.updateReputation(comment.creator, 0.3);

      await this.exchangeController.logComplianceEvent(
        'comment_added',
        comment.creator,
        JSON.stringify({ platformId, postId, commentId: comment.id })
      );

      return comment;
    } catch (error) {
      console.error('Error in addComment:', error.message, error.stack);
      throw error;
    }
  }

  async addReaction(platformId, postId, reactionData) {
    try {
      if (!platformId || !postId || !reactionData || !reactionData.agent || !reactionData.soulboundId) {
        throw new Error('Missing required fields: platformId, postId, agent, soulboundId');
      }
      const platform = this.getPlatform(platformId);
      const post = platform.platform.posts.find(p => p.id === postId);
      if (!post || post.status !== 'active') throw new Error('Post not found or not active');

      this.validateData({ platform: { posts: [{ reactions: [reactionData] }] } });

      const isValid = await this.chainAdapter.verifySoulboundId(reactionData.agent, reactionData.soulboundId);
      if (!isValid) throw new Error(`Invalid soulbound ID for agent ${reactionData.agent}`);

      const alreadyReacted = post.reactions.some(
        r => r.agent === reactionData.agent && r.type === reactionData.type
      );
      if (alreadyReacted) throw new Error('Reaction already exists');

      const reaction = {
        ...reactionData,
        timestamp: new Date().toISOString(),
      };

      post.reactions.push(reaction);

      if (platform.platform.transactionHooks?.onReaction) {
        await this.chainAdapter.executeHook(platform.platform.transactionHooks.onReaction, {
          platformId,
          postId,
          reactionType: reaction.type,
        });
      }

      await this.chainAdapter.updatePost(platformId, post);
      await this.chainAdapter.distributeKarmaWage(reaction.agent, platform.platform.karmaWage);
      await this.chainAdapter.updateReputation(reaction.agent, 0.1);

      await this.exchangeController.logComplianceEvent(
        'reaction_added',
        reaction.agent,
        JSON.stringify({ platformId, postId, reactionType: reaction.type })
      );

      const flagCount = post.reactions.filter(r => r.type === 'flag').length;
      const moderationThreshold = platform.platform.governance.moderationThreshold || 5;

      if (reaction.type === 'flag' && flagCount >= moderationThreshold) {
        post.status = 'moderated';
        await this.initiateModeration(platformId, postId, reaction.agent);
      }

      return reaction;
    } catch (error) {
      console.error('Error in addReaction:', error.message, error.stack);
      throw error;
    }
  }

  async initiateModeration(platformId, postId, initiator) {
    try {
      const platform = this.getPlatform(platformId);
      const post = platform.platform.posts.find(p => p.id === postId);
      if (!post) throw new Error('Post not found');

      if (platform.platform.governance.disputeResolution === 'voting') {
        const disputeId = uuidv4();
        const dispute = {
          id: disputeId,
          creator: initiator,
          target: postId,
          reason: 'Content flagged for moderation',
          status: 'open',
          createdAt: new Date().toISOString(),
        };

        platform.platform.disputes = platform.platform.disputes || [];
        platform.platform.disputes.push(dispute);

        const result = await this.chainAdapter.submitDisputeVote(
          platform.platform.governance.votingContract,
          dispute
        );

        dispute.status = result.approved ? 'resolved' : 'dismissed';
        dispute.resolution = { method: 'voting', outcome: result.outcome };

        post.status = result.approved ? 'removed' : 'active';
        if (result.approved) {
          await this.chainAdapter.updateReputation(post.creator, -1);
        }

        await this.chainAdapter.updateDispute(platformId, dispute);
        await this.chainAdapter.updatePost(platformId, post);
        await this.exchangeController.logComplianceEvent(
          'moderation_completed',
          initiator,
          JSON.stringify({ platformId, postId, outcome: dispute.resolution.outcome })
        );
      }
    } catch (error) {
      console.error('Error in initiateModeration:', error.message, error.stack);
      throw error;
    }
  }

  async createGroup(platformId, groupData) {
    try {
      if (!platformId || !groupData || !groupData.creator || !groupData.soulboundId) {
        throw new Error('Missing required fields: platformId, creator, soulboundId');
      }
      const platform = this.getPlatform(platformId);
      this.validateData({ platform: { groups: [groupData] } });

      const isValid = await this.chainAdapter.verifySoulboundId(groupData.creator, groupData.soulboundId);
      if (!isValid) throw new Error(`Invalid soulbound ID for creator ${groupData.creator}`);

      const reputation = await this.chainAdapter.getReputation(groupData.creator);
      const threshold = platform.platform.governance.proposalThreshold;
      if (reputation < threshold) throw new Error('Insufficient reputation to create group');

      const group = {
        ...groupData,
        id: groupData.id || uuidv4(),
        createdAt: new Date().toISOString(),
      };

      platform.platform.groups.push(group);
      await this.chainAdapter.registerGroup(platformId, group);
      await this.chainAdapter.distributeKarmaWage(group.creator, platform.platform.karmaWage);
      await this.chainAdapter.updateReputation(group.creator, 0.5);

      await this.exchangeController.logComplianceEvent(
        'group_created',
        group.creator,
        JSON.stringify({ platformId, groupId: group.id, title: group.title })
      );

      return group;
    } catch (error) {
      console.error('Error in createGroup:', error.message, error.stack);
      throw error;
    }
  }
}

module.exports = SocialModel;