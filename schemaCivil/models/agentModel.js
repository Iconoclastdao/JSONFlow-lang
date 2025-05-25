const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  id: { type: String, required: true },
  agent: { type: String, required: true },
  type: { type: String, required: true },
  target: { type: String },
  params: { type: mongoose.Schema.Types.Mixed },
  status: { type: String, enum: ['pending', 'in-progress', 'completed', 'failed'], default: 'pending' },
  createdAt: { type: String, required: true }
});

const entropySchema = new mongoose.Schema({
  id: { type: String, required: true },
  agent: { type: String, required: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  timestamp: { type: String, required: true }
});

const agentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['oracle', 'logic', 'mirror', 'nlp', 'observer', 'signal', 'executor'], default: 'logic' },
  identity: {
    publicKey: { type: String, required: true },
    did: { type: String, required: true },
    created: { type: String, required: true }
  },
  coreLogic: { type: String, required: true },
  status: { type: String, enum: ['active', 'inactive', 'training', 'degraded'], default: 'active' },
  reputation_score: { type: Number, default: 50, min: 0, max: 100 },
  staking_balance: { type: Number, default: 0.0, min: 0 },
  votes_cast: { type: Number, default: 0 },
  projects_owned: [{ type: String }],
  ai_bond: {
    agentId: { type: String, required: true },
    bondType: { type: String, enum: ['symmetric', 'dominant', 'passive'], default: 'passive' },
    commitmentScore: { type: Number, min: 0, max: 1 }
  },
  tasks: [taskSchema],
  entropyRecords: [entropySchema]
}, { timestamps: true });

module.exports = mongoose.model('Agent', agentSchema);