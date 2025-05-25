const fs = require('fs').promises;
const path = require('path');

async function generateComponents() {
  const schemaPath = path.resolve(__dirname, '../schema/frontend/frontend.schema.json');
  const outputDir = path.resolve(__dirname, '../frontend/components/generated');

  let frontendSchema;
  try {
    const schemaData = await fs.readFile(schemaPath, 'utf-8');
    frontendSchema = JSON.parse(schemaData);
  } catch (e) {
    console.error(`❌ Could not load frontend.schema.json at ${schemaPath}:`, e.message);
    process.exit(1);
  }

  const components = frontendSchema.properties?.components?.items || [];
  if (!Array.isArray(components)) {
    console.error('❌ frontendSchema.properties.components.items is not an array.');
    process.exit(1);
  }

  try {
    await fs.mkdir(outputDir, { recursive: true });

    for (const component of components) {
      const { id, type, config } = component;
      if (!id || !type || !config) {
        console.error(`❌ Invalid component: ${JSON.stringify(component)}`);
        continue;
      }

      const className = config.css?.className || `${config.module}-${config.action}`;
      let compString;

      if (type === 'form') {
        compString = `
/**
 * ${id} component for ${config.module}/${config.action} (Workflow: ${config.workflow || 'none'})
 */
import React from 'react';
import { useForm } from 'react-hook-form';
import { post } from '../../api';

const ${id} = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    try {
      const response = await post('/${config.module}/${config.action}', { workflow: '${config.workflow || ''}', ...data });
      console.log('Success:', response);
    } catch (error) {
      console.error('Error:', error.message);
    }
  };

  return (
    <div className="${className}">
      <h2>${id}</h2>
      <form onSubmit={handleSubmit(onSubmit)}>
${(config.fields || [])
  .map(
    field => `
        <div>
          <label>${field.label}</label>
          <${field.type === 'textarea' ? 'textarea' : 'input'}
            {...register('${field.name}', { required: ${!!field.required} })}
            ${field.type !== 'textarea' ? `type="${field.type}"` : ''}
          />
          {errors.${field.name} && <span>This field is required</span>}
        </div>`
  )
  .join('\n')}
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

export default ${id};
        `.trim();
      } else if (type === 'chat') {
        compString = `
/**
 * ${id} component for NLP interaction (Workflow: ${config.workflow || 'none'})
 */
import React, { useState } from 'react';
import { post } from '../../api';
import ReactMarkdown from 'react-markdown';

const ${id} = () => {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');

  const handleSubmit = async () => {
    try {
      const result = await post('/${config.module}/${config.action}', { workflow: '${config.workflow || ''}', input_text: input });
      setResponse(result.response);
    } catch (error) {
      console.error('Error:', error.message);
    }
  };

  return (
    <div className="${className}">
      <h2>${id}</h2>
      <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Enter your message" />
      <button onClick={handleSubmit}>Send</button>
      <div>
        <strong>Response:</strong>
        <div><ReactMarkdown>{response}</ReactMarkdown></div>
      </div>
    </div>
  );
};

export default ${id};
        `.trim();
      } else {
        compString = `
/**
 * ${id} component (Workflow: ${config.workflow || 'none'})
 */
import React from 'react';

const ${id} = () => {
  return (
    <div className="${className}">
      <h2>${id}</h2>
      <p>TODO: Implement ${config.module}/${config.action} UI</p>
    </div>
  );
};

export default ${id};
        `.trim();
      }

      const compFilePath = path.join(outputDir, `${id}.jsx`);
      await fs.writeFile(compFilePath, compString);
      console.log(`✅ Generated component: ${id} at ${compFilePath}`);
    }
  } catch (error) {
    console.error('❌ Error generating components:', error.message);
    process.exit(1);
  }
}

generateComponents();