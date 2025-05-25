/**
 * IdentityRegister component for identity/register (Workflow: identity-register)
 */
import React from 'react';
import { useForm } from 'react-hook-form';
import { post } from '../../api';

const IdentityRegister = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    try {
      const response = await post('/identity/register', { workflow: 'identity-register', ...data });
      console.log('Success:', response);
    } catch (error) {
      console.error('Error:', error.message);
    }
  };

  return (
    <div className="identity-register">
      <h2>IdentityRegister</h2>
      <form onSubmit={handleSubmit(onSubmit)}>

        <div>
          <label>Username</label>
          <input
            {...register('username', { required: true })}
            type="text"
          />
          {errors.username && <span>This field is required</span>}
        </div>

        <div>
          <label>Public Key</label>
          <input
            {...register('publicKey', { required: true })}
            type="text"
          />
          {errors.publicKey && <span>This field is required</span>}
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

export default IdentityRegister;