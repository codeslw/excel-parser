import "antd/dist/reset.css";
import {lazy, Suspense} from "react";
import './styles/table-colors.css';

const Main = lazy(() => import("./pages/Main"));


function App() {

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Main/>
    </Suspense>
  )
}

export default App
