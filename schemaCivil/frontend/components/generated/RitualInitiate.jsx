/**
 * RitualInitiate component for ritual/initiate (Workflow: ritual-initiate)
 */
import React from 'react';
import { useForm } from 'react-hook-form';
import { post } from '../../api';

const RitualInitiate = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    try {
      const response = await post('/ritual/initiate', { workflow: 'ritual-initiate', ...data });
      console.log('Success:', response);
    } catch (error) {
      console.error('Error:', error.message);
    }
  };

  return (
    <div className="ritual-initiate">
      <h2>RitualInitiate</h2>
      <form onSubmit={handleSubmit(onSubmit)}>

        <div>
          <label>Ritual Type</label>
          <input
            {...register('ritualType', { required: true })}
            type="text"
          />
          {errors.ritualType && <span>This field is required</span>}
        </div>

        <div>
          <label>Participants</label>
          <input
            {...register('participants', { required: true })}
            type="text"
          />
          {errors.participants && <span>This field is required</span>}
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

export default RitualInitiate;