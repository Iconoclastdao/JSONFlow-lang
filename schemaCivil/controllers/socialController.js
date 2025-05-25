const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv); // Enable date-time and other formats
const socialSchema = require('../schema/social/social.schema.json');
const validate = ajv.compile(socialSchema);
const crypto = require('crypto');

class SocialController {
  constructor(exchangeController) {
    if (!exchangeController) {
      throw new Error('exchangeController is required');
    }
    this.exchangeController = exchangeController;
    this.socialData = {
      profiles: [],
      posts: [],
      connections: []
    };
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

  createProfile(userId, username, bio = '') {
    try {
      if (!userId || !username) {
        throw new Error('Missing required fields: userId, username');
      }
      const profile = {
        user: userId,
        username,
        bio,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active'
      };
      this.socialData.profiles.push(profile);
      this.validateData(this.socialData);
      this.exchangeController.logComplianceEvent('profile_created', userId, JSON.stringify({ username }));
      return profile;
    } catch (error) {
      console.error('Error in createProfile:', error.message, error.stack);
      throw error;
    }
  }

  createPost(userId, content, visibility = 'public') {
    try {
      if (!userId || !content) {
        throw new Error('Missing required fields: userId, content');
      }
      const post = {
        id: crypto.randomUUID(),
        user: userId,
        content,
        visibility,
        timestamp: new Date().toISOString(),
        likes: 0,
        comments: []
      };
      this.socialData.posts.push(post);
      this.validateData(this.socialData);
      this.exchangeController.logComplianceEvent('post_created', userId, JSON.stringify({ postId: post.id }));
      return post;
    } catch (error) {
      console.error('Error in createPost:', error.message, error.stack);
      throw error;
    }
  }

  addConnection(userId, targetUserId) {
    try {
      if (!userId || !targetUserId) {
        throw new Error('Missing required fields: userId, targetUserId');
      }
      const connection = {
        id: crypto.randomUUID(),
        user: userId,
        target: targetUserId,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      this.socialData.connections.push(connection);
      this.validateData(this.socialData);
      this.exchangeController.logComplianceEvent('connection_added', userId, JSON.stringify({ target: targetUserId }));
      return connection;
    } catch (error) {
      console.error('Error in addConnection:', error.message, error.stack);
      throw error;
    }
  }

  getUserPosts(userId, visibility = 'public') {
    try {
      if (!userId) {
        throw new Error('Missing required field: userId');
      }
      const posts = this.socialData.posts.filter(p => p.user === userId && p.visibility === visibility);
      this.validateData(this.socialData);
      return posts;
    } catch (error) {
      console.error('Error in getUserPosts:', error.message, error.stack);
      throw error;
    }
  }

  getSocialData() {
    return this.socialData;
  }
}

module.exports = SocialController;