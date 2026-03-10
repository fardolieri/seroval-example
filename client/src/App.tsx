import { getSerovalData } from './getSerovalData';
import { SerovalViewer } from './SerovalViewer';

function App() {
  const data = getSerovalData('/api/test1');
  return (
    <div class="container">
      <h1>Seroval Streaming Demo</h1>
      <p class="hint">Each request returns a random object. Promises and streams resolve reactively.</p>
      <SerovalViewer value={data} />
    </div>
  );
}

export default App;
