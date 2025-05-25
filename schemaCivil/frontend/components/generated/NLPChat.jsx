/**
 * NLPChat component for NLP interaction (Workflow: nlp-interaction)
 */
import React, { useState } from 'react';
import { post } from '../../api';
import ReactMarkdown from 'react-markdown';

const NLPChat = () => {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');

  const handleSubmit = async () => {
    try {
      const result = await post('/nlp/chat', { workflow: 'nlp-interaction', input_text: input });
      setResponse(result.response);
    } catch (error) {
      console.error('Error:', error.message);
    }
  };

  return (
    <div className="nlp-chat">
      <h2>NLPChat</h2>
      <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Enter your message" />
      <button onClick={handleSubmit}>Send</button>
      <div>
        <strong>Response:</strong>
        <div><ReactMarkdown>{response}</ReactMarkdown></div>
      </div>
    </div>
  );
};

export default NLPChat;