import { useState } from 'react';
import Header from '../components/Sheared/Header';
import Settings from '../components/Sheared/Settings';

const Home = () => {  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div>
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />
      {isSettingsOpen && (
        <Settings
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
};

export default Home;