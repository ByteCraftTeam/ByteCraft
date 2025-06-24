import DemoCallback from '../examples/demo-callback.js';
import { render, Box, Text, useInput } from "ink";
function App() {
  return (
    <div className="App">
      <DemoCallback modelAlias="deepseek-v3" />
    </div>
  );
}

render(<App />);