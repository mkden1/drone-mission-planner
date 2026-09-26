import { useState } from 'react';
import type { Mission } from '../types';
import { createMissionBasic } from '../api';

interface Props {
  onMissionCreated: (mission: Mission) => void;
}

export default function CreateMissionForm({ onMissionCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name) return;
    setLoading(true);
    try {
      const mission = await createMissionBasic(name, description);
      onMissionCreated(mission);
      setName('');
      setDescription('');
    } catch (err) {
      console.error('Failed to create mission', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h1>New Mission</h1>
      <div className="form-group">
        <label>Mission Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Enter mission name"
        />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Enter description"
        />
      </div>
      <button onClick={handleSubmit} disabled={loading || !name}>
        {loading ? 'Creating...' : 'Create Mission'}
      </button>
    </div>
  );
}