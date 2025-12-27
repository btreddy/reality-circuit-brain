import React, { useEffect } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: true,
  theme: 'dark', // War Room style
  securityLevel: 'loose',
});

const Mermaid = ({ chart }) => {
  useEffect(() => {
    mermaid.contentLoaded();
  }, [chart]);

  return (
    <div className="mermaid" style={{ background: '#111', padding: '10px', borderRadius: '5px', marginTop: '10px' }}>
      {chart}
    </div>
  );
};

export default Mermaid;